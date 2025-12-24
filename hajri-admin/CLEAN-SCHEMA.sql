-- HAJRI Schema V3 - Clean Install
-- New Hierarchy: Department (Building) → Branch (Program) → Semester → Class → Batch
-- Batch naming: {semester_number}{branch_abbr}{class_number}-{batch_letter} (e.g., 2CE1-A)

-- Extensions (Supabase typically has these, but keep it explicit)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop all tables in correct order (respects foreign keys)
-- Must drop children before parents
DROP TABLE IF EXISTS timetable_events CASCADE;
DROP TABLE IF EXISTS timetable_versions CASCADE;
DROP TABLE IF EXISTS course_offerings CASCADE;
DROP TABLE IF EXISTS period_templates CASCADE;
DROP TABLE IF EXISTS academic_calendar CASCADE;
DROP TABLE IF EXISTS student_backups CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS timetable_entries CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS semesters CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop helper functions/types (safe if missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.get_all_users();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP TYPE IF EXISTS timetable_version_status;

-- ===================================================================
-- 0. USERS (Admin/Access control)
-- ===================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 1. DEPARTMENTS (Buildings/Physical Locations)
-- ===================================================================

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 2. BRANCHES (Programs: Computer Engineering, Mechanical, etc.)
-- ===================================================================

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, department_id)
);

-- ===================================================================
-- 3. SEMESTERS (Per Branch: 1, 2, 3, 4, 5, 6, 7, 8)
-- ===================================================================

CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, semester_number)
);

-- ===================================================================
-- 4. SUBJECTS (Courses for a specific semester)
-- ===================================================================

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  credits INTEGER DEFAULT 3,
  type TEXT DEFAULT 'LECTURE' CHECK (type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(semester_id, code)
);

-- ===================================================================
-- 5. CLASSES (Multiple classes per semester: Class 1, Class 2, etc.)
-- ===================================================================

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  class_number INTEGER NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(semester_id, class_number)
);

-- ===================================================================
-- 6. BATCHES (Sections within a class: A, B, C, D)
-- Display name computed as: {semester_number}{branch_abbr}{class_number}-{batch_letter}
-- Example: 2CE1-A = Semester 2, Computer Engineering, Class 1, Batch A
-- ===================================================================

CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  batch_letter TEXT NOT NULL CHECK (batch_letter ~ '^[A-Z]$'),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, batch_letter)
);

-- ===================================================================
-- 7. FACULTY
-- ===================================================================

CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  abbr TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 8. ROOMS (Optionally linked to department/building)
-- ===================================================================

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  capacity INTEGER,
  type TEXT DEFAULT 'CLASSROOM' CHECK (type IN ('CLASSROOM', 'LAB', 'HALL')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 9. STUDENTS
-- ===================================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  enrollment_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 10. STUDENT BACKUPS
-- ===================================================================

CREATE TABLE student_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  backup_data JSONB NOT NULL,
  backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  device_info JSONB
);

-- ===================================================================
-- 11. COURSE OFFERINGS (Subject + Batch + Faculty + Default Room)
-- ===================================================================

CREATE TABLE course_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  default_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, batch_id)
);

-- ===================================================================
-- 12. TIMETABLE VERSIONS (Draft/Published/Archived per batch)
-- ===================================================================

CREATE TYPE timetable_version_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE timetable_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  status timetable_version_status NOT NULL DEFAULT 'draft',
  name TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 13. TIMETABLE EVENTS (Scheduled slots)
-- ===================================================================

CREATE TABLE timetable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES timetable_versions(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (version_id, day_of_week, start_time),
  CHECK (end_time > start_time)
);

-- ===================================================================
-- 14. PERIOD TEMPLATES (Time slot definitions for timetable editor)
-- ===================================================================

CREATE TABLE period_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slots JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 15. ACADEMIC CALENDAR (Future: attendance calculations)
-- ===================================================================

CREATE TABLE academic_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payload JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 16. LEGACY TIMETABLE ENTRIES (Keep for backward compatibility)
-- ===================================================================

CREATE TABLE timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- ===================================================================
-- INDEXES
-- ===================================================================

CREATE INDEX idx_branches_department ON branches(department_id);
CREATE INDEX idx_semesters_branch ON semesters(branch_id);
CREATE INDEX idx_subjects_semester ON subjects(semester_id);
CREATE INDEX idx_classes_semester ON classes(semester_id);
CREATE INDEX idx_batches_class ON batches(class_id);
CREATE INDEX idx_students_batch ON students(batch_id);
CREATE INDEX idx_rooms_department ON rooms(department_id);

CREATE INDEX idx_offerings_batch ON course_offerings(batch_id);
CREATE INDEX idx_offerings_subject ON course_offerings(subject_id);
CREATE INDEX idx_tt_versions_batch ON timetable_versions(batch_id);
CREATE INDEX idx_tt_events_version ON timetable_events(version_id);
CREATE INDEX idx_tt_events_day ON timetable_events(day_of_week);

CREATE INDEX idx_timetable_subject ON timetable_entries(subject_id);
CREATE INDEX idx_timetable_batch ON timetable_entries(batch_id);
CREATE INDEX idx_timetable_day ON timetable_entries(day_of_week);

-- ===================================================================
-- TRIGGERS
-- ===================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
DROP TRIGGER IF EXISTS update_branches_updated_at ON branches;
DROP TRIGGER IF EXISTS update_semesters_updated_at ON semesters;
DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
DROP TRIGGER IF EXISTS update_faculty_updated_at ON faculty;
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
DROP TRIGGER IF EXISTS update_course_offerings_updated_at ON course_offerings;
DROP TRIGGER IF EXISTS update_timetable_versions_updated_at ON timetable_versions;
DROP TRIGGER IF EXISTS update_timetable_events_updated_at ON timetable_events;
DROP TRIGGER IF EXISTS update_period_templates_updated_at ON period_templates;
DROP TRIGGER IF EXISTS update_academic_calendar_updated_at ON academic_calendar;
DROP TRIGGER IF EXISTS update_timetable_entries_updated_at ON timetable_entries;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_semesters_updated_at BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON faculty FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_course_offerings_updated_at BEFORE UPDATE ON course_offerings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timetable_versions_updated_at BEFORE UPDATE ON timetable_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timetable_events_updated_at BEFORE UPDATE ON timetable_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_period_templates_updated_at BEFORE UPDATE ON period_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academic_calendar_updated_at BEFORE UPDATE ON academic_calendar FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timetable_entries_updated_at BEFORE UPDATE ON timetable_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- AUTH TRIGGER (Auto-create user row on signup)
-- ===================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_admin)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===================================================================
-- RPC FUNCTIONS
-- ===================================================================

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  is_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can view all users';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.is_admin, u.created_at, u.updated_at
  FROM users u
  ORDER BY u.created_at DESC;
END;
$$;

-- ===================================================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own data" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert themselves" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update other users" ON users FOR UPDATE TO authenticated
  USING (
    auth.uid() != users.id
    AND (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  )
  WITH CHECK (
    auth.uid() != users.id
    AND (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

-- Admin full access
CREATE POLICY "Admins full access departments" ON departments FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access branches" ON branches FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access semesters" ON semesters FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access subjects" ON subjects FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access classes" ON classes FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access batches" ON batches FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access faculty" ON faculty FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access rooms" ON rooms FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access students" ON students FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access offerings" ON course_offerings FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access timetable_versions" ON timetable_versions FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access timetable_events" ON timetable_events FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access period_templates" ON period_templates FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access academic_calendar" ON academic_calendar FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
CREATE POLICY "Admins full access timetable (legacy)" ON timetable_entries FOR ALL TO authenticated USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);

-- Student/mobile read access
CREATE POLICY "Students read subjects" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students read published timetable (V2)" ON timetable_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM timetable_versions v
      WHERE v.id = timetable_events.version_id
        AND v.status = 'published'
    )
  );
CREATE POLICY "Students read published timetable (legacy)" ON timetable_entries FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "Students own backups" ON student_backups FOR ALL TO authenticated USING (student_id IN (SELECT id FROM students WHERE email = auth.email()));

-- ===================================================================
-- SEED DATA
-- ===================================================================

-- Sample departments (buildings)
INSERT INTO departments (name) VALUES 
  ('Building A'),
  ('Building B'),
  ('Main Block')
ON CONFLICT (name) DO NOTHING;

-- Sample branches with abbreviations
INSERT INTO branches (name, abbreviation, department_id)
SELECT 'Computer Engineering', 'CE', d.id FROM departments d WHERE d.name = 'Building A'
UNION ALL
SELECT 'Mechanical Engineering', 'ME', d.id FROM departments d WHERE d.name = 'Building A'
ON CONFLICT (name, department_id) DO NOTHING;

-- Default period template
INSERT INTO period_templates (name, slots, is_active)
VALUES (
  'Default (8 AM - 5 PM)',
  '[
    {"label":"08:00 AM","start":"08:00","end":"09:00"},
    {"label":"09:00 AM","start":"09:00","end":"10:00"},
    {"label":"10:00 AM","start":"10:00","end":"11:00"},
    {"label":"11:00 AM","start":"11:00","end":"12:00"},
    {"label":"12:00 PM","start":"12:00","end":"13:00"},
    {"label":"01:00 PM","start":"13:00","end":"14:00"},
    {"label":"02:00 PM","start":"14:00","end":"15:00"},
    {"label":"03:00 PM","start":"15:00","end":"16:00"},
    {"label":"04:00 PM","start":"16:00","end":"17:00"}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

