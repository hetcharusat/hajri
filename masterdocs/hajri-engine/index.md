# Hajri Engine

The **Hajri Engine** is the core computation service that powers the attendance tracking and prediction system. It calculates semester totals, manages attendance summaries, and generates predictions for students.

## Overview

The engine runs as a FastAPI server (default port 8000) and provides:

1. **Semester Totals Calculation** - Pre-compute total lectures/labs per subject based on timetable and academic calendar
2. **Attendance Summarization** - Combine OCR snapshots + manual entries into unified summaries
3. **Prediction Engine** - Calculate "can bunk" and "must attend" values based on remaining classes
4. **Manual Attendance CRUD** - Track attendance changes between OCR snapshots

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

## Quick Links

- [API Reference](./API.md) - Complete endpoint documentation
- [Data Flow](./DATAFLOW.md) - How data moves through the system
- [Test Portal](./TEST_PORTAL.md) - Using the test portal for validation
