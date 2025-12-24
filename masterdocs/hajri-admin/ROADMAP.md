# Hajri Admin Portal - Development Roadmap

**Last Updated:** December 22, 2025  
**Status:** V2 Implementation Phase  
**Next Session:** Fix build errors + deploy schema

---

## At a Glance

**What to do next (order matters)**
1. Fix `npm run dev` build/runtime error (blocks everything)
2. Deploy schema: run `hajri-admin/CLEAN-SCHEMA.sql` in Supabase
3. Smoke test the V2 workflow end-to-end

**Definition of “done” for this milestone**
- Can login as admin
- Can create offerings
- Can paint timetable in Draft
- Can publish and view Published timetable

**If you’re new**
- Start at /getting-started/
- Then read /hajri-admin/WORKFLOWS for the product flow

---

## 🚨 Immediate Blockers (P0)

### 1. Dev Server Build Errors
**Status:** 🔴 Blocking  
**Issue:** `npm run dev` exits with code 1  
**Impact:** Cannot test or develop locally

**Action Items:**
- [ ] Run `npm run dev` and capture full error output
- [ ] Fix any import/module issues
- [ ] Verify all dependencies installed
- [ ] Test dev server starts successfully

**Estimated Time:** 30 minutes

---

### 2. Schema Deployment
**Status:** 🟡 Ready to Deploy  
**Issue:** CLEAN-SCHEMA.sql updated but not run in Supabase  
**Impact:** Frontend expects V2 tables but DB still has V1 or incomplete schema

**Action Items:**
- [ ] Open Supabase SQL Editor
- [ ] Copy CLEAN-SCHEMA.sql contents
- [ ] Run entire script (drops + creates all tables)
- [ ] Verify all tables created:
  - `users`, `departments`, `semesters`, `subjects`, `faculty`, `rooms`, `batches`
  - `course_offerings`, `timetable_versions`, `timetable_events`
  - `period_templates`, `academic_calendar`
- [ ] Verify seed data inserted (default departments, semester, period template)
- [ ] Verify triggers/functions created (`handle_new_user`, `get_all_users`, `update_updated_at`)

**Estimated Time:** 15 minutes

---

## ✅ Recently Completed (December 22, 2025)

### Schema V2 Design & Implementation
- [x] Designed offerings model (subject + batch + faculty)
- [x] Designed versioned timetable (draft/published/archived)
- [x] Added `course_offerings` table with unique constraint
- [x] Added `timetable_versions` with status enum
- [x] Added `timetable_events` with upsert-enabling unique constraint
- [x] Added `period_templates` for time slot definitions
- [x] Added `academic_calendar` for future attendance
- [x] Fixed drop order in CLEAN-SCHEMA.sql (trigger before function)
- [x] Consolidated auth/admin setup into clean schema

### Frontend V2 Implementation
- [x] Created `src/pages/Offerings.jsx` (CRUD page)
- [x] Rebuilt `src/pages/Timetable.jsx` (paint-to-grid editor)
- [x] Updated `src/App.jsx` (added offerings route)
- [x] Updated `src/components/DashboardLayout.jsx` (added offerings nav)
- [x] Fixed Timetable.jsx corruption (nested imports/exports)
- [x] Verified no editor errors in key files

---

## 🎯 Short-Term Goals (This Week)

### 1. Smoke Test V2 Workflow
**Priority:** P1 - Critical  
**Dependencies:** Build errors fixed, schema deployed

**Test Steps:**
1. Login as admin
2. Navigate to Offerings page
3. Select batch → Create offering (subject + faculty + room)
4. Verify offering appears in table
5. Navigate to Timetable page
6. Select same batch
7. Select offering from palette
8. Drag-select cells
9. Click Apply
10. Verify events appear in grid
11. Switch to Published view (should be empty)
12. Switch back to Draft
13. Click Publish
14. Confirm publish action
15. Verify view switches to Published
16. Verify events visible in Published view
17. Switch back to Draft
18. Verify new empty draft created

**Expected Outcome:** End-to-end workflow completes without errors

**Estimated Time:** 1 hour (including bug fixes)

---

### 2. Fix Known UI Issues
**Priority:** P2 - High

**Issues:**
- [ ] Room override not implemented (always uses offering default)
- [ ] Selection doesn't clear on batch change
- [ ] No loading state during publish action
- [ ] No success toast after publish
- [ ] Period template dropdown (future: allow switching templates)

**Estimated Time:** 2 hours

---

### 3. UX Consistency Pass
**Priority:** P2 - High  
**Goal:** Convert all pages to shadcn-style components

**Pages to Update:**
- [ ] `Students.jsx` - Convert to Card/Table/Button pattern
- [ ] `Semesters.jsx` - Convert to Card/Table/Button pattern
- [ ] `Faculty.jsx` - Convert to Card/Table/Button pattern
- [ ] `Rooms.jsx` - Convert to Card/Table/Button pattern
- [ ] `Subjects.jsx` - Review and polish (already decent)
- [ ] `Dashboard.jsx` - Add stats cards or welcome content

**Reference:** Use `Departments.jsx` and `Offerings.jsx` as templates

**Estimated Time:** 3-4 hours

---

## 🔧 Medium-Term Goals (Next 2 Weeks)

### 4. Timetable Productivity Features
**Priority:** P2 - High  
**User Request:** "Copy/paste, faster creation"

**Features:**
- [ ] **Copy Selection:** Ctrl+C or Copy button
  - Store selected cells + offering_id in clipboard state
- [ ] **Paste Selection:** Ctrl+V or Paste button
  - Apply clipboard offering to new selection
  - Enables "repeat pattern" workflow
- [ ] **Clear All (Batch):** Clear entire timetable for batch
- [ ] **Duplicate Day:** Copy Monday → Tuesday (mirror pattern)
- [ ] **Templates:** Save timetable as template, apply to other batches
- [ ] **Undo/Redo:** Stack-based undo for draft edits (before publish)

**Estimated Time:** 5-6 hours

---

### 5. Room Override in Timetable
**Priority:** P2 - High  
**Current Behavior:** Events always use offering's default_room_id  
**Desired Behavior:** Admin can override room per event

**Implementation:**
- [ ] Add room dropdown to cell on hover/click (edit mode)
- [ ] Update `timetable_events.room_id` on change
- [ ] Display override room (if set) or default room in cell
- [ ] Add "Clear Room Override" option (set room_id to NULL)

**UI Mockup:**
```
┌─────────────────────────┐
│ CS101 Data Structures   │
│ Dr. Smith               │
│ Room: [Lab 101 ▼]       │  ← Dropdown for override
└─────────────────────────┘
```

**Estimated Time:** 2-3 hours

---

### 6. Conflict Detection
**Priority:** P3 - Medium  
**Goal:** Warn admins of scheduling conflicts

**Types of Conflicts:**
- **Faculty Double-Booking:** Same faculty, same time, different batches
- **Room Double-Booking:** Same room, same time, different batches
- **Offering Overlap:** Same offering scheduled twice in same timetable

**Implementation:**
- [ ] Add conflict detection queries (run on Apply)
- [ ] Show warning modal before upsert (allow force)
- [ ] Highlight conflicting cells in red
- [ ] Add "Conflicts" panel showing all conflicts in draft

**Estimated Time:** 4-5 hours

---

### 7. Batch Management Page
**Priority:** P3 - Medium  
**Current State:** Batches created implicitly or via Offerings  
**Desired State:** Dedicated CRUD page for batches

**Features:**
- [ ] Create batch (name + department + semester)
- [ ] Edit batch
- [ ] Delete batch (cascade to offerings/timetables)
- [ ] List all batches with filters
- [ ] Search by name/department

**Estimated Time:** 2 hours

---

## 🚀 Long-Term Goals (Next Month)

### 8. Academic Calendar Integration
**Priority:** P3 - Medium  
**Goal:** Use calendar for attendance calculations

**Features:**
- [ ] UI to create/edit academic calendar
- [ ] Define holidays, exam weeks, semester boundaries
- [ ] Calculate expected classes per subject (total weeks × classes/week)
- [ ] (Future) Compare with actual attendance

**Estimated Time:** 6-8 hours

---

### 9. Reports & Analytics
**Priority:** P3 - Medium

**Reports:**
- [ ] **Faculty Workload:** Total hours per faculty across all batches
- [ ] **Room Utilization:** Hours used per room
- [ ] **Batch Schedule Density:** Classes per day per batch
- [ ] **Subject Distribution:** Lecture vs Lab vs Tutorial breakdown

**Export Formats:**
- [ ] PDF (printable timetable)
- [ ] CSV (data export)
- [ ] Excel (formatted report)

**Estimated Time:** 8-10 hours

---

### 10. Mobile App API
**Priority:** P4 - Low  
**Goal:** Expose published timetables for student mobile app

**API Design:**
- Use Supabase RLS (already enforces published-only for students)
- No additional backend needed

**Endpoints (via Supabase client):**
- `GET /timetable_events` (RLS filters by published status)
- `GET /subjects` (public read)
- `GET /batches` (public read)

**Mobile App Features:**
- Daily view of classes
- Weekly grid view
- Search by subject/faculty
- Push notifications before class
- Offline sync

**Estimated Time:** 12-15 hours (mobile app development)

---

### 11. Multi-Tenant Support
**Priority:** P4 - Future

**Use Case:** Support multiple institutions in single deployment

**Schema Changes:**
- [ ] Add `organizations` table
- [ ] Add `org_id` column to all domain tables
- [ ] Update RLS policies to filter by org_id
- [ ] Add org selection dropdown in UI

**Estimated Time:** 15-20 hours

---

## 🐛 Known Bugs & Technical Debt

### Bugs (P2)
- [ ] Selection state not cleared when switching batches
- [ ] Draft version not cleaned up if batch deleted
- [ ] No validation for overlapping time slots (e.g., 09:00-11:00 conflicts with 10:00-12:00)
- [ ] Published button shows "No published yet" tooltip even when published exists (edge case)

### Technical Debt (P3)
- [ ] No tests (unit, integration, E2E)
- [ ] No CI/CD pipeline
- [ ] No error tracking (Sentry)
- [ ] No analytics (Posthog)
- [ ] Hardcoded time slots (should load from period_templates everywhere)
- [ ] No pagination on large tables (Students, Offerings)
- [ ] No debouncing on search inputs
- [ ] No code splitting (all routes loaded upfront)

### Security Review (P2)
- [ ] Audit all RLS policies (ensure no leaks)
- [ ] Review SECURITY DEFINER functions (minimize privilege)
- [ ] Add rate limiting (Supabase Edge Functions?)
- [ ] Add CSRF protection (Supabase handles this?)
- [ ] Audit XSS risks (React escapes by default, verify JSONB)

---

## 📦 Dependencies to Add

### Immediate (P1)
- None (all required deps installed)

### Short-Term (P2)
- `react-hot-toast` - Toast notifications
- `date-fns` - Date formatting/manipulation
- `@tanstack/react-query` - Server state management (optional, improves caching)

### Medium-Term (P3)
- `jspdf` + `jspdf-autotable` - PDF export
- `papaparse` - CSV export/import
- `recharts` or `chart.js` - Reports/analytics charts

### Long-Term (P4)
- `@sentry/react` - Error tracking
- `posthog-js` - Product analytics
- `playwright` or `cypress` - E2E testing

---

## 🔄 Migration Strategy (V1 → V2)

### If Existing Data in V1 Schema

**Option A: Fresh Start (Recommended)**
- Run CLEAN-SCHEMA.sql (drops all tables)
- Re-enter departments, subjects, faculty, rooms
- Create offerings from scratch
- Build timetables in V2 editor

**Option B: Data Migration**
- Write migration script:
  1. Export V1 `timetable_entries`
  2. Create matching `course_offerings` (deduplicate subject+batch+faculty)
  3. Create `timetable_versions` (one published per batch)
  4. Convert `timetable_entries` → `timetable_events` (link to offerings)
- Estimated Time: 4-6 hours (script + testing)

**Option C: Dual Schema (Not Recommended)**
- Keep both `timetable_entries` and `timetable_events`
- Sync changes between them
- Complexity: High, maintenance burden

**Decision:** Fresh start for pilot, migration script for production (if needed)

---

## 📊 Success Metrics

### Launch Criteria (V2 MVP)
- [ ] All P0 blockers resolved
- [ ] Smoke test passes end-to-end
- [ ] At least one real batch timetable created and published
- [ ] No critical bugs in Offerings or Timetable pages
- [ ] Settings page functional (user management works)

### Adoption Metrics (Post-Launch)
- Admins onboarded: Target 3-5
- Batches with published timetables: Target 80%+
- Admin satisfaction survey: Target 4/5 stars
- Timetable publish time: Target < 30 min per batch

### Performance Targets
- Page load: < 2 seconds
- Timetable render: < 1 second (50 events)
- Apply action: < 500ms (10 cells)
- Publish action: < 2 seconds

---

## 🎯 Sprint Planning (Suggested)

### Sprint 1 (This Week): Foundation
- Fix build errors
- Deploy schema
- Smoke test V2 workflow
- Fix critical UI issues

### Sprint 2 (Week 2): Polish
- UX consistency pass (convert legacy pages)
- Add loading/success states
- Room override feature
- Copy/paste timetable

### Sprint 3 (Week 3): Features
- Batch management page
- Conflict detection
- Undo/Redo
- Templates

### Sprint 4 (Week 4): Reports & QA
- Faculty workload report
- Room utilization report
- PDF export
- E2E testing
- Bug fixes

### Sprint 5 (Month 2): Production Readiness
- Security audit
- Performance optimization
- Error tracking (Sentry)
- Documentation finalization
- Deployment to production

---

## 🛠️ Development Workflow

### Branch Strategy
```
main (production)
  └── develop (staging)
        ├── feature/room-override
        ├── feature/copy-paste
        └── fix/selection-clear-bug
```

### Commit Convention
```
feat: Add room override dropdown to timetable cells
fix: Clear selection when switching batches
refactor: Convert Students page to shadcn-style
docs: Update WORKFLOWS.md with copy/paste instructions
test: Add E2E test for timetable publish flow
```

### PR Checklist
- [ ] Code compiles without errors
- [ ] No new console warnings
- [ ] Manual testing completed
- [ ] Documentation updated (if needed)
- [ ] No hardcoded values (use env vars)

---

## 📞 Support & Escalation

### Common Issues

**Issue:** "Offerings not showing in timetable"  
**Solution:** Ensure batch selected, check batch_id matches offering's batch_id

**Issue:** "Publish button disabled"  
**Solution:** Check if draft has events, verify batch selected

**Issue:** "Selection not working"  
**Solution:** Ensure view mode is "Draft" (published is read-only)

**Issue:** "RLS permission denied"  
**Solution:** Verify user has is_admin=true in users table

---

## 🎓 New Developer Onboarding

### Day 1: Environment Setup
- Clone repo
- Install Node.js (v18+)
- Run `npm install`
- Copy `.env.local.example` → `.env.local`
- Get Supabase credentials from admin
- Run `npm run dev`

### Day 2: Codebase Tour
- Review ARCHITECTURE.md
- Review SCHEMA_V2.md
- Explore src/ structure
- Read Departments.jsx (simple CRUD example)
- Read Timetable.jsx (complex V2 example)

### Day 3: First Task
- Pick a small bug from roadmap
- Create feature branch
- Fix bug, test locally
- Create PR for review

### Day 4: Deep Dive
- Study RLS policies in CLEAN-SCHEMA.sql
- Understand offering → event data flow
- Trace a user action through components → Supabase → RLS

### Day 5: Independent Contribution
- Pick P3 task from roadmap
- Plan implementation
- Execute and deliver PR

---

**Related Docs:**
- [Full Chat Context](/CHAT_CONTEXT)
- [Architecture Details](/hajri-admin/ARCHITECTURE)
- [Schema Reference](/hajri-admin/SCHEMA_V2)
- [User Workflows](/hajri-admin/WORKFLOWS)
