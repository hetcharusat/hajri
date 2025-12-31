# Engine Test Portal

The test portal is a standalone React app for testing the Hajri Engine without needing the full admin panel or mobile app.

## Running the Test Portal

```bash
cd hajri-engine/test-portal
npm install
npm run dev
```

Opens at `http://localhost:5174`

## Features

### 1. Batch/Timetable Browser
- View all batches with department/class hierarchy
- See timetable details (subjects, slots per week)
- Check if timetable has Sunday slots (data issue indicator)

### 2. Semester Totals Calculator
- Calculate total classes per subject
- View breakdown by weekday
- See non-teaching dates excluded
- Debug view with full calculation details

### 3. Manual Attendance CRUD
- Add attendance entries (present/absent)
- Bulk add for testing
- Edit existing entries
- Clear all entries for fresh test

### 4. OCR Snapshot Simulation
- Create test snapshots
- Simulate portal data capture
- Trigger recomputation

### 5. Prediction Viewer
- See must_attend / can_bunk values
- Check status indicators (SAFE/WARNING/DANGER)
- Verify prediction logic

## Test Workflow

### Step 1: Select Batch
1. Open Test Portal
2. Browse batches to find your test batch
3. Note the `batch_id` and `semester_id`

### Step 2: Calculate Semester Totals
1. Enter batch_id and semester_id
2. Click "Calculate Semester Totals"
3. Verify totals match expected values
4. Use "Debug Semester Totals" to see breakdown

### Step 3: Add Manual Attendance
1. Enter student_id
2. Select subject and class type
3. Add PRESENT or ABSENT entries
4. Verify entries appear in list

### Step 4: Trigger Recompute
1. Click "Recompute" button
2. Check attendance_summary table
3. Verify predictions generated

### Step 5: Validate Results
1. Compare current_present/total with expected
2. Check predictions (must_attend, can_bunk)
3. Verify status indicator is correct

## API Endpoints Used

| Action | Endpoint |
|--------|----------|
| List batches | `GET /engine/test/all-batches` |
| Get batch details | `GET /engine/test/batch/{id}` |
| Calculate totals | `POST /engine/test/calculate-semester-totals` |
| Debug totals | `POST /engine/test/debug-semester-totals` |
| Add attendance | `POST /engine/test/manual-attendance` |
| Bulk add | `POST /engine/test/bulk-manual-attendance` |
| Update entry | `PUT /engine/test/manual-attendance/{id}` |
| Delete entry | `DELETE /engine/test/manual-attendance/{id}` |
| Clear all | `DELETE /engine/test/clear-manual-attendance/{student_id}` |
| Create snapshot | `POST /engine/test/create-real-snapshot` |

## Common Issues

### "No timetable found"
- Batch doesn't have a published timetable
- Go to Admin Panel → Timetable → Publish

### "Semester totals are 0"
- Timetable has no events
- All events are on Sunday (non-teaching)
- Academic calendar not configured

### "Saturday pattern not working"
- Check `weekly_off_days` table has `saturday_pattern` column set
- Admin Panel → Academic Calendar → Settings → Saturday Schedule

### "Predictions not generated"
- Run semester totals calculation first
- Check that semester_subject_totals has data
- Verify student has snapshot or manual entries
