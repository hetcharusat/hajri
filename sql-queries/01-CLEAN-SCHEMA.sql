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
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
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
