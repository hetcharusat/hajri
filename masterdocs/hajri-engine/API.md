# Hajri Engine API Reference

Base URL: `http://localhost:8000` (development) or `https://hajri-engine.onrender.com` (production)

## Authentication

Most endpoints require authentication via Bearer token:
- **Production**: Supabase JWT token
- **Development**: `Bearer test-token-{user_id}` with `X-Student-ID` header

Test portal endpoints (`/engine/test/*`) skip authentication for easier testing.

---

## Production Endpoints

### POST `/engine/recompute`
Force recompute attendance for a student.

**Auth Required**: Yes

**Request Body**:
```json
{
  "student_id": "uuid" // Optional, uses current user if not provided
}
```

**Response**:
```json
{
  "students_processed": 1,
  "subjects_updated": 9,
  "duration_ms": 150,
  "status": "SUCCESS"
}
```

---

### GET `/engine/health`
Health check endpoint.

**Auth Required**: No

**Response**:
```json
{
  "status": "healthy",
  "service": "hajri-engine",
  "timestamp": "2026-01-01T12:00:00Z"
}
```

---

### GET `/engine/logs`
Get computation log entries.

**Auth Required**: Yes (Admin only)

**Query Parameters**:
- `student_id` (optional): Filter by student
- `limit` (optional): Max results (default 50)

---

### POST `/engine/admin/calculate-semester-totals`
Calculate total classes per subject for the semester.

**Auth Required**: Yes (Admin only)

**Query Parameters**:
- `batch_id` (required): Batch UUID
- `semester_id` (required): Semester UUID
- `persist` (optional): Save to database (default true)

**Response**:
```json
{
  "status": "success",
  "batch_id": "uuid",
  "semester_id": "uuid",
  "subjects_calculated": 9,
  "subjects_persisted": 9,
  "duration_ms": 500,
  "subjects": [
    {
      "subject_code": "MSUD102",
      "subject_name": "Engineering Mathematics II",
      "class_type": "LECTURE",
      "slots_per_week": 6,
      "total_classes_in_semester": 57
    }
  ]
}
```

---

### GET `/engine/admin/semester-totals/{batch_id}/{semester_id}`
Get stored semester totals for a batch.

**Auth Required**: Yes (Admin only)

---

## Test Portal Endpoints

These endpoints are for the test portal and skip authentication.

### GET `/engine/test/all-batches`
List all batches with department/class info.

**Response**:
```json
{
  "batches": [
    {
      "id": "uuid",
      "batch_name": "A",
      "class_name": "Class 1",
      "semester": 2,
      "branch": "Computer Engineering",
      "department": "DEPSTAR",
      "label": "DEPSTAR - Computer Engineering - Sem 2 - Class 1 - A"
    }
  ]
}
```

---

### GET `/engine/test/timetables`
List all timetables with event counts.

---

### GET `/engine/test/batch/{batch_id}`
Get detailed batch info including subjects and timetable.

---

### POST `/engine/test/calculate-semester-totals`
Calculate semester totals (test version, no auth).

**Query Parameters**:
- `batch_id` (required)
- `semester_id` (required)

---

### POST `/engine/test/debug-semester-totals`
Debug endpoint showing detailed calculation breakdown.

**Query Parameters**:
- `batch_id` (required)
- `semester_id` (required)

**Response includes**:
- Semester period dates
- Academic year info
- Calendar data (holidays, vacations, exams)
- Weekly off settings with Saturday pattern
- Non-teaching dates count
- Per-subject weekday analysis

---

### POST `/engine/test/manual-attendance`
Add a manual attendance entry.

**Query Parameters**:
- `student_id` (required)
- `subject_code` (required)
- `class_type` (required): LECTURE, LAB, or TUTORIAL
- `status` (required): PRESENT, ABSENT, or CANCELLED
- `event_date` (required): YYYY-MM-DD format

---

### POST `/engine/test/bulk-manual-attendance`
Add multiple attendance entries at once.

**Query Parameters**:
- `student_id` (required)
- `subject_code` (required)
- `class_type` (required)
- `present_count` (required)
- `absent_count` (required)
- `start_date` (required)

---

### PUT `/engine/test/manual-attendance/{entry_id}`
Update an attendance entry.

**Query Parameters**:
- `status` (required): New status (PRESENT, ABSENT, CANCELLED)

---

### DELETE `/engine/test/manual-attendance/{entry_id}`
Delete an attendance entry.

---

### DELETE `/engine/test/clear-manual-attendance/{student_id}`
Clear all manual attendance for a student.

---

### POST `/engine/test/create-real-snapshot`
Create an OCR snapshot for testing.

**Query Parameters**:
- `student_id` (required)
- `batch_id` (required)
- `semester_id` (required)

**Request Body**: Snapshot entries JSON

---

### GET `/engine/test/academic-calendar/{academic_year_id}`
Get academic calendar data for an academic year.
