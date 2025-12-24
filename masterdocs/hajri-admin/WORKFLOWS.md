# Hajri Admin Portal - User Workflows & Features

**Purpose:** Step-by-step user journeys and feature documentation  
**Audience:** New developers, QA testers, product owners

---

## At a Glance

**Prerequisites**
- Schema deployed (V2): run `hajri-admin/CLEAN-SCHEMA.sql` in Supabase.
- At least one admin user (`users.is_admin=true`).

**Shortest happy path (V2)**
1. Create departments/semesters/subjects/faculty/rooms/batches
2. Create course offerings (subject + batch + faculty + room)
3. Build timetable in Draft (paint → apply)
4. Publish draft (draft → published, old published → archived)

**Where to look for why**
- Data model: /hajri-admin/SCHEMA_V2
- App internals: /hajri-admin/ARCHITECTURE

**Common pitfalls**
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

### A. Department Management

**Page:** `/departments`

#### Create Department
1. Navigate to Departments page
2. Fill form:
   - **Code:** Uppercase acronym (e.g., `CS`)
   - **Name:** Full name (e.g., `Computer Science`)
3. Click "Add Department"
4. Department appears in table immediately

#### Delete Department
1. Find department in table
2. Click trash icon
3. Confirm deletion
4. **Cascade:** All related subjects, batches, students affected

**Use Case:**
- Setup before creating subjects/batches
- Organize academic structure

---

### B. Semester Management

**Page:** `/semesters`

#### Create Semester
1. Navigate to Semesters page
2. Fill form:
   - **Name:** `Semester 1`, `Semester 2`, etc.
   - **Year:** `2025`
   - **Start Date:** First day of semester
   - **End Date:** Last day of semester
   - **Active:** Toggle if currently active
3. Click "Add Semester"

#### Mark Semester Active
1. Find semester in table
2. Toggle "Active" switch
3. **Constraint:** Typically only one active semester at a time (not enforced)

**Use Case:**
- Define academic calendar boundaries
- Filter subjects/batches by semester

---

### C. Subject Management

**Page:** `/subjects`

#### Create Subject
1. Navigate to Subjects page
2. Fill form:
   - **Code:** Unique identifier (e.g., `CS101`)
   - **Name:** Full subject name (e.g., `Data Structures`)
   - **Department:** Select from dropdown
   - **Semester:** Select from dropdown (optional)
   - **Credits:** Number of credits (default: 3)
   - **Type:** `LECTURE`, `LAB`, or `TUTORIAL`
3. Click "Add Subject"

#### Edit Subject
1. Find subject in table
2. Click edit icon
3. Update fields
4. Save changes

**Use Case:**
- Define curriculum before creating offerings
- Assign subjects to departments/semesters

---

### D. Faculty Management

**Page:** `/faculty`

#### Add Faculty
1. Navigate to Faculty page
2. Fill form:
   - **Name:** Faculty full name
   - **Email:** Unique email address
   - **Department:** Select from dropdown (optional)
3. Click "Add Faculty"

#### Delete Faculty
1. Find faculty in table
2. Click delete button
3. Confirm deletion
4. **Effect:** Course offerings with this faculty set to NULL (not deleted)

**Use Case:**
- Maintain faculty database
- Assign faculty to course offerings

---

### E. Room Management

**Page:** `/rooms`

#### Add Room
1. Navigate to Rooms page
2. Fill form:
   - **Room Number:** Unique identifier (e.g., `101`, `Lab-A`)
   - **Building:** Building name (optional)
   - **Capacity:** Number of seats (optional)
   - **Type:** `CLASSROOM`, `LAB`, or `HALL`
3. Click "Add Room"

**Use Case:**
- Define available spaces
- Assign rooms to course offerings (default) or timetable events (override)

---

### F. Batch Management

**Page:** (Currently no dedicated page, created via subjects/timetable context)

#### Create Batch
1. Navigate to (Future: Batches page)
2. Fill form:
   - **Name:** Batch identifier (e.g., `CS-A`, `EE-B`)
   - **Department:** Select from dropdown
   - **Semester:** Select from dropdown
3. Click "Add Batch"

**Constraint:** Unique(name, department, semester)

**Use Case:**
- Group students into sections/divisions
- Associate offerings with specific student groups

---

### G. Student Management

**Page:** `/students`

#### Add Student
1. Navigate to Students page
2. Fill form:
   - **Roll Number:** Unique student ID
   - **Name:** Student full name
   - **Email:** Student email (optional)
   - **Department:** Select from dropdown
   - **Semester:** Select from dropdown
   - **Batch:** Select from dropdown
   - **Enrollment Year:** Year of admission
3. Click "Add Student"

#### Bulk Operations (Future)
- Import CSV
- Export student list
- Batch update

**Use Case:**
- Maintain student database
- Link students to batches for timetable access

---

### H. Course Offerings (V2 Feature)

**Page:** `/offerings`

#### Workflow: Create Offerings

**Prerequisites:**
- Departments created
- Semesters created
- Subjects created
- Faculty created
- Batches created
- Rooms created (optional)

**Steps:**
1. Navigate to Offerings page
2. **Select Batch:**
   - Filter by department (optional)
   - Choose batch from dropdown
3. **View Existing Offerings:**
   - See all offerings for selected batch
   - Search by subject code/name or faculty name
4. **Create New Offering:**
   - Click "Create Offering" button
   - Fill form:
     - **Subject:** Select from dropdown (filtered by batch's department)
     - **Faculty:** Select from dropdown
     - **Default Room:** Select from dropdown (optional)
     - **Notes:** Additional info (optional)
   - Click "Create"
5. **Result:** New offering appears in table

#### Delete Offering
1. Find offering in table
2. Click trash icon
3. Confirm deletion
4. **Cascade:** All timetable events referencing this offering are deleted

**Key Concept:**
> **Offering = Subject + Batch + Faculty**  
> This allows the same subject to be taught by different faculty to different batches.

**Example:**
```
Data Structures → CS-A → Dr. Smith → Lab 101
Data Structures → CS-B → Dr. Johnson → Lab 102
```

**Use Case:**
- Pre-configure what will be scheduled
- Enable faculty assignment before timetable creation

---

### I. Timetable V2 Editor (Google Calendar-like)

**Page:** `/timetable`

#### Workflow: Build Draft Timetable

**Prerequisites:**
- Offerings created for target batch

**Steps:**

##### 1. Select Workspace
1. Navigate to Timetable page
2. **Select Department:** Filter batches (optional)
3. **Select Batch:** Choose from dropdown
4. **Wait for Load:**
   - Draft version auto-created (if none exists)
   - Offerings palette loaded
   - Existing events loaded into grid

##### 2. Paint Workflow
1. **Offerings Palette (Left Panel):**
   - View all offerings for selected batch
   - Search by subject code/faculty name
   - **Click offering** to make it active (highlighted)
   - Active offering shown in "Active offering" field (top)

2. **Drag-Select Cells (Right Grid):**
   - **Mouse Down:** Click a cell to start selection
   - **Mouse Drag:** Extend selection rectangle (rows × columns)
   - **Mouse Up:** Finalize selection
   - **Selected cells highlighted** with blue background

3. **Apply Offering:**
   - Click "Apply" button (bottom of offerings panel)
   - **Effect:** All selected cells filled with active offering
   - **Database:** Upserts into `timetable_events` (overwrites existing if same slot)

4. **Clear Cells:**
   - Drag-select cells with existing events
   - Click "Clear" button
   - **Effect:** Deletes events from selected cells

##### 3. View Published (Read-Only)
1. Click "Published" toggle (top right)
2. **If published version exists:**
   - Grid switches to published timetable
   - "Published (read-only)" badge shown
   - Drag-select disabled
   - Shows green checkmark icon
3. **If no published version:**
   - Button disabled with tooltip

##### 4. Publish Draft
1. Ensure in "Draft" view mode
2. Review draft timetable
3. Click "Publish" button (top right)
4. **Confirm:** "Publish this draft timetable? Existing published version will be archived."
5. **Effect:**
   - Old published → archived
   - Current draft → published (timestamp set)
   - New empty draft created
   - View switches to "Published" mode

#### Grid Features

**Days:** Monday - Saturday (6 columns)

**Time Slots:** Loaded from `period_templates` (default: 08:00 - 17:00 hourly)

**Cell Display:**
- **Empty:** Gray placeholder (height maintained)
- **Filled:**
  - Subject code (small monospace)
  - Subject name (truncated)
  - Faculty name (truncated)

**Selection Behavior:**
- Rectangle selection (rows × columns)
- Selection persists until Apply/Clear or new selection
- Selection cleared on view mode switch

**Keyboard/Mouse:**
- Drag: Select multiple cells
- Click: Select single cell
- MouseLeave grid: End drag (prevent stuck drag)

#### Use Case Examples

**Example 1: Schedule Weekly Lecture**
1. Select "Data Structures - Dr. Smith" offering
2. Drag-select Monday 09:00, Wednesday 09:00, Friday 09:00
3. Click Apply
4. **Result:** 3 lectures scheduled for the week

**Example 2: Schedule Lab Sessions**
1. Select "Database Lab - Prof. Johnson" offering
2. Drag-select Tuesday 14:00-16:00 (2 consecutive cells)
3. Click Apply
4. **Result:** 2-hour lab block scheduled

**Example 3: Change Faculty**
1. Create new offering with different faculty
2. Drag-select existing lecture slots
3. Click Apply with new offering active
4. **Result:** Faculty swapped (upsert overwrites)

**Example 4: Clear Exam Week**
1. Drag-select entire Friday column
2. Click Clear
3. **Result:** Friday cleared for exams

---

### J. Settings & User Management

**Page:** `/settings`

#### View All Users
1. Navigate to Settings page
2. **RPC Called:** `get_all_users()` (admin-only)
3. **Table Displays:**
   - Email
   - Admin status (toggle)
   - Created date

#### Grant Admin Access
1. Find user in table
2. Click admin toggle switch
3. **Constraint:** Cannot toggle own admin status (disabled)
4. **Effect:** User gains admin access on next login/refresh

#### Revoke Admin Access
1. Find user in table
2. Click admin toggle switch (off)
3. **Effect:** User loses admin access on next login/refresh

**Security:**
- RLS prevents non-admins from calling `get_all_users()`
- RLS prevents self-admin toggle (even by admins)

---

## 🔄 Typical Admin Workflow (Full Cycle)

### Setup Phase (Once)
1. **Create Departments** (`CS`, `EE`, `ME`)
2. **Create Semesters** (`Semester 1 2025`, active)
3. **Add Faculty** (Dr. Smith, Dr. Johnson, Prof. Lee)
4. **Add Rooms** (Room 101, Lab-A, Hall-B)
5. **Create Subjects** (Data Structures, Algorithms, DBMS)
6. **Create Batches** (CS-A, CS-B, EE-A)

### Semester Start (Recurring)
1. **Update Active Semester** (mark current semester active)
2. **Create Course Offerings:**
   - CS-A: Data Structures → Dr. Smith → Lab 101
   - CS-A: Algorithms → Dr. Johnson → Room 201
   - CS-B: Data Structures → Dr. Lee → Lab 102
   - (Repeat for all subjects × batches)

### Timetable Creation (Recurring)
1. **For Each Batch:**
   - Open Timetable page
   - Select batch
   - Paint offerings into grid (drag + apply)
   - Review draft
   - Publish draft

### Mid-Semester Adjustments
1. **Faculty Change:**
   - Create new offering with new faculty
   - Overwrite existing slots (upsert)
   - Publish new version

2. **Room Change:**
   - (Future: Edit event's room_id directly)
   - (Current: Create new offering or clear + re-add)

### Semester End
1. **Archive Timetables:**
   - Happens automatically on next publish
   - Old published → archived status

2. **Clean Up:**
   - Mark semester inactive
   - Prepare next semester data

---

## 🎨 UX Patterns & Conventions

### Loading States
- **Page Load:** "Loading..." message or spinner
- **Mutations:** "Saving..." or disabled buttons during API call
- **Empty States:** "No data yet. Create your first..."

### Error Handling
- **Inline Errors:** Red alert box with error message
- **Toast Notifications:** (Future: Success/error toasts)
- **Validation:** Client-side + server-side (RLS + constraints)

### Responsive Design
- **Desktop:** Full sidebar + content
- **Tablet:** Collapsible sidebar
- **Mobile:** (Future: Hamburger menu)

### Icon Usage (lucide-react)
- Plus: Create/Add
- Trash2: Delete
- Eye: View published
- MousePointer2: Draft editing
- Save: Publish action
- CheckCircle2: Published status
- AlertCircle: Error state
- Clipboard: Apply action
- Eraser: Clear action

---

## 🚧 Known Limitations & Future Enhancements

### Current Limitations
1. **No Room Override in UI:** Room comes from offering default only
2. **No Copy/Paste:** Must re-select and apply for similar patterns
3. **No Templates:** Cannot save timetable as template for reuse
4. **No Conflict Detection:** Can schedule same faculty at same time (different batches)
5. **No Undo:** Accidental publish or clear is permanent
6. **No Bulk Edit:** Must select and apply individually

### Planned Features
- [ ] Room override per event (dropdown in cell)
- [ ] Copy/paste timetable blocks (Ctrl+C / Ctrl+V)
- [ ] Save timetable as template
- [ ] Conflict detection (faculty/room double-booking)
- [ ] Undo/Redo stack for draft edits
- [ ] Bulk operations (clear week, duplicate day)
- [ ] Export timetable as PDF/CSV
- [ ] Import timetable from CSV
- [ ] Realtime collaboration (see other admins editing)
- [ ] Timetable diff view (compare versions)

---

## 📱 Mobile App Integration (Future)

### Student App Consumption
**Endpoint:** Query `timetable_events` with RLS

**Query:**
```javascript
const { data } = await supabase
  .from('timetable_events')
  .select(`
    *,
    course_offerings(
      subjects(code, name),
      faculty(name),
      rooms:default_room_id(room_number)
    )
  `)
  .eq('timetable_versions.batch_id', studentBatchId)
  .eq('timetable_versions.status', 'published')
```

**RLS Enforces:** Only published timetables visible to students

**Display:**
- Daily view: Show today's classes
- Weekly view: Grid layout (similar to admin)
- Reminders: Push notifications before class

---

## 🎓 Training Guide (New Admins)

### Day 1: Setup
- Login and verify admin access
- Create departments, semesters
- Add faculty and rooms

### Day 2: Curriculum
- Create subjects for each department
- Link subjects to semesters
- Assign credits and types

### Day 3: Offerings
- Create batches
- Map offerings (subject + batch + faculty)
- Verify all required offerings created

### Day 4: Timetable
- Learn draft/published concept
- Practice drag-select and apply
- Build timetable for one batch
- Publish and verify

### Day 5: Management
- Grant admin access to colleagues
- Handle mid-semester changes
- Export reports (future)

---

**Related Docs:**
- [Architecture Details](/hajri-admin/ARCHITECTURE)
- [Schema Reference](/hajri-admin/SCHEMA_V2)
- [Development Roadmap](/hajri-admin/ROADMAP)
