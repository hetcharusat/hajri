# 📊 Hajri Data Architecture & Mobile App Integration Guide

## 🎯 Overview

This document explains:
1. **How data flows** from Admin Portal → Supabase → Mobile App
2. **Database schema** and relationships
3. **Mobile app queries** for fetching timetables, faculty, etc.
4. **RLS (Row Level Security)** policies for the mobile app
5. **Sync strategy** for offline-first mobile app

---

## 🗂️ Database Schema

### **Core Tables (Hierarchical Structure)**

```sql
-- 1. INSTITUTION STRUCTURE
nodes (hierarchical tree)
├── id (uuid)
├── parent_id (uuid, nullable)
├── type (text: 'root', 'college', 'department', 'batch', 'semester', 'student')
├── name (text)
├── metadata (jsonb: {year, division, rollNumber, etc})
└── created_at (timestamp)

-- 2. ACADEMIC COMPONENTS
subjects
├── id (uuid)
├── code (text, e.g., 'CS101')
├── name (text, e.g., 'Data Structures')
├── type (text: 'LECT', 'LAB', 'TUT')
├── credits (integer)
└── created_at (timestamp)

faculty
├── id (uuid)
├── name (text)
├── email (text)
├── abbr (text, e.g., 'JD')
└── created_at (timestamp)

rooms
├── id (uuid)
├── room_number (text, e.g., 'LAB-A', 'R-201')
├── capacity (integer, nullable)
└── created_at (timestamp)

-- 3. COURSE ASSIGNMENTS (Batch-level)
course_offerings
├── id (uuid)
├── batch_id (uuid → nodes.id where type='batch')
├── subject_id (uuid → subjects.id)
├── faculty_id (uuid → faculty.id, nullable)
├── default_room_id (uuid → rooms.id, nullable)
└── created_at (timestamp)

-- 4. PERIOD TEMPLATES (Reusable time schedules)
period_templates
├── id (uuid)
├── name (text, e.g., 'Regular Schedule', 'Saturday Schedule')
├── is_active (boolean)
└── created_at (timestamp)

periods
├── id (uuid)
├── template_id (uuid → period_templates.id)
├── period_number (integer: 1, 2, 3...)
├── name (text: 'Period 1', 'Lunch Break')
├── start_time (time: '09:00:00')
├── end_time (time: '09:50:00')
├── is_break (boolean)
├── day_of_week (integer: 1=Mon, 2=Tue... 6=Sat, nullable for all days)
└── created_at (timestamp)

-- 5. TIMETABLE VERSIONING (Draft → Published)
timetable_versions
├── id (uuid)
├── batch_id (uuid → nodes.id where type='batch')
├── name (text: 'Draft', 'v1.0')
├── status (text: 'draft', 'published')
├── published_at (timestamp, nullable)
└── created_at (timestamp)

-- 6. TIMETABLE EVENTS (Actual schedule)
timetable_events
├── id (uuid)
├── version_id (uuid → timetable_versions.id)
├── offering_id (uuid → course_offerings.id)
├── period_id (uuid → periods.id, nullable)
├── day_of_week (integer: 1=Mon... 6=Sat)
├── start_time (time)
├── end_time (time)
├── room_id (uuid → rooms.id, nullable - overrides default_room_id)
└── created_at (timestamp)
```

---

## 🔄 Data Flow

### **Admin Portal → Supabase**

```
1. Admin creates hierarchy in Tree
   └→ INSERT nodes (college → department → batch → semester)

2. Admin creates Subjects
   └→ INSERT subjects (CS101, MATH201, etc.)

3. Admin creates Faculty
   └→ INSERT faculty (Dr. Smith, Prof. Jones)

4. Admin creates Rooms
   └→ INSERT rooms (R-201, LAB-A)

5. Admin assigns courses to batches (Assignments tab)
   └→ INSERT course_offerings (batch_id + subject_id + faculty_id)

6. Admin creates Period Templates
   └→ INSERT period_templates + periods

7. Admin creates Timetable (Timetable tab)
   └→ SELECT course_offerings WHERE batch_id = X
   └→ INSERT timetable_events (drag-drop periods)

8. Admin publishes Timetable
   └→ UPDATE timetable_versions SET status='published', published_at=NOW()
```

### **Mobile App ← Supabase**

```
1. Student logs in with batch info (batch_id or roll number)
   └→ SELECT node WHERE metadata->>'rollNumber' = ?

2. App fetches timetable for student's batch
   └→ SELECT timetable_events WHERE version_id IN (
        SELECT id FROM timetable_versions 
        WHERE batch_id = ? AND status='published'
        ORDER BY published_at DESC LIMIT 1
      )

3. App syncs attendance data (OCR upload)
   └→ POST to OCR backend
   └→ Store locally in Room database
   └→ (Optional) Sync to Supabase for backup
```

---

## 📱 Mobile App Queries

### **1. Get Student's Batch Information**

```javascript
// Option A: By Roll Number
const { data: student } = await supabase
  .from('nodes')
  .select('id, name, parent_id, metadata')
  .eq('type', 'student')
  .eq('metadata->>rollNumber', rollNumber)
  .single()

// Get batch (parent of student)
const batchId = student.parent_id

// Option B: Direct batch selection (if app asks student to choose)
const { data: batches } = await supabase
  .from('nodes')
  .select('id, name, metadata')
  .eq('type', 'batch')
  .order('name')
```

### **2. Get Published Timetable for a Batch**

```javascript
// Get latest published version
const { data: version } = await supabase
  .from('timetable_versions')
  .select('id, name, published_at')
  .eq('batch_id', batchId)
  .eq('status', 'published')
  .order('published_at', { ascending: false })
  .limit(1)
  .single()

// Get all timetable events with full details
const { data: events } = await supabase
  .from('timetable_events')
  .select(`
    id,
    day_of_week,
    start_time,
    end_time,
    room_id,
    rooms:room_id(room_number),
    course_offerings(
      id,
      subjects(code, name, type, credits),
      faculty(name, abbreviation)
    )
  `)
  .eq('version_id', version.id)
  .order('day_of_week')
  .order('start_time')
```

**Response Example:**
```json
[
  {
    "id": "uuid-1",
    "day_of_week": 1,
    "start_time": "09:00:00",
    "end_time": "09:50:00",
    "room_id": "uuid-room",
    "rooms": { "room_number": "R-201" },
    "course_offerings": {
      "id": "uuid-offering",
      "subjects": {
        "code": "CS101",
        "name": "Data Structures",
        "type": "LECT",
        "credits": 4
      },
      "faculty": {
        "name": "Dr. John Smith",
        "abbr": "JDS"
      }
    }
  },
  ...
]
```

### **3. Get All Subjects for a Batch**

```javascript
// Get all assigned subjects for a batch
const { data: offerings } = await supabase
  .from('course_offerings')
  .select(`
    id,
    subjects(id, code, name, type, credits),
    faculty(id, name, abbr)
  `)
  .eq('batch_id', batchId)
  .order('subjects(code)')
```

### **4. Get Faculty Teaching a Specific Subject**

```javascript
const { data: offering } = await supabase
  .from('course_offerings')
  .select('faculty(id, name, email, abbr)')
  .eq('batch_id', batchId)
  .eq('subject_id', subjectId)
  .single()
```

### **5. Get Period Template (for time slots)**

```javascript
// Get active period template
const { data: template } = await supabase
  .from('period_templates')
  .select('id, name')
  .eq('is_active', true)
  .single()

// Get all periods for the template
const { data: periods } = await supabase
  .from('periods')
  .select('*')
  .eq('template_id', template.id)
  .order('period_number')
```

### **6. Get Current/Next Lecture (Real-time)**

```javascript
// Client-side logic after fetching timetable
const now = new Date()
const currentDay = now.getDay() // 0=Sun, 1=Mon...
const currentTime = now.toTimeString().slice(0, 8) // 'HH:MM:SS'

// Filter events for today
const todayEvents = events.filter(e => e.day_of_week === currentDay)

// Find current lecture
const currentLecture = todayEvents.find(e => 
  e.start_time <= currentTime && e.end_time > currentTime
)

// Find next lecture
const nextLecture = todayEvents.find(e => e.start_time > currentTime)
```

---

## 🔐 Row Level Security (RLS) Policies

### **For Mobile App (Student Access)**

```sql
-- Enable RLS
ALTER TABLE timetable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Public read access (students can read published timetables)
CREATE POLICY "Public read published timetables"
ON timetable_events FOR SELECT
USING (
  version_id IN (
    SELECT id FROM timetable_versions WHERE status = 'published'
  )
);

CREATE POLICY "Public read course offerings"
ON course_offerings FOR SELECT
USING (true);

CREATE POLICY "Public read subjects"
ON subjects FOR SELECT
USING (true);

CREATE POLICY "Public read faculty"
ON faculty FOR SELECT
USING (true);

CREATE POLICY "Public read rooms"
ON rooms FOR SELECT
USING (true);

-- Admin-only write policies
CREATE POLICY "Admin write timetables"
ON timetable_events FOR ALL
USING (auth.uid() IN (SELECT id FROM admin_users));
```

---

## 📲 Mobile App Sync Strategy

### **Offline-First Architecture**

```
┌─────────────────────────────────────────┐
│         MOBILE APP (Android)            │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────┐    │
│  │   Room Database (Local)        │    │
│  │  ├── subjects                  │    │
│  │  ├── timetable_entries         │    │
│  │  ├── attendance_records        │    │
│  │  └── sync_metadata             │    │
│  └────────────────────────────────┘    │
│           ↕ (Always Available)         │
│  ┌────────────────────────────────┐    │
│  │   UI Layer (Jetpack Compose)   │    │
│  └────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
              ↕ (Optional Sync)
┌─────────────────────────────────────────┐
│          SUPABASE (Cloud)               │
│  ├── timetable_events (Published)      │
│  ├── course_offerings                  │
│  └── subjects, faculty, rooms          │
└─────────────────────────────────────────┘
```

### **Sync Flow**

```kotlin
// 1. On App Launch (if network available)
fun syncTimetable() {
    val batchId = getBatchId()
    
    // Fetch latest published version
    val version = supabase
        .from("timetable_versions")
        .select()
        .eq("batch_id", batchId)
        .eq("status", "published")
        .order("published_at", descending = true)
        .limit(1)
        .single()
    
    // Check if local version is outdated
    if (version.published_at > localDb.lastSyncTime) {
        // Fetch full timetable
        val events = supabase
            .from("timetable_events")
            .select("""
                *,
                course_offerings(
                    *,
                    subjects(*),
                    faculty(*)
                ),
                rooms(*)
            """)
            .eq("version_id", version.id)
        
        // Save to Room database
        localDb.clearTimetable()
        localDb.insertAll(events)
        localDb.setLastSyncTime(version.published_at)
    }
}

// 2. Show data from local database (always)
fun getTodaySchedule(): List<TimetableEntry> {
    return localDb.timetableDao()
        .getByDayOfWeek(getCurrentDayOfWeek())
        .sortedBy { it.startTime }
}

// 3. OCR data stays local (no cloud sync needed)
fun saveAttendance(entries: List<AttendanceEntry>) {
    localDb.attendanceDao().insertAll(entries)
}
```

---

## 🧹 Cleaning Up "Messy" Supabase Data

### **Issue: Too Many Test Records**

```sql
-- Delete all draft timetable versions
DELETE FROM timetable_versions WHERE status = 'draft';

-- Delete orphaned timetable events (no published version)
DELETE FROM timetable_events
WHERE version_id NOT IN (
  SELECT id FROM timetable_versions WHERE status = 'published'
);

-- Delete course offerings without batch
DELETE FROM course_offerings WHERE batch_id IS NULL;

-- Clean up duplicate subjects
DELETE FROM subjects a
USING subjects b
WHERE a.id > b.id AND a.code = b.code;
```

### **Best Practice: Use Cascading Deletes**

```sql
-- Add foreign key constraints with CASCADE
ALTER TABLE course_offerings
DROP CONSTRAINT IF EXISTS course_offerings_batch_id_fkey,
ADD CONSTRAINT course_offerings_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES nodes(id) ON DELETE CASCADE;

ALTER TABLE timetable_events
DROP CONSTRAINT IF EXISTS timetable_events_version_id_fkey,
ADD CONSTRAINT timetable_events_version_id_fkey
  FOREIGN KEY (version_id) REFERENCES timetable_versions(id) ON DELETE CASCADE;
```

---

## 📊 Helpful Supabase Views (for Mobile App)

Create these views in Supabase SQL Editor to simplify mobile queries:

```sql
-- View 1: Current Timetable (Latest Published per Batch)
CREATE OR REPLACE VIEW current_timetables AS
SELECT DISTINCT ON (tv.batch_id)
  tv.id AS version_id,
  tv.batch_id,
  tv.name AS version_name,
  tv.published_at,
  te.id AS event_id,
  te.day_of_week,
  te.start_time,
  te.end_time,
  s.code AS subject_code,
  s.name AS subject_name,
  s.type AS subject_type,
  f.name AS faculty_name,
  f.abbreviation AS faculty_abbr,
  r.room_number
FROM timetable_versions tv
JOIN timetable_events te ON te.version_id = tv.id
JOIN course_offerings co ON co.id = te.offering_id
JOIN subjects s ON s.id = co.subject_id
LEFT JOIN faculty f ON f.id = co.faculty_id
LEFT JOIN rooms r ON r.id = COALESCE(te.room_id, co.default_room_id)
WHERE tv.status = 'published'
ORDER BY tv.batch_id, tv.published_at DESC;

-- View 2: Batch Subjects (All subjects assigned to a batch)
CREATE OR REPLACE VIEW batch_subjects AS
SELECT
  co.batch_id,
  s.id AS subject_id,
  s.code,
  s.name,
  s.type,
  s.credits,
  f.name AS faculty_name,
  f.abbreviation AS faculty_abbr
FROM course_offerings co
JOIN subjects s ON s.id = co.subject_id
LEFT JOIN faculty f ON f.id = co.faculty_id;
```

**Mobile App Query (Simplified):**
```javascript
// Instead of complex joins, just query the view
const { data } = await supabase
  .from('current_timetables')
  .select('*')
  .eq('batch_id', batchId)
  .order('day_of_week')
  .order('start_time')
```

---

## 🚀 Quick Start for Mobile App

### **1. Setup Supabase Client**

```kotlin
// build.gradle.kts
implementation("io.github.jan-tennert.supabase:postgrest-kt:2.0.0")
implementation("io.github.jan-tennert.supabase:realtime-kt:2.0.0")

// SupabaseClient.kt
val supabase = createSupabaseClient(
    supabaseUrl = "https://your-project.supabase.co",
    supabaseKey = "your-anon-key"
) {
    install(Postgrest)
}
```

### **2. Create Repository**

```kotlin
class TimetableRepository(
    private val supabase: SupabaseClient,
    private val localDb: AppDatabase
) {
    suspend fun syncTimetable(batchId: String) {
        try {
            // Fetch from Supabase
            val events = supabase.from("current_timetables")
                .select()
                .eq("batch_id", batchId)
                .decodeList<TimetableEvent>()
            
            // Save to local Room DB
            localDb.timetableDao().deleteAll()
            localDb.timetableDao().insertAll(events)
        } catch (e: Exception) {
            // Log error, continue with local data
        }
    }
    
    fun getTodaySchedule(): Flow<List<TimetableEvent>> {
        return localDb.timetableDao()
            .observeByDay(getCurrentDay())
    }
}
```

### **3. ViewModel**

```kotlin
@HiltViewModel
class TimetableViewModel @Inject constructor(
    private val repository: TimetableRepository
) : ViewModel() {
    
    val todaySchedule = repository.getTodaySchedule()
        .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())
    
    fun refresh() {
        viewModelScope.launch {
            repository.syncTimetable(batchId)
        }
    }
}
```

---

## 🎯 Summary

### **For Admin Portal:**
- ✅ Data entry through clean UI (Tree → Subjects → Assignments → Timetable)
- ✅ All stored in Supabase with proper relationships
- ✅ Published timetables are versioned and immutable

### **For Mobile App:**
- ✅ Fetch published timetable on first launch
- ✅ Store everything in Room database (offline-first)
- ✅ Show data from local DB (no network required)
- ✅ Optional background sync for updates
- ✅ OCR data stays local (no cloud needed)

### **Supabase Organization:**
- ✅ Use views for complex queries
- ✅ Enable RLS for security
- ✅ Cascade deletes for clean data
- ✅ Keep only published versions

---

**Next Steps:**
1. Create the Supabase views (above SQL)
2. Setup RLS policies
3. Test mobile app queries in Supabase API docs
4. Implement offline-first sync in Android app
