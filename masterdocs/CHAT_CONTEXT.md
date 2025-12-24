# Chat Context Summary

**Session Date:** December 22, 2025  
**Primary Goal:** Build a proper, feature-rich admin portal for Hajri timetable management

---

## 🎯 Project Evolution

### Phase 1: Initial Setup (Earlier Work)
- Built basic admin panel with Google OAuth via Supabase
- Implemented user management: `users` table with `is_admin` boolean
- Created CRUD pages for: Departments, Subjects, Students, Faculty, Rooms, Semesters, Batches
- Basic timetable grid implementation

### Phase 2: Quality Crisis & Pivot
**User Feedback:** "not good… improve 1000%"

**Key Requirements from `features.txt`:**
1. Independent management of all entities (dept/branch/semester/class/faculty/batches)
2. Course mapping to faculty/semester/department/branch/batch/class
3. **Google Calendar-like timetable builder**
4. Different faculty per batch for same subject (offerings model)
5. Productivity features: copy/paste-like speed, templates
6. Academic calendar JSON for attendance
7. Everything saved in Supabase

**User Confirmation:** "yes do it proper"

### Phase 3: Schema V2 Implementation (Current)
**Major Changes:**
1. Introduced `course_offerings` table (subject + batch + faculty + default room)
2. Versioned timetable system:
   - `timetable_versions` (draft/published/archived per batch)
   - `timetable_events` (scheduled slots reference offerings)
3. Period templates (JSON time slots)
4. Academic calendar (JSON payload for future use)

**Files Updated:**
- `hajri-admin/CLEAN-SCHEMA.sql` - Complete authoritative schema
- `hajri-admin/src/pages/Offerings.jsx` - New CRUD page for offerings
- `hajri-admin/src/pages/Timetable.jsx` - Rebuilt V2 editor (paint workflow)
- `hajri-admin/src/App.jsx` - Added offerings route
- `hajri-admin/src/components/DashboardLayout.jsx` - Added offerings nav

---

## 🔥 Critical Issues Resolved

### 1. Schema Inconsistency
**Problem:** `CLEAN-SCHEMA.sql` had RLS policies referencing `users` table but didn't create it  
**Solution:** Consolidated auth/admin setup into CLEAN-SCHEMA.sql:
- Added `users` table linked to `auth.users`
- Added `handle_new_user()` trigger
- Added `get_all_users()` RPC
- Fixed drop order (auth trigger before function)

### 2. Timetable File Corruption
**Problem:** Partial replacement attempt left nested imports/exports, duplicate code  
**Solution:** Complete file rewrite with:
- Single top-level imports
- Clean component structure
- Paint-by-offering workflow
- Draft/published view modes
- Drag selection + apply/clear actions

### 3. Schema Deployment Error
**Problem:** `DROP FUNCTION handle_new_user()` failed due to trigger dependency  
**Solution:** Added `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;` before function drop

---

## 🏗️ Architecture Decisions

### Domain Model (V2)
```
Department → Batch → Course Offering (Subject + Faculty) → Timetable Events
```

**Key Insight:** `course_offerings` are the **schedulable units**, not raw subjects.  
This allows:
- Same subject, different faculty per batch
- Pre-configured default rooms
- Clean separation of "what's taught" vs "when it's scheduled"

### Timetable Workflow
1. Admin creates offerings: subject + batch + faculty (in Offerings page)
2. Admin selects batch in Timetable page
3. Draft timetable version auto-created
4. Paint workflow:
   - Click offering from palette
   - Drag-select grid cells
   - Click "Apply" to upsert events
   - Click "Clear" to delete selected events
5. Publish draft → archives old published, creates new draft

### Technical Stack
- **Frontend:** React + Vite, React Router, Tailwind, shadcn/ui components
- **Backend:** Supabase (Postgres + Auth + RLS)
- **State:** Zustand (minimal usage so far)
- **Icons:** lucide-react

---

## 📊 Database Schema Overview

### Core Tables (Legacy)
- `departments`, `semesters`, `subjects`, `faculty`, `rooms`, `batches`
- `students`, `student_backups`
- `timetable_entries` (legacy, kept for compatibility)

### V2 Tables (New)
- `course_offerings` - Unique(subject_id, batch_id)
- `timetable_versions` - Status enum, per batch
- `timetable_events` - Unique(version_id, day_of_week, start_time) for upsert
- `period_templates` - JSON time slot definitions
- `academic_calendar` - JSON payload (future)

### Access Control
- `users` table linked to `auth.users.id`
- RLS policies: Admins full access, students read published only
- Admin check: `(SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true`
- Settings page uses `get_all_users()` RPC with security definer

---

## 🎨 UI/UX Patterns

### Component Consistency
**Shadcn-style (Proper):**
- `Departments.jsx`, `Settings.jsx`, `Offerings.jsx`, `Timetable.jsx` (V2)
- Uses: `Card`, `Button`, `Input`, `Label`, `Table` from `@/components/ui`

**Raw Tailwind (Legacy, needs update):**
- `Students.jsx`, `Semesters.jsx`, `Faculty.jsx`, `Rooms.jsx`
- Still functional but inconsistent styling

### Navigation
- `DashboardLayout.jsx` sidebar with lucide icons
- Routes: `/`, `/departments`, `/subjects`, `/timetable`, `/students`, `/semesters`, `/faculty`, `/rooms`, `/offerings`, `/settings`

---

## 🚧 Known Issues & Blockers

### Current Blockers (December 22, 2025)
1. **Dev server failing** - `npm run dev` exits with code 1
   - Need to capture actual error output
   - Likely import/build issue

2. **Schema not deployed** - CLEAN-SCHEMA.sql updated but not run in Supabase
   - Contains V2 tables and fixes
   - Drop order fixed for re-runs

### Pending Work
1. Fix build errors and get dev server running
2. Deploy CLEAN-SCHEMA.sql to Supabase
3. Smoke test: Create offerings → Build timetable → Publish
4. UX consistency: Convert legacy pages to shadcn-style
5. Room override in timetable (currently uses offering default)
6. Timetable copy/paste or template feature
7. Academic calendar integration (future)

---

## 🔑 Key Learnings & Patterns

### File Locations
- Root: `b:\hajri\`
- Admin portal: `b:\hajri\hajri-admin\`
- OCR project: `b:\hajri\hajri-ocr\`
- Schema: `b:\hajri\hajri-admin\CLEAN-SCHEMA.sql`

### Import Patterns
```javascript
// Correct (using Vite alias)
import { DashboardLayout } from '@/components/DashboardLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Component imports
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
```

### Supabase Query Pattern
```javascript
const { data, error } = await supabase
  .from('table_name')
  .select('*, related_table(columns)')
  .eq('column', value)
  .order('column', { ascending: true })

if (error) throw error
```

### RLS Policy Pattern
```sql
CREATE POLICY "policy_name" ON table_name FOR operation TO authenticated
  USING ((SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true);
```

---

## 💡 Design Principles Followed

1. **Offerings as Schedulable Units** - Not raw subjects, but subject+batch+faculty combos
2. **Versioning for Safety** - Draft/Published/Archived workflow prevents accidental changes
3. **Batch-Centric Scheduling** - Each batch has independent timetable versions
4. **Upsert-Based Editing** - Unique constraint on (version, day, time) enables "paint" workflow
5. **Admin-First, Student-Read** - RLS ensures admins control, students consume
6. **Clean Slate Installer** - CLEAN-SCHEMA.sql can be re-run safely (drops first)

---

## 🗂️ Files Modified Summary

### Database
- `hajri-admin/CLEAN-SCHEMA.sql` ✅ Complete V2 schema + auth + RLS

### Frontend Pages
- `hajri-admin/src/pages/Timetable.jsx` ✅ V2 editor rebuilt
- `hajri-admin/src/pages/Offerings.jsx` ✅ New CRUD page
- `hajri-admin/src/App.jsx` ✅ Added offerings route
- `hajri-admin/src/components/DashboardLayout.jsx` ✅ Added offerings nav

### No Changes (Legacy, working)
- `hajri-admin/src/pages/Departments.jsx`
- `hajri-admin/src/pages/Students.jsx`
- `hajri-admin/src/pages/Semesters.jsx`
- `hajri-admin/src/pages/Faculty.jsx`
- `hajri-admin/src/pages/Rooms.jsx`
- `hajri-admin/src/pages/Settings.jsx`
- `hajri-admin/src/pages/Subjects.jsx`

---

## 📝 Terminal History Context

```powershell
# Last known commands:
cd hajri-admin
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react
npm run dev  # Failed (Exit Code 1)
```

**Note:** Dev server is failing but error output not captured yet. This is the immediate blocker.

---

## 🎯 User Intent & Goals

### Short-term (This Session)
- [x] Rebuild timetable with proper V2 architecture
- [x] Fix schema inconsistencies
- [ ] Get dev server running
- [ ] Deploy schema to Supabase
- [ ] Test end-to-end workflow

### Medium-term (Next Session)
- [ ] UX consistency pass (convert legacy pages)
- [ ] Room override in timetable UI
- [ ] Copy/paste or template workflow
- [ ] Polish and edge case handling

### Long-term (Future)
- [ ] Academic calendar integration
- [ ] Attendance tracking (using calendar + timetable)
- [ ] Mobile app consumption of published timetables
- [ ] Multi-semester management
- [ ] Faculty workload reports

---

## 🔗 External Resources

### Supabase Project
- URL: `VITE_SUPABASE_URL` in `.env.local`
- Anon Key: `VITE_SUPABASE_ANON_KEY` in `.env.local`
- SQL Editor: For running CLEAN-SCHEMA.sql
- Auth: Google OAuth configured

### Dependencies
- React + Vite
- Supabase JS client
- Tailwind CSS
- shadcn/ui components (partial)
- lucide-react icons
- Zustand state
- React Router

---

## 🚨 Critical Reminders for New Session

1. **Dev server is broken** - First action should be: run `npm run dev`, capture full error, fix
2. **Schema not deployed** - CLEAN-SCHEMA.sql needs to be run in Supabase SQL Editor
3. **Offerings prerequisite** - Must create offerings before timetable has data
4. **Draft auto-created** - First time selecting a batch creates draft version automatically
5. **Unique slot constraint** - `(version_id, day_of_week, start_time)` enables upsert-based editing

---

**For architecture details, see [Admin Architecture](/hajri-admin/ARCHITECTURE)**  
**For schema details, see [Schema V2](/hajri-admin/SCHEMA_V2)**  
**For remaining work, see [Roadmap](/hajri-admin/ROADMAP)**
