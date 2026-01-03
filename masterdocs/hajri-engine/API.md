# HAJRI Engine API Reference

> **Last Updated:** January 4, 2026  
> **Base URL:** `https://hajri-x8ag.onrender.com`  
> **API Prefix:** `/engine`  
> **Version:** 2.0 (Production)

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Base URLs](#base-urls)
4. [API Overview](#api-overview)
5. [Predictions API](#predictions-api)
6. [Attendance API](#attendance-api)
7. [Snapshots API](#snapshots-api)
8. [Engine Control API](#engine-control-api)
9. [Test Portal API](#test-portal-api)
10. [Admin API](#admin-api)
11. [Error Handling](#error-handling)
12. [Data Flow](#data-flow)
13. [Mobile App Integration](#mobile-app-integration)

---

## Quick Start

### For Mobile Apps

```javascript
// 1. Get predictions (what can I bunk?)
const predictions = await fetch(
  'https://hajri-x8ag.onrender.com/engine/predictions',
  {
    headers: { 'Authorization': `Bearer ${supabaseToken}` }
  }
).then(r => r.json());

// 2. Get dashboard (current attendance)
const dashboard = await fetch(
  'https://hajri-x8ag.onrender.com/engine/predictions/dashboard',
  {
    headers: { 'Authorization': `Bearer ${supabaseToken}` }
  }
).then(r => r.json());

// 3. Add manual attendance
const response = await fetch(
  'https://hajri-x8ag.onrender.com/engine/attendance/manual',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subject_id: 'uuid-here',
      event_date: '2026-01-15',
      status: 'PRESENT',
      class_type: 'LECTURE'
    })
  }
).then(r => r.json());
```

---

## Authentication

### JWT Token (Production)

All production endpoints require a Supabase JWT token.

```http
Authorization: Bearer <supabase_access_token>
```

**Getting the token:**
```javascript
// Using Supabase client
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### Token Verification

The engine verifies tokens against the same Supabase instance used by admin panels:
- Decodes JWT using `SUPABASE_JWT_SECRET`
- Extracts `user_id` from claims
- Looks up `app_users` to get `student_id`

### Auth Flow

```
┌────────────┐     ┌─────────────┐     ┌─────────────────┐
│ Mobile App │────►│  Supabase   │────►│   HAJRI Engine  │
│            │     │  Auth       │     │                 │
└────────────┘     └─────────────┘     └─────────────────┘
      │                   │                    │
      │  1. Login         │                    │
      │─────────────────►│                    │
      │                   │                    │
      │  2. JWT Token     │                    │
      │◄─────────────────│                    │
      │                   │                    │
      │  3. API Request + Token               │
      │───────────────────────────────────────►│
      │                   │                    │
      │                   │  4. Verify JWT     │
      │                   │◄───────────────────│
      │                   │                    │
      │  5. Response      │                    │
      │◄───────────────────────────────────────│
```

---

## Base URLs

| Environment | URL | Auth Required |
|-------------|-----|---------------|
| **Production** | `https://hajri-x8ag.onrender.com/engine` | Yes (JWT) |
| **Test Portal** | `https://hajri-x8ag.onrender.com/engine/test/*` | No |
| **Admin** | `https://hajri-x8ag.onrender.com/engine/admin/*` | Yes (Admin JWT) |
| **Health** | `https://hajri-x8ag.onrender.com/healthz` | No |

---

## API Overview

### All Endpoints (32 total)

| Category | Endpoint | Method | Auth | Description |
|----------|----------|--------|------|-------------|
| **Health** | `/healthz` | GET | No | Render health check |
| **Health** | `/engine/health` | GET | No | Engine health status |
| **Predictions** | `/engine/predictions/dashboard` | GET | JWT | Current attendance like portal |
| **Predictions** | `/engine/predictions` | GET | JWT | Predictions (can_bunk, must_attend) |
| **Attendance** | `/engine/attendance/manual` | POST | JWT | Add attendance entry |
| **Attendance** | `/engine/attendance/summary` | GET | JWT | Get attendance summary |
| **Snapshots** | `/engine/snapshots/confirm` | POST | JWT | Confirm OCR snapshot |
| **Snapshots** | `/engine/snapshots/latest` | GET | JWT | Get latest snapshot |
| **Engine** | `/engine/recompute` | POST | JWT | Force recompute |
| **Engine** | `/engine/logs` | GET | JWT | Get computation logs |
| **Admin** | `/engine/admin/calculate-semester-totals` | POST | Admin | Pre-calculate totals |
| **Admin** | `/engine/admin/semester-totals/{batch_id}/{semester_id}` | GET | Admin | Get calculated totals |
| **Test** | `/engine/test/*` | ALL | No | All test endpoints (see below) |

---

## Predictions API

### GET `/engine/predictions/dashboard`

Get current attendance status - mimics college portal view.

**Auth:** JWT Required

**Response:**
```json
{
  "semester": "Even Semester 2025-26",
  "last_updated": "2026-01-15T10:30:00Z",
  "overall_present": 245,
  "overall_total": 280,
  "overall_percentage": 87.5,
  "subjects": [
    {
      "subject_id": "uuid",
      "subject_code": "MSUD102",
      "subject_name": "Engineering Mathematics II",
      "class_type": "LECTURE",
      "present": 42,
      "total": 48,
      "percentage": 87.5,
      "status": "SAFE"
    },
    {
      "subject_id": "uuid",
      "subject_code": "CSUC101",
      "subject_name": "Digital Electronics",
      "class_type": "LAB",
      "present": 12,
      "total": 14,
      "percentage": 85.7,
      "status": "SAFE"
    }
  ]
}
```

**Status Values:**
| Status | Percentage | Meaning |
|--------|------------|---------|
| `SAFE` | ≥85% | Can miss some classes |
| `WARNING` | 75-85% | Be careful |
| `DANGER` | 65-75% | Attend all classes |
| `CRITICAL` | <65% | Risk of detention |

---

### GET `/engine/predictions`

Get predictions for each subject - what can you bunk, what must you attend.

**Auth:** JWT Required

**Response:**
```json
{
  "student_id": "uuid",
  "semester": "Even Semester 2025-26",
  "semester_end": "2026-04-10",
  "classes_remaining_in_semester": 156,
  "total_can_bunk": 23,
  "total_must_attend": 0,
  "subjects_at_risk": 0,
  "subjects": [
    {
      "subject_id": "uuid",
      "subject_code": "MSUD102",
      "subject_name": "Engineering Mathematics II",
      "class_type": "LECTURE",
      "present": 42,
      "total": 48,
      "percentage": 87.5,
      "can_bunk": 8,
      "must_attend": 0,
      "classes_remaining": 36,
      "semester_total": 84,
      "classes_to_recover": 0,
      "status": "SAFE"
    }
  ],
  "computed_at": "2026-01-15T10:30:00Z"
}
```

**Key Metrics:**
| Field | Description |
|-------|-------------|
| `can_bunk` | Classes you can safely skip while staying ≥75% |
| `must_attend` | Minimum classes needed to reach 75% |
| `classes_remaining` | Scheduled classes left in semester |
| `classes_to_recover` | If below 75%, consecutive classes to recover |
| `semester_total` | Total expected classes in semester |

---

## Attendance API

### POST `/engine/attendance/manual`

Add a manual attendance entry (after snapshot date).

**Auth:** JWT Required

**Request Body:**
```json
{
  "subject_id": "uuid-of-subject",
  "event_date": "2026-01-15",
  "status": "PRESENT",
  "class_type": "LECTURE",
  "period_slot": 1
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `subject_id` | UUID | Yes | Subject UUID |
| `event_date` | DATE | Yes | YYYY-MM-DD format |
| `status` | String | Yes | `PRESENT`, `ABSENT`, `CANCELLED` |
| `class_type` | String | Yes | `LECTURE`, `LAB`, `TUTORIAL` |
| `period_slot` | Integer | No | Period number (1-7) |

**Response:**
```json
{
  "id": "entry-uuid",
  "subject_id": "uuid",
  "event_date": "2026-01-15",
  "status": "PRESENT",
  "recompute_triggered": true
}
```

**⚠️ Critical Rules:**

1. **Snapshot Lock Rule:** Cannot add entries for dates ON or BEFORE the snapshot date.
2. **Teaching Day Rule:** Cannot add entries for holidays or weekly offs.
3. **Recompute:** Background recomputation is automatically triggered.

**Error Responses:**

**400 - Snapshot Lock Violation:**
```json
{
  "error_code": "SNAPSHOT_LOCK_VIOLATION",
  "message": "Cannot add attendance for 2026-01-10. Snapshot date is 2026-01-12.",
  "snapshot_date": "2026-01-12",
  "attempted_date": "2026-01-10"
}
```

**400 - No Snapshot:**
```json
{
  "error_code": "NO_SNAPSHOT",
  "message": "No baseline snapshot found. Upload OCR snapshot first."
}
```

**400 - Invalid Date:**
```json
{
  "error_code": "INVALID_DATE",
  "message": "2026-01-26 is not a teaching day (holiday or weekly off)"
}
```

---

### GET `/engine/attendance/summary`

Get full attendance summary for current student.

**Auth:** JWT Required

**Response:**
```json
{
  "student_id": "uuid",
  "batch_id": "uuid",
  "semester_id": "uuid",
  "subjects": [
    {
      "subject_id": "uuid",
      "subject_code": "MSUD102",
      "subject_name": "Engineering Mathematics II",
      "class_type": "LECTURE",
      "snapshot_present": 40,
      "snapshot_total": 45,
      "manual_present": 2,
      "manual_absent": 0,
      "manual_total": 2,
      "current_present": 42,
      "current_total": 47,
      "current_percentage": 89.4,
      "last_recomputed_at": "2026-01-15T10:30:00Z"
    }
  ]
}
```

---

## Snapshots API

### POST `/engine/snapshots/confirm`

Confirm an OCR snapshot as the new baseline.

**Auth:** JWT Required

**Request Body:**
```json
{
  "captured_at": "2026-01-15T10:00:00Z",
  "source_type": "university_portal",
  "confirm_decreases": false,
  "entries": [
    {
      "subject_code": "MSUD102",
      "subject_name": "Engineering Mathematics II",
      "class_type": "LECTURE",
      "present": 42,
      "total": 48
    },
    {
      "subject_code": "CSUC101",
      "subject_name": "Digital Electronics",
      "class_type": "LAB",
      "present": 12,
      "total": 14
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `captured_at` | ISO DateTime | Yes | When snapshot was taken |
| `source_type` | String | No | Default: `university_portal` |
| `confirm_decreases` | Boolean | No | Set true to confirm decreased totals |
| `entries` | Array | Yes | Subject attendance data |

**Response:**
```json
{
  "snapshot_id": "uuid",
  "confirmed_at": "2026-01-15T10:00:00Z",
  "entries_processed": 8,
  "subjects_matched": 7,
  "subjects_unmatched": ["UNKNOWN101"],
  "recompute_triggered": true,
  "warnings": ["Unmatched subject codes: UNKNOWN101"]
}
```

**Decrease Warning (400):**
```json
{
  "error": "snapshot_decrease_warning",
  "message": "Some subjects show decreased totals. Please confirm.",
  "subjects": [
    {
      "code": "MSUD102",
      "previous_total": 50,
      "new_total": 48
    }
  ],
  "action": "Set confirm_decreases=true to proceed"
}
```

---

### GET `/engine/snapshots/latest`

Get the most recent confirmed snapshot.

**Auth:** JWT Required

**Response:**
```json
{
  "snapshot": {
    "id": "uuid",
    "student_id": "uuid",
    "batch_id": "uuid",
    "semester_id": "uuid",
    "captured_at": "2026-01-15T10:00:00Z",
    "confirmed_at": "2026-01-15T10:00:00Z",
    "source_type": "university_portal",
    "entries": [
      {
        "subject_code": "MSUD102",
        "subject_name": "Engineering Mathematics II",
        "class_type": "LECTURE",
        "present": 42,
        "total": 48
      }
    ]
  },
  "entries_count": 8
}
```

---

## Engine Control API

### POST `/engine/recompute`

Force recomputation of attendance data.

**Auth:** JWT Required

**Request Body:**
```json
{
  "student_id": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `student_id` | UUID | No | Optional - defaults to current user's student |

**Response:**
```json
{
  "students_processed": 1,
  "subjects_updated": 8,
  "duration_ms": 245,
  "status": "SUCCESS"
}
```

**Status Values:** `SUCCESS`, `PARTIAL`, `FAILED`

---

### GET `/engine/logs`

Get computation logs for current student.

**Auth:** JWT Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | Integer | 20 | Max logs to return |

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "student_id": "uuid",
      "trigger_type": "MANUAL_ENTRY",
      "trigger_id": "entry-uuid",
      "status": "SUCCESS",
      "subjects_updated": 1,
      "started_at": "2026-01-15T10:30:00Z",
      "completed_at": "2026-01-15T10:30:00Z",
      "duration_ms": 125
    }
  ]
}
```

**Trigger Types:**
- `SNAPSHOT_CONFIRM` - New snapshot confirmed
- `MANUAL_ENTRY` - Manual attendance added
- `FORCE_RECOMPUTE` - Admin forced recompute
- `CALENDAR_UPDATE` - Calendar changed

---

### GET `/engine/health`

Engine health check endpoint.

**Auth:** None

**Response:**
```json
{
  "status": "healthy",
  "service": "hajri-engine",
  "timestamp": "2026-01-15T10:30:00Z"
}
```

---

### GET `/healthz`

Render health check endpoint (root level).

**Auth:** None

**Response:**
```json
{
  "status": "healthy",
  "service": "hajri-ocr-api",
  "timestamp": "2026-01-15T10:30:00Z"
}
```

---

## Test Portal API

> **⚠️ Warning:** These endpoints have NO AUTHENTICATION for development/testing only.

### GET `/engine/test/all-batches`

Get all batches with hierarchy info.

**Response:**
```json
{
  "batches": [
    {
      "id": "uuid",
      "batch_name": "3CE1-A",
      "batch_letter": "A",
      "batch_display": "3CE1-A",
      "class_id": "uuid",
      "class_name": "3CE1",
      "class_number": 1,
      "semester_id": "uuid",
      "semester": 3,
      "branch_id": "uuid",
      "branch": "Computer Engineering",
      "department_id": "uuid",
      "department": "DEPSTAR",
      "label": "DEPSTAR → Computer Engineering → Sem 3 → Class 1 → A"
    }
  ]
}
```

---

### GET `/engine/test/batch/{batch_id}`

Get detailed batch information.

**Response:**
```json
{
  "batch": {
    "id": "uuid",
    "name": "3CE1-A",
    "class_name": "3CE1"
  },
  "subjects": [
    {
      "id": "uuid",
      "code": "MSUD102",
      "name": "Engineering Mathematics II",
      "type": "LECTURE",
      "credits": 3
    }
  ],
  "timetable": {
    "version": {
      "id": "uuid",
      "name": "Spring 2026",
      "status": "published"
    },
    "events_count": 42,
    "weekly_summary": {
      "MSUD102|LECTURE": {
        "code": "MSUD102",
        "name": "Engineering Mathematics II",
        "type": "LECTURE",
        "slots_per_week": 4,
        "days": ["Mon", "Tue", "Wed", "Fri"]
      }
    }
  },
  "students_sample": [...],
  "academic_year": {...}
}
```

---

### POST `/engine/test/calculate-semester-totals`

Calculate semester totals for a batch (no auth).

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `batch_id` | UUID | Yes | Batch to calculate |
| `semester_id` | UUID | Yes | Semester to calculate |
| `persist` | Boolean | No | Save to DB (default: true) |

**Response:**
```json
{
  "status": "success",
  "batch_id": "uuid",
  "semester_id": "uuid",
  "subjects_calculated": 8,
  "subjects_persisted": 8,
  "duration_ms": 320,
  "subjects": [
    {
      "subject_code": "MSUD102",
      "subject_name": "Engineering Mathematics II",
      "class_type": "LECTURE",
      "slots_per_week": 4,
      "total_classes_in_semester": 56,
      "calculation_details": {
        "semester_start": "2025-12-29",
        "semester_end": "2026-04-10",
        "total_calendar_days": 103,
        "teaching_weeks": 14,
        "non_teaching_days_excluded": 25,
        "formula": "4 slots/week × 14 weeks = 56 classes",
        "non_teaching_breakdown": {
          "sundays_count": 14,
          "saturdays_count": 7,
          "saturday_pattern": "1st_3rd",
          "holidays": [
            {"name": "Republic Day", "start_date": "2026-01-26"}
          ],
          "vacations": [],
          "exams": []
        }
      }
    }
  ]
}
```

---

### GET `/engine/test/semester-totals/{batch_id}/{semester_id}`

Get pre-calculated semester totals.

**Response:**
```json
{
  "batch_id": "uuid",
  "semester_id": "uuid",
  "count": 8,
  "totals": [
    {
      "id": "uuid",
      "subject_id": "uuid",
      "subject_code": "MSUD102",
      "subject_name": "Engineering Mathematics II",
      "class_type": "LECTURE",
      "slots_per_week": 4,
      "total_classes_in_semester": 56,
      "teaching_weeks": 14,
      "calculated_at": "2026-01-15T10:00:00Z",
      "calculation_details": {...}
    }
  ]
}
```

---

### POST `/engine/test/manual-attendance`

Add manual attendance (no auth).

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `student_id` | UUID | Yes | Student UUID |
| `subject_id` | UUID | Yes | Subject UUID |
| `event_date` | String | Yes | YYYY-MM-DD |
| `status` | String | No | PRESENT/ABSENT/CANCELLED |
| `class_type` | String | No | LECTURE/LAB/TUTORIAL |

**Response:**
```json
{
  "success": true,
  "action": "created",
  "entry_id": "uuid",
  "event_date": "2026-01-15",
  "status": "PRESENT"
}
```

---

### POST `/engine/test/bulk-manual-attendance`

Add multiple attendance entries at once.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `student_id` | UUID | Yes | Student UUID |
| `subject_id` | UUID | Yes | Subject UUID |
| `start_date` | String | Yes | YYYY-MM-DD |
| `num_days` | Integer | No | Number of entries (default: 10) |
| `pattern` | String | No | P/A pattern (default: "PPPPPPPPPP") |
| `class_type` | String | No | LECTURE/LAB/TUTORIAL |

**Example:** `pattern=PPAPPPPAPP` creates Present, Present, Absent, Present, etc.

**Response:**
```json
{
  "success": true,
  "entries_created": 10,
  "entries": [
    {"date": "2026-01-15", "status": "PRESENT", "action": "created", "id": "uuid"},
    {"date": "2026-01-16", "status": "PRESENT", "action": "created", "id": "uuid"},
    {"date": "2026-01-17", "status": "ABSENT", "action": "created", "id": "uuid"}
  ]
}
```

---

### PUT `/engine/test/manual-attendance/{entry_id}`

Update manual attendance entry.

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| `status` | String | Yes |

**Response:**
```json
{
  "success": true,
  "entry_id": "uuid",
  "new_status": "ABSENT",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

---

### DELETE `/engine/test/manual-attendance/{entry_id}`

Delete a manual attendance entry.

**Response:**
```json
{
  "success": true,
  "deleted_id": "uuid"
}
```

---

### DELETE `/engine/test/clear-manual-attendance/{student_id}`

Clear all manual attendance for a student.

**Response:**
```json
{
  "success": true,
  "student_id": "uuid",
  "entries_deleted": 15
}
```

---

### POST `/engine/test-recompute/{student_id}`

Force recompute for testing.

**Response:**
```json
{
  "success": true,
  "students_processed": 1,
  "subjects_updated": 8,
  "duration_ms": 245,
  "status": "SUCCESS"
}
```

---

### GET `/engine/test/predictions/{student_id}`

Get predictions for any student (no auth).

**Response:** Same as `/engine/predictions` endpoint.

---

### GET `/engine/test/student-context/{student_id}`

Debug student data and relationships.

**Response:**
```json
{
  "student_id": "uuid",
  "student": {
    "name": "Test Student",
    "roll_number": "22CE001"
  },
  "batch_id": "uuid",
  "semester_id": "uuid",
  "batch": {...},
  "subjects_count": 8,
  "subjects": [...],
  "timetable_events_count": 42
}
```

---

### GET `/engine/debug/student-context`

Full debug data dump (no auth).

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| `student_id` | UUID | Yes |

**Response:**
```json
{
  "student_id": "uuid",
  "app_user": {...},
  "subjects_count": 8,
  "subjects": [...],
  "timetable": {...},
  "snapshot": {...},
  "semester_totals": [...],
  "attendance_summary": [...],
  "predictions": [...],
  "manual_attendance": [...]
}
```

---

### POST `/engine/test/setup-real-test`

Set up test student in a real batch.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `batch_id` | UUID | Yes | Batch to join |
| `semester_start` | String | No | Semester start date |
| `semester_end` | String | No | Semester end date |

**Response:**
```json
{
  "success": true,
  "action": "created",
  "student_id": "11111111-1111-1111-1111-111111111111",
  "batch_id": "uuid",
  "semester_id": "uuid",
  "message": "Test student created in batch. Old data cleared. Ready for testing!"
}
```

---

### GET `/engine/test/timetables`

Get all available timetables.

**Response:**
```json
{
  "timetables": [
    {
      "id": "uuid",
      "name": "Spring 2026",
      "status": "published",
      "batch_id": "uuid",
      "batch_name": "3CE1-A",
      "class_name": "3CE1",
      "events_count": 42,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### GET `/engine/test/academic-calendar/{academic_year_id}`

Get academic calendar events.

**Response:**
```json
{
  "academic_year_id": "uuid",
  "holidays": [
    {
      "id": "uuid",
      "event_date": "2026-01-26",
      "title": "Republic Day",
      "event_type": "holiday",
      "is_non_teaching": true
    }
  ],
  "vacations": [
    {
      "id": "uuid",
      "name": "Diwali Vacation",
      "start_date": "2025-10-25",
      "end_date": "2025-11-05"
    }
  ],
  "exam_periods": [...]
}
```

---

## Admin API

### POST `/engine/admin/calculate-semester-totals`

Pre-calculate total classes for a semester (admin only).

**Auth:** Admin JWT Required

**Query Parameters:**
| Param | Type | Required |
|-------|------|----------|
| `batch_id` | UUID | Yes |
| `semester_id` | UUID | Yes |
| `persist` | Boolean | No |

**When to Run:**
- After timetable changes
- After calendar updates
- At semester start

---

### GET `/engine/admin/semester-totals/{batch_id}/{semester_id}`

Get calculated semester totals (admin only).

**Auth:** Admin JWT Required

---

## Error Handling

### Error Response Format

```json
{
  "error_code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Not allowed (not admin) |
| `NOT_FOUND` | 404 | Resource not found |
| `NO_SNAPSHOT` | 400 | No baseline snapshot exists |
| `SNAPSHOT_LOCK_VIOLATION` | 400 | Trying to add attendance before snapshot date |
| `INVALID_DATE` | 400 | Not a teaching day |
| `DUPLICATE_ENTRY` | 400 | Entry already exists |
| `VALIDATION_ERROR` | 422 | Invalid request body |

---

## Data Flow

### Complete Attendance Flow

```
┌──────────────┐    ┌───────────────┐    ┌─────────────────────┐
│  University  │───►│   HAJRI OCR   │───►│   /snapshots/confirm │
│  Portal      │    │   (scan PDF)  │    │                     │
└──────────────┘    └───────────────┘    └──────────┬──────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │   ocr_snapshots     │
                                          │   (immutable base)  │
                                          └──────────┬──────────┘
                                                     │
                    ┌────────────────────────────────┼────────────────────────────────┐
                    │                                │                                │
                    ▼                                ▼                                ▼
         ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
         │ /attendance/    │              │  Background     │              │   Timetable     │
         │ manual (user)   │              │  Recompute      │              │   + Calendar    │
         └────────┬────────┘              └────────┬────────┘              └────────┬────────┘
                  │                                │                                │
                  │                                ▼                                │
                  │                     ┌─────────────────────┐                     │
                  └────────────────────►│ attendance_summary  │◄────────────────────┘
                                        │ (computed totals)   │
                                        └──────────┬──────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────────┐
                                        │attendance_predictions│
                                        │(can_bunk, must_attend)│
                                        └─────────────────────┘
```

### Calculation Formula

```
current_present = snapshot_present + manual_present
current_total = snapshot_total + manual_total
current_percentage = (current_present / current_total) × 100

# Predictions
can_bunk = floor((current_present - 0.75 × current_total) / 0.75)
must_attend = max(0, ceil(0.75 × current_total - current_present))
```

---

## Mobile App Integration

### Setup Supabase

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://etmlimraemfdpvrsgdpk.supabase.co',
  'your-anon-key'
);

const ENGINE_URL = 'https://hajri-x8ag.onrender.com/engine';
```

### Authentication

```javascript
// Google OAuth Login
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'your-app-redirect-url'
  }
});

// Get JWT for API calls
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### Fetch Wrapper

```javascript
async function engineFetch(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(`${ENGINE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API Error');
  }
  
  return response.json();
}
```

### Common Patterns

```javascript
// Get dashboard
const dashboard = await engineFetch('/predictions/dashboard');

// Get predictions
const predictions = await engineFetch('/predictions');

// Add attendance
const entry = await engineFetch('/attendance/manual', {
  method: 'POST',
  body: JSON.stringify({
    subject_id: subjectId,
    event_date: '2026-01-15',
    status: 'PRESENT',
    class_type: 'LECTURE'
  })
});

// Get latest snapshot
const snapshot = await engineFetch('/snapshots/latest');
```

### Direct Supabase Queries

For some data, query Supabase directly:

```javascript
// Get student's subjects
const { data: subjects } = await supabase
  .from('course_offerings')
  .select('*, subjects(*)')
  .eq('batch_id', batchId);

// Get timetable
const { data: events } = await supabase
  .from('timetable_events')
  .select(`
    *,
    course_offerings (
      subjects (code, name),
      faculty (name, abbr)
    ),
    rooms (room_number)
  `)
  .eq('version_id', versionId)
  .order('day_of_week')
  .order('start_time');

// Get upcoming holidays
const { data: holidays } = await supabase
  .from('calendar_events')
  .select('*')
  .gte('event_date', new Date().toISOString().split('T')[0])
  .eq('is_non_teaching', true)
  .order('event_date')
  .limit(5);
```

---

## Related Documentation

- [Schema Reference](../hajri-admin/SCHEMA.md) - Complete database schema
- [Data Flow](./DATAFLOW.md) - Detailed data flow diagrams
- [Test Portal](./TEST_PORTAL.md) - Test portal usage guide
- [Deployment](../hajri-admin/DEPLOYMENT.md) - Production deployment
