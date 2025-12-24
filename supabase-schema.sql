-- HAJRI Database Schema for Supabase
-- Run this in Supabase SQL Editor (SQL Editor → New Query → Paste → Run)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DEPARTMENTS TABLE
-- ============================================
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEMESTERS TABLE
-- ============================================
CREATE TABLE semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBJECTS TABLE
-- ============================================
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    type TEXT CHECK (type IN ('LECT', 'LAB', 'TUT')) DEFAULT 'LECT',
    credits INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department_id, semester_id, code)
);

-- ============================================
-- TIMETABLE ENTRIES TABLE
-- ============================================
CREATE TABLE timetable_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    faculty TEXT,
    batch TEXT, -- A/B/C/D or NULL for all
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS TABLE (for student backups)
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    google_id TEXT UNIQUE,
    department_id UUID REFERENCES departments(id),
    semester_id UUID REFERENCES semesters(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- ============================================
-- USER BACKUPS TABLE
-- ============================================
CREATE TABLE user_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    backup_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_subjects_department ON subjects(department_id);
CREATE INDEX idx_subjects_semester ON subjects(semester_id);
CREATE INDEX idx_timetable_subject ON timetable_entries(subject_id);
CREATE INDEX idx_timetable_active ON timetable_entries(is_active);
CREATE INDEX idx_user_backups_user ON user_backups(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_backups ENABLE ROW LEVEL SECURITY;

-- Public read access for timetable/subjects (students need this)
CREATE POLICY "Public read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Public read semesters" ON semesters FOR SELECT USING (true);
CREATE POLICY "Public read subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Public read timetable" ON timetable_entries FOR SELECT USING (is_active = true);

-- Users can read their own data
CREATE POLICY "Users read own data" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users read own backups" ON user_backups FOR SELECT USING (auth.uid()::text = user_id::text);

-- Users can insert/update their own data
CREATE POLICY "Users insert own data" ON users FOR INSERT WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "Users update own data" ON users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Users insert own backups" ON user_backups FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Admin write access (we'll add admin emails later)
-- For now, disable write policies (you'll manage via service role key in admin dashboard)

-- ============================================
-- SAMPLE DATA (optional - for testing)
-- ============================================
INSERT INTO departments (code, name) VALUES
    ('CSE', 'Computer Science Engineering'),
    ('IT', 'Information Technology'),
    ('ECE', 'Electronics & Communication');

INSERT INTO semesters (name, start_date, end_date, is_active) VALUES
    ('Semester 1 (2024-25)', '2024-08-01', '2024-12-31', true);

-- ============================================
-- FUNCTIONS for auto-updating timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_semesters_updated_at BEFORE UPDATE ON semesters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timetable_updated_at BEFORE UPDATE ON timetable_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE! 
-- ============================================
-- Your database is ready. Next steps:
-- 1. Go to Authentication → Providers → Enable Google
-- 2. Add your admin email to allowed users
-- 3. Start building the admin dashboard
