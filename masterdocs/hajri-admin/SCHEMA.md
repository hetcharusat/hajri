# HAJRI Database Schema Reference

> **Last Updated:** January 4, 2026  
> **Database:** Supabase PostgreSQL  
> **Version:** 3.0 (Complete Hierarchy + Attendance Engine)

---

## 📋 Table of Contents

1. [Quick Reference](#quick-reference)
2. [Entity Relationships](#entity-relationships)
3. [Core Tables](#core-tables)
4. [Academic Hierarchy](#academic-hierarchy)
5. [Timetable System](#timetable-system)
6. [Calendar System](#calendar-system)
7. [Attendance Engine](#attendance-engine)
8. [Mobile App Tables](#mobile-app-tables)
9. [Authentication & Users](#authentication--users)
10. [Indexes & Performance](#indexes--performance)
11. [Common Queries](#common-queries)
12. [Known Issues & Limitations](#known-issues--limitations)

---

## Quick Reference

### All Tables (40 tables)

| Category | Tables |
|----------|--------|
| **Auth** | `users`, `admin_users`, `app_users` |
| **Hierarchy** | `departments`, `branches`, `semesters`, `classes`, `batches` |
| **Subjects** | `subjects`, `subject_components`, `elective_groups`, `student_electives` |
| **Faculty** | `faculty`, `faculty_constraints`, `semester_faculty` |
| **Rooms** | `rooms` |
| **Timetable** | `timetable_versions`, `timetable_events`, `timetable_entries` (legacy), `course_offerings`, `offering_teachers`, `period_templates`, `periods`, `event_batches`, `event_rooms`, `batch_groups`, `batch_group_members` |
| **Calendar** | `academic_years`, `academic_calendar`, `calendar_events`, `vacation_periods`, `exam_periods`, `teaching_periods`, `weekly_off_days` |
| **Attendance** | `students`, `ocr_snapshots`, `manual_attendance`, `attendance_summary`, `attendance_predictions`, `semester_subject_totals`, `engine_computation_log` |
| **Mapping** | `subject_code_mappings` |
| **Backup** | `student_backups`, `user_backups` |

### Production URLs

| Service | URL |
|---------|-----|
| **Hub** | https://hajri.onrender.com |
| **Database Admin** | https://hajriadmin.vercel.app |
| **Engine Admin** | https://hajriengine.vercel.app |
| **Engine API** | https://hajri-x8ag.onrender.com/engine |
| **OCR API** | https://hajri.onrender.com |
| **Documentation** | https://hajridocs.vercel.app |
| **Supabase** | https://etmlimraemfdpvrsgdpk.supabase.co |

---

## Entity Relationships

### Complete ERD

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ACADEMIC HIERARCHY                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌─────────┐
│  │departments │───►│ branches   │───►│ semesters  │───►│  classes   │───►│ batches │
│  └────────────┘    └────────────┘    └─────┬──────┘    └────────────┘    └────┬────┘
│                                            │                                   │
│                                            ▼                                   │
│                                      ┌────────────┐                            │
│                                      │  subjects  │                            │
│                                      └─────┬──────┘                            │
│                                            │                                   │
├────────────────────────────────────────────┼───────────────────────────────────┤
│                           TIMETABLE SYSTEM │                                   │
├────────────────────────────────────────────┼───────────────────────────────────┤
│                                            ▼                                   │
│  ┌─────────────────┐              ┌─────────────────┐                          │
│  │course_offerings │◄─────────────│timetable_events │                          │
│  │(subject+batch+  │              │(day/time/room)  │                          │
│  │ faculty)        │              └────────┬────────┘                          │
│  └─────────────────┘                       │                                   │
│                                            ▼                                   │
│                                   ┌─────────────────┐                          │
│                                   │timetable_versions│◄────────────────────────┘
│                                   │(draft/published) │
│                                   └─────────────────┘
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                           ATTENDANCE ENGINE                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐     ┌───────────────┐     ┌──────────────────┐                    │
│  │ students │────►│ ocr_snapshots │────►│ attendance_summary│                   │
│  └──────────┘     └───────────────┘     └──────────────────┘                    │
│       │                  │                       │                              │
│       │                  ▼                       ▼                              │
│       │           ┌──────────────────┐   ┌─────────────────────┐               │
│       └──────────►│manual_attendance │   │attendance_predictions│               │
│                   └──────────────────┘   └─────────────────────┘               │
│                                                                                  │
│  ┌────────────────────────┐     ┌─────────────────────┐                         │
│  │semester_subject_totals │     │engine_computation_log│                        │
│  │(pre-calculated totals) │     │(audit trail)         │                        │
│  └────────────────────────┘     └─────────────────────┘                         │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                           CALENDAR SYSTEM                                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────┐                                                              │
│  │ academic_years │──┬──►calendar_events (holidays)                             │
│  └────────────────┘  ├──►vacation_periods                                       │
│                      ├──►exam_periods                                            │
│                      ├──►teaching_periods                                        │
│                      └──►weekly_off_days (Sundays, Saturdays pattern)           │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### 1. `users`

Admin access control, linked to Supabase Auth.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, references `auth.users` |
| `email` | TEXT | User's email (unique) |
| `is_admin` | BOOLEAN | **Critical**: Controls admin panel access |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated |

**Usage in Apps:**
- Admin Portal: Check `is_admin = true` for access
- Engine Admin: Same check via `useAuthStore`
- Auto-created by trigger on `auth.users` insert

**RLS Policies:**
- Users can read their own row
- Only superadmins can update `is_admin`

---

### 2. `admin_users`

Simple email whitelist for admin access (legacy, use `users.is_admin` instead).

```sql
CREATE TABLE admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 3. `app_users`

Mobile app user profiles linked to students.

```sql
CREATE TABLE app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  student_id UUID REFERENCES students(id),
  current_batch_id UUID REFERENCES batches(id),
  current_semester_id UUID REFERENCES semesters(id),
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Auth user ID |
| `student_id` | UUID | Link to `students` table |
| `current_batch_id` | UUID | Student's current batch |
| `current_semester_id` | UUID | Current semester |
| `preferences` | JSONB | App preferences (theme, notifications, etc.) |
| `is_active` | BOOLEAN | Account active status |

**Mobile App Usage:**
```javascript
// Get current user's student profile
const { data } = await supabase
  .from('app_users')
  .select('*, students(*), batches(*), semesters(*)')
  .eq('id', user.id)
  .single();
```

---

## Academic Hierarchy

### 4. `departments`

Top-level organizational unit (e.g., "DEPSTAR", "CSPIT").

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Example Data:**
| id | name |
|----|------|
| uuid-1 | DEPSTAR |
| uuid-2 | CSPIT |

---

### 5. `branches`

Programs within a department (e.g., "Computer Engineering").

```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `name` | TEXT | Full name (e.g., "Computer Engineering") |
| `abbreviation` | TEXT | Short form (e.g., "CE") |
| `department_id` | UUID | Parent department |

**Example Data:**
| name | abbreviation | department |
|------|--------------|------------|
| Computer Engineering | CE | DEPSTAR |
| Information Technology | IT | DEPSTAR |

---

### 6. `semesters`

Semester instances per branch (1-8).

```sql
CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `branch_id` | UUID | Parent branch |
| `semester_number` | INTEGER | 1-8 |
| `start_date` | DATE | Semester start |
| `end_date` | DATE | Semester end |

**Important:** `start_date` and `end_date` are used by the attendance engine to calculate teaching days.

---

### 7. `classes`

Multiple classes per semester (Class 1, Class 2, etc.).

```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  class_number INTEGER NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `semester_id` | UUID | Parent semester |
| `class_number` | INTEGER | 1, 2, 3, etc. |
| `name` | TEXT | Display name (e.g., "3CE1") - auto-generated |

**Name Format:** `{semester_number}{branch_abbr}{class_number}` = "3CE1"

---

### 8. `batches`

Sections within a class (A, B, C...).

```sql
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id),
  batch_letter TEXT NOT NULL CHECK (batch_letter ~ '^[A-Z]$'),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `class_id` | UUID | Parent class |
| `batch_letter` | TEXT | Single letter A-Z |
| `name` | TEXT | Display name (e.g., "3CE1-A") - auto-generated |

**Constraint:** `batch_letter` must be exactly one uppercase letter.

**Critical for Mobile App:** Batches are the primary unit for:
- Timetable display
- Attendance tracking
- Student grouping

---

## Timetable System

### 9. `subjects`

Courses/subjects taught in a semester.

```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  abbreviation TEXT,  -- Short name for OCR matching (e.g., "EM-I")
  credits INTEGER DEFAULT 3,
  type TEXT DEFAULT 'LECTURE' CHECK (type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  is_elective BOOLEAN DEFAULT false,
  elective_group_id UUID REFERENCES elective_groups(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `code` | TEXT | Subject code (e.g., "MSUD102") |
| `name` | TEXT | Full name (e.g., "Engineering Mathematics II") |
| `abbreviation` | TEXT | Short name for OCR matching (e.g., "EM-II") |
| `type` | TEXT | LECTURE, LAB, or TUTORIAL |
| `is_elective` | BOOLEAN | True for elective subjects |
| `elective_group_id` | UUID | Links electives that share a slot |

**Subject Types:**
- `LECTURE` - Theory classes (default)
- `LAB` - Practical sessions
- `TUTORIAL` - Discussion/problem-solving

**OCR Integration:**
The `abbreviation` field is used by hajri-ocr to match subjects during attendance extraction. See [hajri-ocr/OVERVIEW.md](../hajri-ocr/OVERVIEW.md) for sync details.

---

### 10. `subject_components`

Breaking subjects into multiple teaching components.

```sql
CREATE TABLE subject_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  component_type TEXT NOT NULL CHECK (component_type IN 
    ('LECTURE', 'LAB', 'TUTORIAL', 'PRACTICAL', 'SEMINAR')),
  default_duration_minutes INTEGER DEFAULT 60,
  credits_portion NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Use Case:** A subject with both lecture and lab:
```
MSUD102 (6 credits total)
  ├── LECTURE component (4 credits)
  └── LAB component (2 credits)
```

---

### 11. `elective_groups`

Groups electives that share the same timetable slot.

```sql
CREATE TABLE elective_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**How It Works:**
1. Create elective group (e.g., "Professional Elective 1")
2. Link multiple subjects to this group via `subjects.elective_group_id`
3. These subjects can occupy the same timetable slot
4. Students choose one via `student_electives`

---

### 12. `student_electives`

Tracks which elective each student chose.

```sql
CREATE TABLE student_electives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  elective_group_id UUID NOT NULL REFERENCES elective_groups(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, elective_group_id)
);
```

**Constraint:** One choice per elective group per student.

**Mobile App Query:**
```javascript
// Get student's elective choices
const { data } = await supabase
  .from('student_electives')
  .select('*, subjects(*), elective_groups(*)')
  .eq('student_id', studentId);
```

---

### 13. `faculty`

Teaching staff.

```sql
CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  abbr TEXT,
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `name` | TEXT | Full name |
| `email` | TEXT | Email (unique) |
| `abbr` | TEXT | Abbreviation for timetable display (e.g., "JVP") |
| `department_id` | UUID | Faculty's department |

---

### 14. `faculty_constraints`

Faculty availability and preferences.

```sql
CREATE TABLE faculty_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL UNIQUE REFERENCES faculty(id),
  max_hours_per_week INTEGER,
  max_hours_per_day INTEGER,
  unavailable_periods JSONB,
  preferred_periods JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**JSONB Format for `unavailable_periods`:**
```json
{
  "monday": [1, 2],
  "tuesday": [5, 6, 7]
}
```

---

### 15. `semester_faculty`

Faculty assigned to teach in a semester.

```sql
CREATE TABLE semester_faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  faculty_id UUID NOT NULL REFERENCES faculty(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 16. `rooms`

Classrooms and labs.

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id),
  capacity INTEGER,
  type TEXT DEFAULT 'CLASSROOM' CHECK (type IN ('CLASSROOM', 'LAB', 'HALL')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `room_number` | TEXT | Room identifier (e.g., "CE-301") |
| `capacity` | INTEGER | Seating capacity |
| `type` | TEXT | CLASSROOM, LAB, or HALL |

---

### 17. `course_offerings`

**The schedulable unit** - links subject + batch + faculty.

```sql
CREATE TABLE course_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  faculty_id UUID REFERENCES faculty(id),
  default_room_id UUID REFERENCES rooms(id),
  component_id UUID REFERENCES subject_components(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `subject_id` | UUID | What is being taught |
| `batch_id` | UUID | Who is being taught |
| `faculty_id` | UUID | Who is teaching |
| `default_room_id` | UUID | Default classroom |
| `component_id` | UUID | Which component (lecture/lab) |

**Creating a Course Offering:**
```javascript
const { data } = await supabase
  .from('course_offerings')
  .insert({
    subject_id: subjectId,
    batch_id: batchId,
    faculty_id: facultyId
  });
```

---

### 18. `offering_teachers`

Multiple teachers per offering (team teaching).

```sql
CREATE TABLE offering_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES course_offerings(id),
  faculty_id UUID NOT NULL REFERENCES faculty(id),
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 19. `timetable_versions`

Version control for timetables (draft → published → archived).

```sql
CREATE TABLE timetable_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id),
  status timetable_version_status NOT NULL DEFAULT 'draft',
  name TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Status Enum:**
- `draft` - Being edited
- `published` - Active, visible to students
- `archived` - Old version, kept for history

**Critical Rule:** Only ONE published version per batch at a time.

---

### 20. `timetable_events`

Individual timetable cells/slots.

```sql
CREATE TABLE timetable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES timetable_versions(id),
  offering_id UUID NOT NULL REFERENCES course_offerings(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id UUID REFERENCES rooms(id),
  period_id UUID REFERENCES periods(id),
  component_type TEXT CHECK (component_type IN 
    ('LECTURE', 'LAB', 'TUTORIAL', 'PRACTICAL', 'SEMINAR')),
  elective_group_id UUID REFERENCES elective_groups(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `version_id` | UUID | Parent timetable version |
| `offering_id` | UUID | Course offering being scheduled |
| `day_of_week` | INTEGER | 0=Monday, 1=Tuesday, ..., 6=Sunday |
| `start_time` | TIME | Slot start (e.g., "09:00") |
| `end_time` | TIME | Slot end (e.g., "10:00") |
| `room_id` | UUID | Room override (optional) |
| `component_type` | TEXT | Overrides subject type if set |
| `elective_group_id` | UUID | For elective slot stacking |

**Mobile App - Get Timetable:**
```javascript
// Get published timetable for a batch
const { data } = await supabase
  .from('timetable_events')
  .select(`
    *,
    course_offerings (
      *,
      subjects (*),
      faculty (*)
    ),
    rooms (*)
  `)
  .eq('version_id', publishedVersionId)
  .order('day_of_week')
  .order('start_time');
```

---

### 21. `period_templates`

Reusable period/slot definitions.

```sql
CREATE TABLE period_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  slots JSONB NOT NULL DEFAULT '[]',
  branch_id UUID REFERENCES branches(id),
  semester_id UUID REFERENCES semesters(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**`slots` JSONB Format:**
```json
[
  {"number": 1, "name": "Period 1", "start": "09:00", "end": "10:00", "isBreak": false},
  {"number": 2, "name": "Period 2", "start": "10:00", "end": "11:00", "isBreak": false},
  {"number": 3, "name": "Break", "start": "11:00", "end": "11:15", "isBreak": true},
  {"number": 4, "name": "Period 3", "start": "11:15", "end": "12:15", "isBreak": false}
]
```

---

### 22. `periods`

Individual period definitions (alternative to JSONB slots).

```sql
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES period_templates(id),
  period_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN DEFAULT false,
  day_of_week INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 23-26. Junction Tables

**`event_batches`** - Multiple batches per event (combined classes):
```sql
CREATE TABLE event_batches (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES timetable_events(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`event_rooms`** - Multiple rooms per event:
```sql
CREATE TABLE event_rooms (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES timetable_events(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`batch_groups`** - Named groups of batches:
```sql
CREATE TABLE batch_groups (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`batch_group_members`** - Batches in a group:
```sql
CREATE TABLE batch_group_members (
  id UUID PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES batch_groups(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Calendar System

### 27. `academic_years`

Academic year definitions.

```sql
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  institution TEXT DEFAULT 'CHARUSAT',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `name` | TEXT | e.g., "2025-26" |
| `start_date` | DATE | Academic year start |
| `end_date` | DATE | Academic year end |
| `is_current` | BOOLEAN | Mark current year |

---

### 28. `academic_calendar`

Full calendar as JSONB (legacy, prefer individual tables).

```sql
CREATE TABLE academic_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  payload JSONB NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 29. `calendar_events`

Individual holidays and events.

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id),
  event_date DATE NOT NULL,
  end_date DATE,
  event_type TEXT NOT NULL CHECK (event_type IN 
    ('holiday', 'academic', 'college_event', 'exam', 'vacation')),
  title TEXT NOT NULL,
  description TEXT,
  is_non_teaching BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `event_date` | DATE | Start date |
| `end_date` | DATE | End date (for multi-day events) |
| `event_type` | TEXT | Category of event |
| `title` | TEXT | Event name (e.g., "Republic Day") |
| `is_non_teaching` | BOOLEAN | **Critical:** If true, no classes this day |

**⚠️ Important:** Use `title` not `name` - column is named `title`.

**Event Types:**
- `holiday` - National/state holidays
- `academic` - Academic events (orientation, etc.)
- `college_event` - College functions
- `exam` - Exam days
- `vacation` - Vacation periods

---

### 30. `vacation_periods`

Extended vacation periods.

```sql
CREATE TABLE vacation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'students', 'employees')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Examples:**
- Diwali Vacation (Oct 25 - Nov 5)
- Winter Break (Dec 25 - Jan 1)
- Summer Vacation (May 1 - June 15)

---

### 31. `exam_periods`

Examination periods (teaching suspended).

```sql
CREATE TABLE exam_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id),
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('regular', 'remedial', 'supplementary')),
  semester_type TEXT NOT NULL CHECK (semester_type IN ('odd', 'even')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 32. `teaching_periods`

Active teaching windows.

```sql
CREATE TABLE teaching_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id),
  name TEXT NOT NULL,
  semester_type TEXT NOT NULL CHECK (semester_type IN ('odd', 'even')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 33. `weekly_off_days`

Weekly holidays configuration.

```sql
CREATE TABLE weekly_off_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_off BOOLEAN DEFAULT true,
  saturday_pattern TEXT CHECK (saturday_pattern IN 
    ('all', '1st_3rd', '2nd_4th', 'none', 'odd', 'even')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `day_of_week` | INTEGER | 0=Mon, 6=Sun |
| `is_off` | BOOLEAN | True if this day is off |
| `saturday_pattern` | TEXT | Which Saturdays are off |

**Saturday Patterns:**
- `all` - Every Saturday off
- `1st_3rd` - 1st and 3rd Saturdays off
- `2nd_4th` - 2nd and 4th Saturdays off
- `none` - No Saturdays off
- `odd` - Odd-numbered Saturdays off
- `even` - Even-numbered Saturdays off

---

## Attendance Engine

### 34. `students`

Student records.

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  batch_id UUID REFERENCES batches(id),
  enrollment_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `roll_number` | TEXT | Unique ID (e.g., "22CE001") |
| `name` | TEXT | Full name |
| `email` | TEXT | Email (unique, optional) |
| `batch_id` | UUID | Current batch |
| `enrollment_year` | INTEGER | Year of admission |

---

### 35. `ocr_snapshots`

OCR-captured attendance baselines.

```sql
CREATE TABLE ocr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  captured_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  source_type TEXT DEFAULT 'university_portal',
  entries JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`entries` JSONB Format:**
```json
[
  {
    "subject_code": "MSUD102",
    "subject_name": "Engineering Mathematics II",
    "class_type": "LECTURE",
    "present": 45,
    "total": 50
  },
  {
    "subject_code": "CSUC101",
    "subject_name": "Digital Electronics",
    "class_type": "LAB",
    "present": 12,
    "total": 14
  }
]
```

**Critical:** Snapshots are **immutable** - the baseline for attendance tracking.

---

### 36. `manual_attendance`

User-added attendance after snapshot.

```sql
CREATE TABLE manual_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  snapshot_id UUID NOT NULL REFERENCES ocr_snapshots(id),
  event_date DATE NOT NULL,
  class_type TEXT NOT NULL CHECK (class_type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  period_slot INTEGER,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'CANCELLED')),
  timetable_event_id UUID REFERENCES timetable_events(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `snapshot_id` | UUID | Must reference a snapshot |
| `event_date` | DATE | Date of the class |
| `status` | TEXT | PRESENT, ABSENT, or CANCELLED |

**⚠️ Critical Rule:** Cannot add entries for dates ON or BEFORE snapshot date. This is the **snapshot lock rule**.

---

### 37. `attendance_summary`

Computed attendance per subject per student.

```sql
CREATE TABLE attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  class_type TEXT NOT NULL CHECK (class_type IN ('LECTURE', 'LAB', 'TUTORIAL', 'ALL')),
  snapshot_id UUID REFERENCES ocr_snapshots(id),
  snapshot_at TIMESTAMPTZ,
  snapshot_present INTEGER DEFAULT 0,
  snapshot_total INTEGER DEFAULT 0,
  manual_present INTEGER DEFAULT 0,
  manual_absent INTEGER DEFAULT 0,
  manual_total INTEGER DEFAULT 0,
  current_present INTEGER DEFAULT 0,
  current_total INTEGER DEFAULT 0,
  current_percentage NUMERIC DEFAULT 0.00,
  last_recomputed_at TIMESTAMPTZ DEFAULT now()
);
```

**Calculation Formula:**
```
current_present = snapshot_present + manual_present
current_total = snapshot_total + manual_total
current_percentage = (current_present / current_total) * 100
```

---

### 38. `attendance_predictions`

Prediction data for each subject.

```sql
CREATE TABLE attendance_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  current_present INTEGER DEFAULT 0,
  current_total INTEGER DEFAULT 0,
  current_percentage NUMERIC DEFAULT 0.00,
  required_percentage NUMERIC DEFAULT 75.00,
  remaining_classes INTEGER DEFAULT 0,
  semester_end_date DATE,
  must_attend INTEGER DEFAULT 0,
  can_bunk INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('SAFE', 'WARNING', 'DANGER', 'CRITICAL')),
  prediction_computed_at TIMESTAMPTZ DEFAULT now()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `remaining_classes` | INTEGER | Classes left in semester |
| `must_attend` | INTEGER | Minimum to attend for 75% |
| `can_bunk` | INTEGER | Classes you can safely skip |
| `status` | TEXT | SAFE/WARNING/DANGER/CRITICAL |

**Status Thresholds:**
- `SAFE` - ≥85% - Can miss some classes
- `WARNING` - 75-85% - Be careful
- `DANGER` - 65-75% - Attend all classes
- `CRITICAL` - <65% - Risk of detention

---

### 39. `semester_subject_totals`

Pre-calculated total classes per subject.

```sql
CREATE TABLE semester_subject_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id),
  semester_id UUID NOT NULL REFERENCES semesters(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  class_type TEXT NOT NULL CHECK (class_type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  slots_per_week INTEGER DEFAULT 0,
  total_classes_in_semester INTEGER DEFAULT 0,
  calculation_details JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**`calculation_details` JSONB:**
```json
{
  "semester_start": "2025-12-29",
  "semester_end": "2026-04-10",
  "total_calendar_days": 103,
  "teaching_weeks": 14,
  "non_teaching_days_excluded": 25,
  "teaching_days_by_weekday": {"0": 14, "1": 15, ...},
  "formula": "6 slots/week across 14 weeks, excluding 25 non-teaching days",
  "non_teaching_breakdown": {
    "sundays_count": 14,
    "saturdays_count": 7,
    "saturday_pattern": "1st_3rd",
    "holidays": [
      {"name": "Republic Day", "start_date": "2026-01-26", "type": "holiday"}
    ],
    "vacations": [],
    "exams": []
  }
}
```

---

### 40. `engine_computation_log`

Audit trail for engine operations.

```sql
CREATE TABLE engine_computation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN 
    ('SNAPSHOT_CONFIRM', 'MANUAL_ENTRY', 'FORCE_RECOMPUTE', 'CALENDAR_UPDATE')),
  trigger_id UUID,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
  subjects_updated INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 41. `subject_code_mappings`

Maps OCR-detected codes to database subjects.

```sql
CREATE TABLE subject_code_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_code TEXT NOT NULL,
  ocr_name TEXT,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  batch_id UUID REFERENCES batches(id),
  semester_id UUID REFERENCES semesters(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Use Case:** University portal shows "CS-101" but database has "CSUC101".

---

## Mobile App Tables

### 42. `student_backups`

Backup of student data.

```sql
CREATE TABLE student_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  backup_data JSONB NOT NULL,
  backup_timestamp TIMESTAMPTZ DEFAULT now(),
  device_info JSONB
);
```

### 43. `user_backups`

General user data backups.

```sql
CREATE TABLE user_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  backup_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Legacy Tables

### `timetable_entries`

**⚠️ DEPRECATED** - Use `timetable_events` + `course_offerings` instead.

```sql
CREATE TABLE timetable_entries (
  id UUID PRIMARY KEY,
  subject_id UUID REFERENCES subjects(id),
  faculty_id UUID REFERENCES faculty(id),
  room_id UUID REFERENCES rooms(id),
  batch_id UUID REFERENCES batches(id),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Indexes & Performance

### Recommended Indexes

```sql
-- Attendance queries
CREATE INDEX idx_attendance_summary_student ON attendance_summary(student_id);
CREATE INDEX idx_attendance_summary_batch ON attendance_summary(batch_id);
CREATE INDEX idx_manual_attendance_student_date ON manual_attendance(student_id, event_date);

-- Timetable queries
CREATE INDEX idx_timetable_events_version ON timetable_events(version_id);
CREATE INDEX idx_timetable_events_day ON timetable_events(day_of_week);
CREATE INDEX idx_course_offerings_batch ON course_offerings(batch_id);

-- Hierarchy lookups
CREATE INDEX idx_subjects_semester ON subjects(semester_id);
CREATE INDEX idx_classes_semester ON classes(semester_id);
CREATE INDEX idx_batches_class ON batches(class_id);

-- Calendar queries
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_events_year ON calendar_events(academic_year_id);
```

---

## Common Queries

### Get Student's Full Context

```javascript
const { data } = await supabase
  .from('students')
  .select(`
    *,
    batches (
      *,
      classes (
        *,
        semesters (
          *,
          branches (
            *,
            departments (*)
          )
        )
      )
    )
  `)
  .eq('id', studentId)
  .single();
```

### Get Published Timetable

```javascript
// First get the published version
const { data: version } = await supabase
  .from('timetable_versions')
  .select('id')
  .eq('batch_id', batchId)
  .eq('status', 'published')
  .single();

// Then get events
const { data: events } = await supabase
  .from('timetable_events')
  .select(`
    *,
    course_offerings (
      *,
      subjects (*),
      faculty (*)
    ),
    rooms (*)
  `)
  .eq('version_id', version.id)
  .order('day_of_week')
  .order('start_time');
```

### Get Attendance Summary

```javascript
const { data } = await supabase
  .from('attendance_summary')
  .select(`
    *,
    subjects (code, name, type)
  `)
  .eq('student_id', studentId)
  .eq('batch_id', batchId);
```

### Get Teaching Days Count

```javascript
// Call the engine API instead of direct DB
const response = await fetch(
  `${ENGINE_URL}/test/calculate-semester-totals?batch_id=${batchId}&semester_id=${semesterId}`,
  { method: 'POST' }
);
```

---

## Known Issues & Limitations

### 1. Column Naming Inconsistencies

| Table | Issue | Solution |
|-------|-------|----------|
| `calendar_events` | Uses `title` not `name` | Use `title` in queries |
| `semester_subject_totals` | No `teaching_weeks` column | Stored in `calculation_details` JSONB |

### 2. RLS Policy Requirements

- Users must exist in `users` table with `is_admin = true` for admin access
- New auth users get auto-inserted via trigger, but `is_admin` defaults to `false`
- Students need `app_users` row linked to `students` table

### 3. Timetable Version Constraints

- Only one `published` version per batch
- Publishing a new version should archive the old one
- Deleting a version cascades to all its events

### 4. Saturday Pattern Edge Cases

- `1st_3rd` pattern: Calculates based on calendar month
- If a holiday falls on a Saturday, it's excluded regardless of pattern

### 5. Snapshot Lock Rule

- Cannot modify attendance for dates ≤ snapshot date
- Snapshot is immutable once created
- To "fix" old data, must create a new snapshot

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | Jan 4, 2026 | Full documentation refresh, added all 43 tables |
| 2.0 | Dec 2025 | Added offerings model, timetable versioning |
| 1.0 | Nov 2025 | Initial schema |

---

## Related Documentation

- [API Reference](../hajri-engine/API.md) - Engine API endpoints
- [Mobile App Guide](../hajri-engine/MOBILE_APP.md) - Integration guide
- [Authentication](./OAUTH.md) - OAuth setup
- [Deployment](./DEPLOYMENT.md) - Production deployment
