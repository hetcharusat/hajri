# 🚀 Quick Start Guide: Mobile App + Supabase

## 📋 Step-by-Step Setup

### **Step 1: Clean Up Supabase Data (5 minutes)**

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com
   - Open your project

2. **Run the Setup Script**
   - Click "SQL Editor" in sidebar
   - Create new query
   - Copy entire contents of `supabase_setup.sql`
   - Click "Run"
   - ✅ This creates helpful views, RLS policies, and helper functions

3. **Clean Old Test Data (Optional)**
   ```sql
   -- Delete old draft versions (keeps published only)
   DELETE FROM timetable_versions WHERE status = 'draft';
   
   -- Delete orphaned events
   DELETE FROM timetable_events 
   WHERE version_id NOT IN (
     SELECT id FROM timetable_versions WHERE status = 'published'
   );
   ```

4. **Verify Setup**
   ```sql
   -- Check views are created
   SELECT table_name FROM information_schema.views 
   WHERE table_schema = 'public';
   
   -- Should see: current_timetables, batch_subjects, etc.
   ```

---

### **Step 2: Test Mobile App Queries (10 minutes)**

1. **Open Supabase API Docs**
   - Click "API" in Supabase sidebar
   - This shows auto-generated REST endpoints

2. **Test Query 1: Find Batch by Roll Number**
   
   **Using the view (easiest):**
   ```javascript
   // In Supabase API Docs, try this:
   GET /rest/v1/nodes?type=eq.student&metadata->>rollNumber=eq.2024001&select=*
   ```
   
   **Response:**
   ```json
   [{
     "id": "uuid-student",
     "name": "John Doe",
     "parent_id": "uuid-batch",
     "metadata": {"rollNumber": "2024001"}
   }]
   ```

3. **Test Query 2: Get Timetable for Batch**
   
   ```javascript
   // Replace {batch_id} with actual batch UUID
   GET /rest/v1/current_timetables?batch_id=eq.{batch_id}&order=day_of_week,start_time
   ```
   
   **Response:**
   ```json
   [
     {
       "event_id": "uuid-1",
       "day_of_week": 1,
       "start_time": "09:00:00",
       "end_time": "09:50:00",
       "subject_code": "CS101",
       "subject_name": "Data Structures",
       "subject_type": "LECT",
       "faculty_name": "Dr. Smith",
       "room_number": "R-201"
     },
     ...
   ]
   ```

4. **Test Query 3: Get All Subjects**
   
   ```javascript
   GET /rest/v1/batch_subjects?batch_id=eq.{batch_id}
   ```

5. **Test Query 4: Get Period Template**
   
   ```javascript
   GET /rest/v1/active_period_schedule
   ```

---

### **Step 3: Ensure Data is Published (CRITICAL)**

Your mobile app will ONLY see **published** timetables. Not drafts!

1. **In Admin Portal:**
   - Go to Timetable page
   - Select a batch
   - Create timetable events
   - **Click "Publish" button** (if you have one)

2. **If no Publish button exists, run this SQL:**
   ```sql
   -- Find your batch's draft version
   SELECT id, batch_id, status, name FROM timetable_versions;
   
   -- Publish it manually
   UPDATE timetable_versions 
   SET status = 'published', published_at = NOW()
   WHERE id = 'your-version-id-here' AND status = 'draft';
   ```

3. **Verify Published Data:**
   ```sql
   -- Check published versions exist
   SELECT v.id, v.batch_id, v.status, v.published_at, COUNT(e.id) AS event_count
   FROM timetable_versions v
   LEFT JOIN timetable_events e ON e.version_id = v.id
   WHERE v.status = 'published'
   GROUP BY v.id;
   ```

---

### **Step 4: Get Supabase Connection Details**

Your mobile app needs these credentials:

1. **In Supabase Dashboard:**
   - Click "Settings" → "API"
   - Copy these values:

   ```
   Project URL: https://xxxxx.supabase.co
   Anon Public Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **In Android App:**
   ```kotlin
   // build.gradle.kts
   implementation("io.github.jan-tennert.supabase:postgrest-kt:2.0.0")
   
   // SupabaseClient.kt
   val supabase = createSupabaseClient(
       supabaseUrl = "https://xxxxx.supabase.co",
       supabaseKey = "your-anon-key"
   ) {
       install(Postgrest)
   }
   ```

---

### **Step 5: Test Mobile App Flow**

#### **Scenario: Student Opens App First Time**

1. **Student enters roll number: `2024001`**
   
   ```kotlin
   // App calls:
   val batch = repository.findBatchByRollNumber("2024001")
   // Returns: { batch_id: "uuid-123", batch_name: "B.Tech CS 2024 A" }
   ```

2. **App syncs timetable for that batch**
   
   ```kotlin
   repository.syncTimetable(batch.batch_id)
   // Downloads all events, saves to Room database
   ```

3. **App shows today's schedule (from local DB)**
   
   ```kotlin
   val today = repository.getTimetableForDay(batch.batch_id, dayOfWeek = 1)
   // Shows: Monday's lectures from local Room database
   ```

4. **App works offline now!**
   - All data is in local Room database
   - No internet needed for attendance marking
   - Sync runs once per day in background

---

### **Step 6: Handle "Messy" Supabase**

#### **Problem: Too many test batches/subjects**

**Solution: Delete unused nodes**
```sql
-- Find unused batches (no course offerings)
SELECT n.id, n.name 
FROM nodes n
LEFT JOIN course_offerings co ON co.batch_id = n.id
WHERE n.type = 'batch' AND co.id IS NULL;

-- Delete them (will cascade delete everything)
DELETE FROM nodes WHERE id IN (
  SELECT n.id FROM nodes n
  LEFT JOIN course_offerings co ON co.batch_id = n.id
  WHERE n.type = 'batch' AND co.id IS NULL
);
```

#### **Problem: Duplicate subjects**

**Solution: Merge duplicates**
```sql
-- Find duplicates
SELECT code, COUNT(*) FROM subjects GROUP BY code HAVING COUNT(*) > 1;

-- Keep first, delete rest
DELETE FROM subjects a
USING subjects b
WHERE a.id > b.id AND a.code = b.code;
```

#### **Problem: Draft versions cluttering**

**Solution: Keep only published**
```sql
-- Delete all drafts older than 7 days
SELECT cleanup_old_drafts(7);

-- Or delete ALL drafts (keeps published only)
DELETE FROM timetable_versions WHERE status = 'draft';
```

---

### **Step 7: Mobile App Data Flow Summary**

```
MOBILE APP WORKFLOW
═══════════════════

1️⃣ FIRST LAUNCH (Online)
   Student enters roll number
   ↓
   App queries Supabase: nodes → batch_id
   ↓
   App downloads timetable → saves to Room DB
   ↓
   App shows UI from Room DB

2️⃣ DAILY USAGE (Offline)
   App reads from Room DB only
   ↓
   Shows timetable, current lecture
   ↓
   Student marks attendance (saved locally)
   ↓
   (Optional) OCR upload for bulk attendance

3️⃣ BACKGROUND SYNC (Once per day)
   WorkManager runs sync at night
   ↓
   Checks if new timetable published
   ↓
   Downloads updates → updates Room DB
   ↓
   App always shows latest data offline
```

---

## 🎯 Testing Checklist

- [ ] Run `supabase_setup.sql` in Supabase SQL Editor
- [ ] Verify views created: `SELECT * FROM current_timetables LIMIT 1`
- [ ] At least one published timetable version exists
- [ ] Test query in Supabase API Docs (get timetable by batch_id)
- [ ] Copy Supabase URL and Anon Key
- [ ] Add credentials to Android app
- [ ] Test roll number → batch_id lookup
- [ ] Test timetable sync from Supabase → Room DB
- [ ] Test offline access (airplane mode)

---

## 📱 Mobile App Code Checklist

Use the code from `mobile_app_integration.kt`:

- [ ] Add Supabase Kotlin library to `build.gradle.kts`
- [ ] Create `SupabaseClient.kt` with URL and key
- [ ] Create `TimetableRepository.kt` (copy from example)
- [ ] Create Room entities for local storage
- [ ] Create `TimetableViewModel.kt`
- [ ] Implement sync logic (on app launch + daily background)
- [ ] Test with real Supabase data

---

## 🔥 Common Issues & Solutions

### **Issue: "No rows returned" when querying timetable**
**Cause:** Timetable is still in draft status  
**Fix:** Publish it in admin portal or run:
```sql
UPDATE timetable_versions SET status='published', published_at=NOW() WHERE id='...';
```

### **Issue: "RLS policy violation"**
**Cause:** RLS is enabled but no public read policy  
**Fix:** Run the RLS policies from `supabase_setup.sql`

### **Issue: "Multiple batches with same name"**
**Cause:** Test data duplicates  
**Fix:** Delete unused batches or add year to name (e.g., "CS 2024 A")

### **Issue: "Student not found by roll number"**
**Cause:** Roll number not in `metadata` field  
**Fix:** Check metadata format:
```sql
SELECT metadata FROM nodes WHERE type='student' LIMIT 1;
-- Should be: {"rollNumber": "2024001"}
```

---

## 📚 Next Steps

1. **Read** `DATA_ARCHITECTURE.md` for full system overview
2. **Run** `supabase_setup.sql` to set up views and policies
3. **Test** queries in Supabase API Docs
4. **Implement** mobile app using `mobile_app_integration.kt` as reference
5. **Deploy** admin portal (so others can manage timetables)

---

## 💡 Pro Tips

- **Always query views** (`current_timetables`, `batch_subjects`) instead of raw tables
- **Sync only once per day** - timetables don't change often
- **Store everything locally** in Room database - mobile app should work 100% offline
- **OCR data never goes to cloud** - it's for student's eyes only
- **Published timetables are immutable** - create new version if changes needed
- **Use the helper functions** (`get_batch_by_roll_number`, `get_current_lecture`) for complex queries

---

**You're ready to go! 🎉**

Your admin portal creates the data → Supabase stores it → Mobile app syncs once → Works offline forever.
