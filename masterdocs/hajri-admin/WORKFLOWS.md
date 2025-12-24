# Hajri Admin Portal - User Workflows & Features

**Purpose:** Step-by-step user journeys and feature documentation  
**Audience:** New developers, QA testers, product owners

---

## At a Glance

**Prerequisites**
- Schema deployed: run `hajri-admin/CLEAN-SCHEMA.sql` in Supabase.
- At least one admin user (`users.is_admin=true`).

**Shortest happy path (current)**
1. Ensure at least one `departments` row exists (see note below)
2. Use Tree Explorer + `/app/overview` to create branch → semester → class → batch
3. With a semester selected: add subjects (`/app/subjects`)
4. Add faculty (`/app/faculty`) and rooms (`/app/rooms`)
5. With a class selected: assign subjects → faculty/room (`/app/assignments`)
6. With a batch selected: build timetable draft via drag & drop (`/app/timetable`)
7. Publish timetable (draft → published; old published → archived)

**Where to look for why**
- Data model: /hajri-admin/SCHEMA_V2
- App internals: /hajri-admin/ARCHITECTURE

**Common pitfalls**
- If you can't click a top tab: your Tree scope isn't deep enough (semester/class/batch required).
- If the timetable palette is empty, offerings likely aren’t created yet.
- If you can’t access pages, your user is not an admin.

---

## 🎯 Core User Roles

### 1. **Admin** (Primary User)
- Full access to all features
- Manages departments, faculty, subjects, students, batches
- Creates course offerings
- Builds and publishes timetables
- Controls user access (Settings)

### 2. **Student** (Future/Mobile App)
- Read-only access to published timetables
- View subjects for their batch
- (Future: Attendance tracking)

---

## 🚀 Getting Started

### First Login (Admin)
1. Navigate to `https://<app-url>/login`
2. Click "Sign in with Google"
3. Authorize Google OAuth
4. Auto-redirected to Dashboard
5. **Initial State:** Not admin yet (shows "Access Denied")

### Admin Setup (First User)
1. Open Supabase SQL Editor
2. Run:
   ```sql
   UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
   ```
3. Refresh app → Full access granted

### Subsequent Admins
1. First admin logs into Settings page
2. Toggles `is_admin` for other users
3. Users refresh → Gain admin access

---

## 📚 Feature Workflows

### A. Structure (Department → Branch → Semester → Class → Batch)

**Pages:** Tree Explorer (left sidebar) + `/app/overview`

**Notes / current limitation**
- The UI currently supports creating **branch/semester/class/batch** from `/app/overview`.
- Creating the very first **department** may require inserting it directly in Supabase (the sidebar “Add Department” action is not wired).

**Workflow: create the hierarchy**
1. In Supabase, ensure at least one row exists in `departments`.
2. Open `/app/overview` and select a department in the Tree Explorer.
3. Click **Create Branch** → enter name + abbreviation.
4. Select the branch → click **Create Semester** → enter semester number (+ optional dates).
5. Select the semester → click **Create Class** (class number).
6. Select the class → click **Create Batch** (batch letter).

---

### B. Subject Management

**Page:** `/app/subjects` (requires a **Semester** selected in Tree Explorer)

**Workflow**
1. Select a semester node in the Tree Explorer.
2. Open `/app/subjects`.
3. Create subjects (code/name/type/credits). Subjects are scoped to that semester.

---

### C. Faculty Management

**Page:** `/app/faculty` (requires a **Semester** selected in Tree Explorer)

**Workflow**
1. Select a semester node.
2. Open `/app/faculty`.
3. Add/edit/delete faculty (includes optional `abbr`).

---

### D. Room Management

**Page:** `/app/rooms`

Rooms are global and can be used as default rooms in assignments and displayed in timetables.

---

### E. Period Templates

**Page:** `/app/period-templates`

Define the day slot structure used by the timetable editor.

---

### F. Assignments (Offerings)

**Page:** `/app/assignments` (requires a **Class** selected in Tree Explorer)

**What it does**
- Creates/updates `course_offerings` for each batch under the selected class.
- An offering is still the schedulable unit used by timetable events.

---

### G. Timetable Editor

**Page:** `/app/timetable` (requires a **Batch** selected in Tree Explorer)

**Workflow**
1. Select a batch node.
2. Open `/app/timetable`.
3. Drag an offering from the left list and drop it onto a cell.
4. Edit or delete individual cells/events as needed.
5. Publish when ready (draft → published; old published → archived).

---

### H. Settings & User Management

**Page:** `/settings`

1. View all users via `get_all_users()` (admin-only).
2. Toggle `is_admin` for other users (self-toggle is blocked).

---

## 🔄 Typical Admin Workflow (Full Cycle)

1. Ensure at least one department exists (seed via Supabase if needed).
2. Build the hierarchy in `/app/overview` using the Tree Explorer.
3. Select semester → create subjects (`/app/subjects`).
4. Add faculty and rooms (`/app/faculty`, `/app/rooms`).
5. Select class → set assignments (`/app/assignments`).
6. Select batch → build & publish timetable (`/app/timetable`).

---

**Related Docs:**
- [Architecture Details](/hajri-admin/ARCHITECTURE)
- [Schema Reference](/hajri-admin/SCHEMA_V2)
- [Development Roadmap](/hajri-admin/ROADMAP)
