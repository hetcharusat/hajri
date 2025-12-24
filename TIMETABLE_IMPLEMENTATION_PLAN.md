# Timetable System Redesign - Implementation Plan

## ✅ COMPLETED: Database Migration (TIMETABLE_REDESIGN.sql)

### Core Features Implemented:

#### 1. **Component-Based Teaching Model**
- `subject_components` table: Splits subjects into LECTURE/LAB/TUTORIAL/PRACTICAL/SEMINAR
- Each component has its own default duration and credits portion
- Fixes: "Same subject, different teachers for lecture vs lab"

#### 2. **Many-to-Many Teacher Assignments**
- `offering_teachers` table: Links offerings to multiple faculty
- Supports roles: PRIMARY, ASSISTANT, CO_TEACHER
- Fixes: "2+ teachers for same subject", "Different teachers per batch"

#### 3. **Period Template System**
- `period_templates` table: Institution-wide scheduling framework
- `periods` table: Individual periods with exact timings (e.g., 09:10-10:10)
- Replaces hardcoded time slots
- Fixes: "Custom period timings", "Named breaks (Lunch, Recess)"

#### 4. **Batch Grouping**
- `event_batches` table: Many-to-many event ↔ batches
- `batch_groups` table: Pre-defined batch combinations (A+B, C+D, etc.)
- Fixes: "Combined classes", "Batch splits in same slot"

#### 5. **Multiple Rooms Per Event**
- `event_rooms` table: Many-to-many event ↔ rooms
- Fixes: "Labs in parallel rooms (326, 329, 313 simultaneously)"

#### 6. **Faculty Workload System**
- `faculty_constraints` table: Max hours, unavailable periods
- Helper functions: `check_faculty_conflict()`, `check_room_conflict()`
- Fixes: "Faculty double-booking validation"

#### 7. **Enhanced Data Model**
- `course_offerings.component_id`: Links to specific component
- `timetable_events.period_id`: References period template
- `timetable_events.component_type`: Stores LECTURE/LAB for filtering
- Views: `offerings_complete`, `events_complete` for easy querying

---

## 🚧 TODO: Frontend Implementation

### Phase 1: Period Template Management (Priority: HIGH)
**Location**: New page `/settings/periods` or tab in Settings

**Features**:
- View active period template
- Edit period timings (Period 1: 09:10-10:10, etc.)
- Mark breaks (Lunch, Recess)
- Create multiple templates (Standard 6-period, Saturday 4-period, etc.)

**Files to create/modify**:
- `hajri-admin/src/pages/PeriodTemplates.jsx`
- Add nav link in DashboardLayout

---

### Phase 2: Component-Based Offerings (Priority: HIGH)
**Location**: Update existing Offerings page

**Changes needed**:
1. **Subject Components Tab** (new)
   - Show components per subject (ITUC202 Lecture, ITUC202 Lab)
   - Add/edit components with default duration
   
2. **Offerings Creation** (modify)
   - Select: Batch → Subject → **Component** → Teachers (multi-select)
   - Show component type badge (LECTURE/LAB)
   - Allow adding multiple teachers per offering
   
3. **Offerings List** (modify)
   - Display component type
   - Show all teachers (not just one)
   - Group by component

**Files to modify**:
- `hajri-admin/src/pages/Offerings.jsx`
- Add component selector
- Replace single faculty dropdown with multi-select

**DB queries to update**:
```javascript
// OLD
.from('course_offerings')
.select('*, subjects(code, name), faculty(name), ...')

// NEW
.from('course_offerings')
.select(`
  *,
  subjects(code, name),
  subject_components!component_id(component_type, default_duration_minutes),
  offering_teachers(faculty:faculty_id(id, name, email))
`)
```

---

### Phase 3: New Timetable Editor (Priority: CRITICAL)
**Location**: Replace `hajri-admin/src/components/Timetable/TimetablePanel.jsx`

**New Features**:
1. **Period-based grid** (not time-based)
   - Columns: Mon-Sat
   - Rows: Period 1, Period 2, Break, Period 3, ...
   - Load from active period template

2. **Batch grouping view**
   - Show all batches (A/B/C/D) in one timetable
   - Cell can contain multiple entries (stacked):
     ```
     A: ITUC202 (BSK) - 326
     B: ITUC202 (KSP) - 314
     ```

3. **Drag-and-drop placement**
   - Offerings list shows: "ITUC202 • Lecture • All batches" or "ITUC202 • Lab • Batch A"
   - Drag onto period + day
   - Auto-populate teachers from offering
   - Select room(s) on drop

4. **Conflict validation**
   - Before save: Check faculty double-booking
   - Before save: Check room double-booking
   - Show warnings in UI

5. **Multi-room assignment**
   - After placing event, allow adding multiple rooms
   - Useful for parallel lab sessions

**Files to create**:
- `hajri-admin/src/components/Timetable/PeriodGrid.jsx` (new grid component)
- `hajri-admin/src/components/Timetable/BatchGroupCell.jsx` (stacked entries)
- `hajri-admin/src/components/Timetable/OfferingBlock.jsx` (draggable offering)
- `hajri-admin/src/components/Timetable/ConflictChecker.jsx`

**Key logic**:
```javascript
// When dropping an offering
async function placeOffering({ offeringId, periodId, dayOfWeek, batchIds, roomIds }) {
  // 1. Get offering details (component, teachers)
  const offering = await supabase
    .from('offerings_complete')
    .select('*')
    .eq('id', offeringId)
    .single()
  
  // 2. Check conflicts
  const conflicts = await checkConflicts(periodId, dayOfWeek, offering.faculty_ids, roomIds)
  if (conflicts.length > 0) {
    // Show warning modal
    return
  }
  
  // 3. Create event
  const { data: event } = await supabase
    .from('timetable_events')
    .insert({
      version_id: draftVersionId,
      offering_id: offeringId,
      period_id: periodId,
      day_of_week: dayOfWeek,
      component_type: offering.component_type
    })
    .select()
    .single()
  
  // 4. Link batches
  await supabase.from('event_batches').insert(
    batchIds.map(bid => ({ event_id: event.id, batch_id: bid }))
  )
  
  // 5. Link rooms
  await supabase.from('event_rooms').insert(
    roomIds.map(rid => ({ event_id: event.id, room_id: rid }))
  )
}
```

---

### Phase 4: Batch Group Management (Priority: MEDIUM)
**Location**: Structure Explorer → Class level

**Features**:
- View batch groups (e.g., "A+B Combined", "Lab Group 1")
- Create/edit groups
- Assign batches to groups
- Use groups when placing timetable events

---

### Phase 5: Faculty Workload Dashboard (Priority: MEDIUM)
**Location**: New tab in Faculty page

**Features**:
- Show hours per week per faculty
- Highlight overloaded faculty (exceeds max_hours_per_week)
- Show unavailable periods
- Conflict alerts (double-booked across multiple timetables)

---

### Phase 6: Printable Timetable View (Priority: HIGH)
**Location**: Timetable tab → "Export" button

**Features**:
- Generate institutional format (like the image)
- Header: University, Semester, Class, Year, Date range
- Grid with batch splits
- Footer: Subject code → Name → Teachers mapping table
- Print-friendly CSS

---

## Migration Notes

### Data Migration (Already handled in SQL):
- ✅ Existing `faculty_id` on offerings → migrated to `offering_teachers` table
- ✅ Default lecture components created for all subjects
- ✅ Existing offerings linked to default lecture component
- ✅ Default 6-period template created

### Breaking Changes:
⚠️ **Frontend must update** to use new query structure:
- Replace `faculty_id` with `offering_teachers` array
- Replace `start_time/end_time` with `period_id`
- Add `event_batches` and `event_rooms` when creating events

---

## Testing Checklist

### Database:
- [ ] Run TIMETABLE_REDESIGN.sql in Supabase
- [ ] Verify period template created
- [ ] Verify offering_teachers populated
- [ ] Test conflict check functions

### Frontend (After implementation):
- [ ] Create subject components (Lecture + Lab for a subject)
- [ ] Create offering with multiple teachers
- [ ] Place offering in timetable (period-based)
- [ ] Place same offering for multiple batches (batch grouping)
- [ ] Assign multiple rooms to lab event
- [ ] Verify faculty conflict warning
- [ ] Verify room conflict warning
- [ ] Export printable timetable

---

## Implementation Priority

1. **Week 1**: Period Template Management + Component-Based Offerings
2. **Week 2**: New Timetable Editor (period grid + batch grouping)
3. **Week 3**: Conflict validation + Multi-room support
4. **Week 4**: Printable view + Faculty workload dashboard
