# Database Schema - Current Reference

**Last Updated:** December 25, 2025  
**Schema File:** `hajri-admin/CLEAN-SCHEMA.sql`  
**Purpose:** Authoritative clean-install schema for Hajri Admin Portal (V3 hierarchy + offerings/timetable)

---

## At a Glance

**What this doc is**
- The current Postgres schema reference used by the Admin Portal.

**Where the truth lives**
- `hajri-admin/CLEAN-SCHEMA.sql` (this doc describes it).

**How to deploy**
- Supabase → SQL Editor → run `hajri-admin/CLEAN-SCHEMA.sql` (destructive).

**Key app tables**
- `departments` → `branches` → `semesters` → `classes` → `batches` (scope hierarchy)
- `course_offerings`: schedulable teaching unit (subject+batch+faculty).
- `timetable_versions`: per-batch draft/published/archived lifecycle.
- `timetable_events`: grid cells referencing offerings.
- `period_templates`: JSON timeslots (used by editor grid).
- `academic_years` → `calendar_events`, `vacation_periods`, `exam_periods`, `teaching_periods`, `weekly_off_days` (calendar system)

**Required columns for current UI**
- `classes.name` (auto-name like `3CE1`)
- `batches.name` (auto-name like `3CE1-A`)
- `faculty.abbr` (optional, used in dropdown display)

**Key auth table**
- `users`: linked to `auth.users`, controls admin access (`is_admin`).

**Common pitfalls**
- RLS failures often come from missing `users` row or `is_admin=false`.
- Timetable editor requires V2 tables; partial schema deploy breaks the UI.

---

## 🎯 Schema Evolution

### V1 (Legacy)
- Basic entities: departments, subjects, faculty, rooms, batches, students
- Legacy timetable table: `timetable_entries` (removed in V2+)
- No versioning, no offerings concept

### V2
- Offerings model + timetable versioning.

### V3 (Current)
- **Hierarchy:** Department → Branch → Semester → Class → Batch
- **Subjects** belong to a semester (`subjects.semester_id`).
- **Assignments** are offerings for a batch (`course_offerings`).

---

## 📊 Entity Relationship Diagram (ERD)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ departments │──►│  branches    │──►│  semesters   │──►│   classes    │──►│   batches    │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
                     │
                     ▼
┌─────────────┐     ┌─────────────┐                        ┌───────────────┐
│   faculty   │     │   subjects   │                        │ course_offerings│
└─────────────┘     └─────────────┘                        └──────┬────────┘
                     │
                  ┌──────▼──────────┐
                  │ timetable_versions│
                  └──────┬──────────┘
                    │
                  ┌──────▼──────────┐
                  │ timetable_events  │
                  └──────────────────┘
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
**Purpose:** Top-level grouping (often treated as building/location in V3 hierarchy)

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- → `branches.department_id`
- → `rooms.department_id` (optional)

---

#### 3. `branches`
**Purpose:** Program/branch within a department (e.g., Computer Engineering)

```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, department_id)
);
```

**Relationships:**
- → `semesters.branch_id`

---

#### 4. `semesters`
**Purpose:** Semester instances per branch (1–8)

```sql
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
```

**Relationships:**
- → `subjects.semester_id`
- → `classes.semester_id`
- → `elective_groups.semester_id`

---

#### 5. `subjects`
**Purpose:** Courses/subjects taught

```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  credits INTEGER DEFAULT 3,
  type TEXT DEFAULT 'LECTURE' CHECK (type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  is_elective BOOLEAN DEFAULT false,
  elective_group_id UUID REFERENCES elective_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  ,UNIQUE(semester_id, code)
);
```

**Types:**
- `LECTURE` - Theory classes
- `LAB` - Practical sessions
- `TUTORIAL` - Discussion/problem-solving

**Elective Support:**
- `is_elective` - Marks subject as an elective (multiple can share same timeslot)
- `elective_group_id` - Links to an elective group (required for elective stacking)

**Indexes:**
- Unique: `(semester_id, code)`
- `idx_subjects_elective_group(elective_group_id)`

---

#### 5.5. `elective_groups`
**Purpose:** Groups related elective subjects that can share the same timetable slot

```sql
CREATE TABLE elective_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(semester_id, name)
);
```

**Key Points:**
- Multiple elective subjects in the same group can occupy the same timetable slot
- Each elective group belongs to a semester
- Students choose one subject per elective group

**Relationships:**
- ← `subjects.elective_group_id`
- ← `student_electives.elective_group_id`
- → `semesters.id`

---

#### 5.6. `student_electives`
**Purpose:** Tracks which elective subject each student has chosen per group

```sql
CREATE TABLE student_electives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  elective_group_id UUID NOT NULL REFERENCES elective_groups(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, elective_group_id)
);
```

**Key Points:**
- Enforces one choice per elective group per student
- Used by mobile app to filter timetable display to show only chosen electives

---

#### 6. `classes`
**Purpose:** Multiple classes per semester (Class 1, Class 2, etc.)

```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  class_number INTEGER NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(semester_id, class_number)
);
```

---

#### 7. `batches`
**Purpose:** Sections within a class (A, B, C, ...)

```sql
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  batch_letter TEXT NOT NULL CHECK (batch_letter ~ '^[A-Z]$'),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, batch_letter)
);
```

**Notes:**
- `name` is used by the UI for display; it is auto-generated like `2CE1-A` when creating batches.

**Relationships:**
- → `course_offerings.batch_id`
- → `timetable_versions.batch_id`
- → `students.batch_id`

---

#### 8. `faculty`
**Purpose:** Teaching staff

```sql
CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  abbr TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Relationships:**
- → `course_offerings.faculty_id`
- ← `departments.id`

---

#### 9. `rooms`
**Purpose:** Physical classrooms/labs

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
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

#### 10. `students`
**Purpose:** Student records

```sql
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
  elective_group_id UUID REFERENCES elective_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);
```

**Key Constraints:**
- **CHECK(end_time > start_time):** Prevents invalid slots
- **Slot Uniqueness:** Enforced by `validate_timetable_event` trigger (not UNIQUE constraint)

**Elective Stacking Rules (enforced by trigger):**
- Regular subjects: Only one event per slot (version + day + time)
- Elective subjects: Multiple events allowed if ALL share the same `elective_group_id`
- Mixed stacking (regular + elective, or different elective groups) is blocked

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
- `idx_tt_events_elective_group` on `elective_group_id`

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

### Academic Calendar Tables (New - December 2025)

The Academic Calendar system uses **6 tables** for comprehensive attendance calculation support.

**Schema File:** `sql-queries/migrations/03-academic_calendar.sql`  
**Data Import:** `sql-queries/migrations/04-academic_calendar_2025_26_data.sql`  
**UI Page:** `src/pages/AcademicCalendar.jsx`  
**Utility Functions:** `src/lib/calendarUtils.js`

#### 13. `academic_years`
**Purpose:** Academic year definitions (e.g., 2025-26)

```sql
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- "2025-26"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  institution TEXT DEFAULT 'CHARUSAT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date > start_date)
);
```

**Notes:**
- Only one year can be `is_current=true` (enforced by unique partial index)
- All other calendar tables reference this via `academic_year_id`

---

#### 14. `calendar_events`
**Purpose:** Individual holidays, academic events, college events

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  end_date DATE,                       -- For multi-day events
  event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'academic', 'college_event', 'exam', 'vacation')),
  title TEXT NOT NULL,
  description TEXT,
  is_non_teaching BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Event Types:**
- `holiday`: Public holidays (Republic Day, Diwali, etc.)
- `academic`: Academic events (Convocation, Admission deadlines)
- `college_event`: College-specific events (Sports week, Tech fest)
- `exam`: Exam-related dates
- `vacation`: Vacation markers

---

#### 15. `vacation_periods`
**Purpose:** Multi-day vacation blocks

```sql
CREATE TABLE vacation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- "Diwali Vacation"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'students', 'employees')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 16. `exam_periods`
**Purpose:** Exam weeks/periods

```sql
CREATE TABLE exam_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- "Odd Semester Regular Exam"
  exam_type TEXT NOT NULL CHECK (exam_type IN ('regular', 'remedial', 'supplementary')),
  semester_type TEXT NOT NULL CHECK (semester_type IN ('odd', 'even')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 17. `teaching_periods`
**Purpose:** When regular classes are in session

```sql
CREATE TABLE teaching_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- "Odd Semester Teaching"
  semester_type TEXT NOT NULL CHECK (semester_type IN ('odd', 'even')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 18. `weekly_off_days`
**Purpose:** Default weekly off days (Sunday, alternating Saturdays)

```sql
CREATE TABLE weekly_off_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  is_off BOOLEAN DEFAULT true,
  note TEXT,
  UNIQUE(academic_year_id, day_of_week)
);
```

---

### Helper Functions

#### `is_teaching_day(check_date DATE, year_id UUID)`
Returns `BOOLEAN` - whether the given date is a teaching day.

**Logic:**
1. Returns `false` if Sunday
2. Returns `false` if in `weekly_off_days`
3. Returns `false` if holiday with `is_non_teaching=true`
4. Returns `false` if in `vacation_periods`
5. Returns `false` if in `exam_periods`
6. Otherwise returns `true`

#### `count_teaching_days(from_date DATE, to_date DATE, year_id UUID)`
Returns `INTEGER` - count of teaching days in the range.

**Usage in Attendance Calculation:**
```sql
SELECT count_teaching_days('2025-07-21', '2025-11-15', year_id) as total_expected;
```

---

### Legacy Academic Calendar Table

#### `academic_calendar` (DEPRECATED)
**Purpose:** Old single-table approach (replaced by above tables)

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

**Status:** Superseded by the 6-table normalized schema above. Kept for backwards compatibility.

---

### Legacy Tables (Compatibility)

#### 14. `timetable_entries`
**Purpose:** Legacy timetable format (pre-versioning)

**Status:** Not part of the current clean schema and not used by the Admin Portal.

**Current replacement:**
- `timetable_versions` (draft/published lifecycle)
- `timetable_events` (grid cells)

If you have an old database that still contains `timetable_entries`, treat it as legacy data and migrate to the versioned model.

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
- students
- course_offerings, timetable_versions, timetable_events
- period_templates, academic_calendar

### Student Read Access
```sql
-- Subjects
CREATE POLICY "Students read subjects" ON subjects FOR SELECT TO authenticated
  USING (true);

-- Published timetable (current)
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

### 2.5. `validate_timetable_event()`
**Purpose:** Enforce elective stacking rules on timetable events

```sql
CREATE OR REPLACE FUNCTION validate_timetable_event()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_event RECORD;
  v_new_is_elective BOOLEAN;
  v_existing_is_elective BOOLEAN;
BEGIN
  -- Optimization: Skip validation if slot-defining columns haven't changed
  IF TG_OP = 'UPDATE' THEN
    IF NEW.version_id = OLD.version_id AND 
       NEW.day_of_week = OLD.day_of_week AND 
       NEW.start_time = OLD.start_time AND 
       NEW.offering_id = OLD.offering_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Check for existing event at same slot
  SELECT te.id, te.elective_group_id, s.is_elective
  INTO v_existing_event
  FROM timetable_events te
  JOIN course_offerings co ON te.offering_id = co.id
  JOIN subjects s ON co.subject_id = s.id
  WHERE te.version_id = NEW.version_id
    AND te.day_of_week = NEW.day_of_week
    AND te.start_time = NEW.start_time
    AND te.id != COALESCE(NEW.id, '...')
  LIMIT 1;
  
  IF v_existing_event IS NULL THEN RETURN NEW; END IF;
  
  -- Get is_elective for new event
  SELECT s.is_elective INTO v_new_is_elective
  FROM course_offerings co
  JOIN subjects s ON co.subject_id = s.id
  WHERE co.id = NEW.offering_id;
  
  -- Rule: Both must be electives from same group
  IF NOT v_new_is_elective OR NOT v_existing_event.is_elective THEN
    RAISE EXCEPTION 'Cannot place multiple events unless both are electives from same group';
  END IF;
  
  IF v_existing_event.elective_group_id != NEW.elective_group_id THEN
    RAISE EXCEPTION 'Elective subjects must belong to the same group to share a slot';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Trigger:**
```sql
CREATE TRIGGER validate_timetable_event_trigger
  BEFORE INSERT OR UPDATE ON timetable_events
  FOR EACH ROW EXECUTE FUNCTION validate_timetable_event();
```

**Rules Enforced:**
1. Regular subjects: Only one event per slot
2. Elective subjects: Can stack if they share the same `elective_group_id`
3. Mixed stacking (regular + elective) is blocked

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
