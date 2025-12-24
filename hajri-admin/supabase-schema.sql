-- HAJRI Complete Database Schema
-- Run this in Supabase SQL Editor after user setup

-- ============================================
-- 1. DEPARTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SEMESTERS
-- ============================================
CREATE TABLE IF NOT EXISTS semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "Semester 1", "Semester 2", etc.
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, year)
);

-- ============================================
-- 3. SUBJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL,
  credits INTEGER DEFAULT 3,
  type TEXT DEFAULT 'LECTURE' CHECK (type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. FACULTY
-- ============================================
CREATE TABLE IF NOT EXISTS faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ROOMS
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE NOT NULL,
  building TEXT,
  capacity INTEGER,
  type TEXT DEFAULT 'CLASSROOM' CHECK (type IN ('CLASSROOM', 'LAB', 'HALL')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. BATCHES
-- ============================================
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "A", "B", "C", "D", or "ALL"
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, department_id, semester_id)
);

-- ============================================
-- 7. TIMETABLE ENTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- ============================================
-- 8. STUDENTS
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  enrollment_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. STUDENT BACKUPS (from mobile app)
-- ============================================
CREATE TABLE IF NOT EXISTS student_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  backup_data JSONB NOT NULL,
  backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  device_info JSONB
);

-- ============================================
-- INDEXES for performance
-- ============================================
DROP INDEX IF EXISTS idx_subjects_department;
DROP INDEX IF EXISTS idx_subjects_semester;
DROP INDEX IF EXISTS idx_timetable_subject;
DROP INDEX IF EXISTS idx_timetable_batch;
DROP INDEX IF EXISTS idx_timetable_day;
DROP INDEX IF EXISTS idx_students_department;
DROP INDEX IF EXISTS idx_students_semester;

CREATE INDEX idx_subjects_department ON subjects(department_id);
CREATE INDEX idx_subjects_semester ON subjects(semester_id);
CREATE INDEX idx_timetable_subject ON timetable_entries(subject_id);
CREATE INDEX idx_timetable_batch ON timetable_entries(batch_id);
CREATE INDEX idx_timetable_day ON timetable_entries(day_of_week);
CREATE INDEX idx_students_department ON students(department_id);
CREATE INDEX idx_students_semester ON students(semester_id);

-- ============================================
-- AUTO-UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
DROP TRIGGER IF EXISTS update_semesters_updated_at ON semesters;
DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
DROP TRIGGER IF EXISTS update_faculty_updated_at ON faculty;
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
DROP TRIGGER IF EXISTS update_timetable_entries_updated_at ON timetable_entries;
DROP TRIGGER IF EXISTS update_students_updated_at ON students;

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_semesters_updated_at BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON faculty FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timetable_entries_updated_at BEFORE UPDATE ON timetable_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_backups ENABLE ROW LEVEL SECURITY;

-- Policy: Admins have full access to all tables
CREATE POLICY "Admins full access departments" ON departments FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access semesters" ON semesters FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access subjects" ON subjects FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access faculty" ON faculty FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access rooms" ON rooms FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access batches" ON batches FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access timetable" ON timetable_entries FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access students" ON students FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);

-- Policy: Students can read published timetable and subjects (for mobile app)
CREATE POLICY "Students read subjects" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students read published timetable" ON timetable_entries FOR SELECT TO authenticated USING (is_published = true);

-- Policy: Students can write their own backups
CREATE POLICY "Students own backups" ON student_backups FOR ALL TO authenticated USING (student_id IN (SELECT id FROM students WHERE email = auth.email()));

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- Sample department
INSERT INTO departments (code, name) VALUES 
  ('CS', 'Computer Science'),
  ('EE', 'Electrical Engineering'),
  ('ME', 'Mechanical Engineering')
ON CONFLICT (code) DO NOTHING;

-- Sample semester
INSERT INTO semesters (name, year, start_date, end_date, is_active) VALUES 
  ('Semester 1', 2025, '2025-01-15', '2025-05-31', true)
ON CONFLICT (name, year) DO NOTHING;

-- Done!
