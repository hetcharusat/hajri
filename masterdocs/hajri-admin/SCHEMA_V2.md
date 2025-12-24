# Database Schema V2 - Complete Reference

**Last Updated:** December 22, 2025  
**Schema File:** `hajri-admin/CLEAN-SCHEMA.sql`  
**Purpose:** Authoritative clean-install schema for Hajri Admin Portal

---

## At a Glance

**What this doc is**
- The V2 Postgres schema reference used by the Admin Portal.

**Where the truth lives**
- `hajri-admin/CLEAN-SCHEMA.sql` (this doc describes it).

**How to deploy**
- Supabase → SQL Editor → run `hajri-admin/CLEAN-SCHEMA.sql` (destructive).

**Key V2 tables**
- `course_offerings`: schedulable teaching unit (subject+batch+faculty).
- `timetable_versions`: per-batch draft/published/archived lifecycle.
- `timetable_events`: grid cells referencing offerings.
- `period_templates`: JSON timeslots (used by editor grid).

**Key auth table**
- `users`: linked to `auth.users`, controls admin access (`is_admin`).

**Common pitfalls**
- RLS failures often come from missing `users` row or `is_admin=false`.
- Timetable editor requires V2 tables; partial schema deploy breaks the UI.

---

## 🎯 Schema Evolution

### V1 (Legacy)
- Basic entities: departments, subjects, faculty, rooms, batches, students
- Simple timetable_entries (subject → faculty → room → batch → time)
- No versioning, no offerings concept

### V2 (Current)
- **Offerings Model:** Subject + Batch + Faculty as schedulable unit
- **Versioned Timetables:** Draft/Published/Archived per batch
- **Period Templates:** JSON-based time slot definitions
- **Academic Calendar:** JSON payload for future attendance

---

## 📊 Entity Relationship Diagram (ERD)

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ departments │◄──────│   batches   │──────►│  semesters  │
└─────────────┘       └──────┬──────┘       └─────────────┘
       │                     │                      │
       │                     │                      │
       ▼                     │                      ▼
┌─────────────┐             │               ┌─────────────┐
│   faculty   │             │               │   subjects  │
└──────┬──────┘             │               └──────┬──────┘
       │                     │                      │
       │                     │                      │
       │              ┌──────▼──────────────────────▼──────┐
       │              │         course_offerings           │
       └──────────────┤  (subject + batch + faculty)       │
                      └──────────────┬────────────────────┬─┘
                                     │                    │
                      ┌──────────────▼──────┐             │
                      │ timetable_versions  │             │
                      │  (draft/published)  │             │
                      └──────────────┬──────┘             │
                                     │                    │
                      ┌──────────────▼────────────────────▼─┐
                      │        timetable_events            │
                      │  (scheduled offering in slot)      │
                      └────────────────────────────────────┘
```

---

## 🗄️ Table Reference

### Core Tables (Domain Entities)

#### 1. `users`
**Purpose:** Admin access control, linked to Supabase auth

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Points:**
- Auto-populated by `handle_new_user()` trigger on `auth.users` insert
- `is_admin` controls access via RLS policies
- Cannot self-update admin status (enforced by RLS)

**Indexes:**
- Primary: `id`
- Unique: `email`

---

#### 2. `departments`
**Purpose:** Academic departments (CS, EE, ME, etc.)

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Examples:**
- `CS` - Computer Science
- `EE` - Electrical Engineering
- `ME` - Mechanical Engineering

**Relationships:**
- → `subjects.department_id`
- → `faculty.department_id`
- → `batches.department_id`
- → `students.department_id`

---

#### 3. `semesters`
**Purpose:** Academic semesters/terms

```sql
CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, year)
);
```

**Examples:**
- `Semester 1, 2025` (Jan 15 - May 31)
- `Semester 2, 2025` (Aug 1 - Dec 15)

**Key Constraint:**
- Unique(name, year) prevents duplicate semesters

**Relationships:**
- → `subjects.semester_id`
- → `batches.semester_id`
- → `students.semester_id`

---

#### 4. `subjects`
**Purpose:** Courses/subjects taught

```sql
CREATE TABLE subjects (
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
```

**Types:**
- `LECTURE` - Theory classes
- `LAB` - Practical sessions
- `TUTORIAL` - Discussion/problem-solving

**Indexes:**
- `idx_subjects_department` on `department_id`
- `idx_subjects_semester` on `semester_id`

---

#### 5. `faculty`
**Purpose:** Teaching staff

```sql
CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- → `course_offerings.faculty_id`
- ← `departments.id`

---

#### 6. `rooms`
**Purpose:** Physical classrooms/labs

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE NOT NULL,
  building TEXT,
  capacity INTEGER,
  type TEXT DEFAULT 'CLASSROOM' CHECK (type IN ('CLASSROOM', 'LAB', 'HALL')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Types:**
- `CLASSROOM` - Standard lecture room
- `LAB` - Laboratory/workshop
- `HALL` - Large auditorium

---

#### 7. `batches`
**Purpose:** Student groups (section/division)

```sql
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, department_id, semester_id)
);
```

**Examples:**
- `CS-A` (Computer Science, Section A)
- `EE-B` (Electrical Engineering, Section B)

**Key Constraint:**
- Unique(name, department, semester) prevents duplicate batches

**Relationships:**
- → `course_offerings.batch_id`
- → `timetable_versions.batch_id`
- → `students.batch_id`

---

#### 8. `students`
**Purpose:** Student records

```sql
CREATE TABLE students (
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
```

**Indexes:**
- `idx_students_department` on `department_id`
- `idx_students_semester` on `semester_id`

---

### V2 Tables (Timetable System)

#### 9. `course_offerings`
**Purpose:** Schedulable units (subject taught to batch by faculty)

```sql
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
```

**Key Design Decision:**
- **Why Offerings?** Same subject can be taught by different faculty to different batches
- **Unique Constraint:** One offering per subject+batch combo
- **Default Room:** Pre-configured room, can be overridden per event

**Indexes:**
- `idx_offerings_batch` on `batch_id`
- `idx_offerings_subject` on `subject_id`

**Examples:**
```
| Subject    | Batch | Faculty      | Default Room |
|------------|-------|--------------|--------------|
| Data Structures | CS-A  | Dr. Smith    | Lab 101      |
| Data Structures | CS-B  | Dr. Johnson  | Lab 102      |
| Algorithms      | CS-A  | Dr. Smith    | Room 201     |
```

---

#### 10. `timetable_versions`
**Purpose:** Version history of timetables per batch

```sql
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
```

**Status Flow:**
```
draft → (publish action) → published → (new publish) → archived
  ↑                                                         ↓
  └─────────────── (new draft created) ────────────────────┘
```

**Per-Batch Workflow:**
- Each batch has **one draft** (actively edited)
- Each batch can have **one published** (live for students)
- Old published versions become **archived** (historical record)

**Indexes:**
- `idx_tt_versions_batch` on `batch_id`

---

#### 11. `timetable_events`
**Purpose:** Scheduled time slots (offering + time + room)

```sql
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
```

**Key Constraints:**
- **Unique(version, day, start_time):** Enables upsert-based "paint" workflow
- **CHECK(end_time > start_time):** Prevents invalid slots

**Day Mapping:**
- `0` = Monday
- `1` = Tuesday
- `2` = Wednesday
- `3` = Thursday
- `4` = Friday
- `5` = Saturday
- `6` = Sunday (typically unused)

**Room Override:**
- `room_id` can override offering's `default_room_id`
- If NULL, falls back to offering's default

**Indexes:**
- `idx_tt_events_version` on `version_id`
- `idx_tt_events_day` on `day_of_week`

---

#### 12. `period_templates`
**Purpose:** Time slot definitions (JSON)

```sql
CREATE TABLE period_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slots JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**JSON Structure:**
```json
[
  {"label": "08:00 AM", "start": "08:00", "end": "09:00"},
  {"label": "09:00 AM", "start": "09:00", "end": "10:00"},
  {"label": "10:00 AM", "start": "10:00", "end": "11:00"},
  ...
]
```

**Usage:**
- Loaded by Timetable editor on init
- Defines available time slots in the grid
- `is_active=true` marks the current template

**Default Seeded Template:**
- 9 hourly slots (08:00 - 17:00)
- Name: "Default (8-5 hourly)"

---

#### 13. `academic_calendar`
**Purpose:** Academic calendar data (future attendance)

```sql
CREATE TABLE academic_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payload JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Planned Usage:**
- Store holidays, exam weeks, semester boundaries
- Calculate expected vs actual classes for attendance
- Not yet implemented in UI

**Example Payload (Future):**
```json
{
  "semester": "Spring 2025",
  "holidays": [
    {"date": "2025-01-26", "name": "Republic Day"},
    {"date": "2025-03-08", "name": "Holi"}
  ],
  "exam_weeks": [
    {"start": "2025-05-15", "end": "2025-05-31"}
  ]
}
```

---

### Legacy Tables (Compatibility)

#### 14. `timetable_entries`
**Purpose:** Legacy timetable format

```sql
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
```

**Status:** Kept for backward compatibility, not used by V2 UI

**Indexes:**
- `idx_timetable_subject` on `subject_id`
- `idx_timetable_batch` on `batch_id`
- `idx_timetable_day` on `day_of_week`

---

#### 15. `student_backups`
**Purpose:** Mobile app data backup

```sql
CREATE TABLE student_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  backup_data JSONB NOT NULL,
  backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  device_info JSONB
);
```

**Usage:** Student mobile app attendance backup (not admin portal)

---

## 🔐 Row Level Security (RLS)

### Policy Strategy
- **Admins:** Full CRUD on all tables
- **Students:** Read-only on subjects + published timetables
- **Users:** Can view/insert own row, admins update others (not self)

### Admin Full Access Pattern
```sql
CREATE POLICY "Admins full access" ON <table_name> FOR ALL TO authenticated
  USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
```

**Applied to:**
- departments, semesters, subjects, faculty, rooms, batches
- students, timetable_entries
- course_offerings, timetable_versions, timetable_events
- period_templates, academic_calendar

### Student Read Access
```sql
-- Subjects
CREATE POLICY "Students read subjects" ON subjects FOR SELECT TO authenticated
  USING (true);

-- Published timetable (legacy)
CREATE POLICY "Students read published timetable" ON timetable_entries FOR SELECT TO authenticated
  USING (is_published = true);

-- Published timetable (V2)
CREATE POLICY "Students read published timetable (V2)" ON timetable_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM timetable_versions v
      WHERE v.id = timetable_events.version_id AND v.status = 'published'
    )
  );
```

### Users Table Special Policies
```sql
-- View own data
CREATE POLICY "Users can view own data" ON users FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Insert own row
CREATE POLICY "Users can insert themselves" ON users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admins update others (not self)
CREATE POLICY "Admins can update other users" ON users FOR UPDATE TO authenticated
  USING (
    auth.uid() != users.id
    AND (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  )
  WITH CHECK (
    auth.uid() != users.id
    AND (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );
```

**Key Security Feature:** Admins cannot toggle their own `is_admin` status

---

## ⚙️ Functions & Triggers

### 1. `update_updated_at_column()`
**Purpose:** Auto-update `updated_at` timestamp on row update

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Applied to:** All tables with `updated_at` column

**Triggers:**
```sql
CREATE TRIGGER update_<table>_updated_at
BEFORE UPDATE ON <table>
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### 2. `handle_new_user()`
**Purpose:** Auto-create user row on auth signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_admin)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Trigger:**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Security:** `SECURITY DEFINER` allows function to bypass RLS

---

### 3. `get_all_users()`
**Purpose:** Settings page RPC (admin-only)

```sql
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
```

**Usage:**
```javascript
const { data, error } = await supabase.rpc('get_all_users')
```

---

## 📈 Seed Data

### Default Departments
```sql
INSERT INTO departments (code, name) VALUES 
  ('CS', 'Computer Science'),
  ('EE', 'Electrical Engineering'),
  ('ME', 'Mechanical Engineering')
ON CONFLICT (code) DO NOTHING;
```

### Default Semester
```sql
INSERT INTO semesters (name, year, start_date, end_date, is_active) VALUES 
  ('Semester 1', 2025, '2025-01-15', '2025-05-31', true)
ON CONFLICT (name, year) DO NOTHING;
```

### Default Period Template
```sql
INSERT INTO period_templates (name, slots, is_active)
VALUES (
  'Default (8-5 hourly)',
  '[
    {"label":"08:00 AM","start":"08:00","end":"09:00"},
    {"label":"09:00 AM","start":"09:00","end":"10:00"},
    ...
    {"label":"04:00 PM","start":"16:00","end":"17:00"}
  ]'::jsonb,
  true
);
```

---

## 🔄 Schema Deployment

### Clean Install (First Time)
```sql
-- Run entire CLEAN-SCHEMA.sql in Supabase SQL Editor
-- This will:
-- 1. Drop all existing tables (if any)
-- 2. Create all tables, triggers, RLS policies
-- 3. Seed default data
```

### Re-run (Updates)
```sql
-- Safe to re-run CLEAN-SCHEMA.sql
-- Drop order is correct (triggers → functions → types → tables)
-- All drops use IF EXISTS
-- Seed data uses ON CONFLICT DO NOTHING
```

### Migration Strategy (Future)
- Version control schema changes
- Use Supabase migrations directory
- Alembic/Flyway-style versioning

---

## 🎯 Query Examples

### Get Offerings for Batch
```sql
SELECT 
  co.*,
  s.code AS subject_code,
  s.name AS subject_name,
  f.name AS faculty_name,
  r.room_number AS default_room
FROM course_offerings co
JOIN subjects s ON co.subject_id = s.id
LEFT JOIN faculty f ON co.faculty_id = f.id
LEFT JOIN rooms r ON co.default_room_id = r.id
WHERE co.batch_id = '<batch_uuid>'
ORDER BY s.code;
```

### Get Published Timetable for Batch
```sql
SELECT 
  te.*,
  s.code AS subject_code,
  s.name AS subject_name,
  f.name AS faculty_name,
  r.room_number
FROM timetable_events te
JOIN timetable_versions tv ON te.version_id = tv.id
JOIN course_offerings co ON te.offering_id = co.id
JOIN subjects s ON co.subject_id = s.id
LEFT JOIN faculty f ON co.faculty_id = f.id
LEFT JOIN rooms r ON COALESCE(te.room_id, co.default_room_id) = r.id
WHERE tv.batch_id = '<batch_uuid>'
  AND tv.status = 'published'
ORDER BY te.day_of_week, te.start_time;
```

### Get Draft Timetable Events
```sql
SELECT *
FROM timetable_events te
WHERE te.version_id = (
  SELECT id FROM timetable_versions
  WHERE batch_id = '<batch_uuid>' AND status = 'draft'
  LIMIT 1
);
```

---

## 🚨 Important Schema Notes

### 1. Unique Constraints Enable Upsert
```sql
-- timetable_events UNIQUE (version_id, day_of_week, start_time)
-- Allows paint workflow:
INSERT INTO timetable_events (version_id, offering_id, day_of_week, start_time, ...)
VALUES (...)
ON CONFLICT (version_id, day_of_week, start_time)
DO UPDATE SET offering_id = EXCLUDED.offering_id, ...;
```

### 2. ON DELETE CASCADE vs SET NULL
- **CASCADE:** Delete children (timetable_events when version deleted)
- **SET NULL:** Keep children, nullify reference (subjects when department deleted)

**Design Decision:** Timetable data tied to version lifecycle, but subjects survive department deletion

### 3. Check Constraints
```sql
CHECK (day_of_week BETWEEN 0 AND 6)
CHECK (end_time > start_time)
CHECK (type IN ('LECTURE', 'LAB', 'TUTORIAL'))
```

**Purpose:** Database-level validation (defense in depth)

### 4. JSONB Performance
- Indexed with GIN indexes (future)
- Queryable with `->>` and `@>` operators
- Flexible for evolving schemas (period templates, calendar)

---

**Related Docs:**
- [Architecture Overview](/hajri-admin/ARCHITECTURE)
- [Workflows & Features](/hajri-admin/WORKFLOWS)
- [Deployment Roadmap](/hajri-admin/ROADMAP)
