# HAJRI Engine

> **Production URL:** https://hajri-x8ag.onrender.com  
> **Test Portal:** https://hajriengine.vercel.app  
> **Last Updated:** January 4, 2026

The **HAJRI Engine** is the core computation service that powers the attendance tracking and prediction system. It calculates semester totals, manages attendance summaries, and generates predictions for students.

## Overview

The engine runs as a FastAPI server on Render and provides:

1. **Semester Totals Calculation** - Pre-compute total lectures/labs per subject based on timetable and academic calendar
2. **Attendance Summarization** - Combine OCR snapshots + manual entries into unified summaries
3. **Prediction Engine** - Calculate "can bunk" and "must attend" values based on remaining classes
4. **Manual Attendance CRUD** - Track attendance changes between OCR snapshots

## Production URLs

| Service | URL |
|---------|-----|
| **Engine API** | https://hajri-x8ag.onrender.com/engine |
| **Health Check** | https://hajri-x8ag.onrender.com/healthz |
| **Engine Admin** | https://hajriengine.vercel.app |
| **Test Portal** | https://hajriengine.vercel.app |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      HAJRI ENGINE                           │
├─────────────────────────────────────────────────────────────┤
│  PRE-PROCESS (Admin triggers when timetable/calendar changes)│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. Fetch Timetable → Count slots per subject per day   ││
│  │ 2. Fetch Academic Calendar → Find non-teaching dates   ││
│  │ 3. Calculate: slots × teaching_days = semester_total   ││
│  │ 4. Persist to semester_subject_totals table            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ON-DEMAND (Triggered by snapshot confirm or manual entry)   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. Read OCR snapshot (baseline attendance)              ││
│  │ 2. Read manual_attendance entries (delta changes)       ││
│  │ 3. Compute: snapshot + manual = current attendance      ││
│  │ 4. Update attendance_summary table                      ││
│  │ 5. Generate predictions (must_attend, can_bunk)         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Quick Reference

### Key Endpoints (Mobile App)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/engine/predictions/dashboard` | GET | Current attendance like portal |
| `/engine/predictions` | GET | Can bunk / must attend predictions |
| `/engine/attendance/manual` | POST | Add attendance entry |
| `/engine/snapshots/confirm` | POST | Confirm OCR snapshot |
| `/engine/snapshots/latest` | GET | Get latest snapshot |

### Authentication

All endpoints require Supabase JWT token:
```http
Authorization: Bearer <supabase_access_token>
```

## Documentation

- [API Reference](./API.md) - Complete endpoint documentation (32 endpoints)
- [Mobile App Guide](./MOBILE_APP.md) - Mobile integration guide
- [Data Flow](./DATAFLOW.md) - How data moves through the system
- [Test Portal](./TEST_PORTAL.md) - Using the test portal for validation
