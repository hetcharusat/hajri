# Engine Data Flow

## Overview

The Hajri Engine processes attendance data through two main flows:

1. **Pre-Process Flow** - Admin calculates semester totals when timetable/calendar changes
2. **Live Flow** - Student confirms snapshot or adds manual entry, triggering recomputation

## Tables Involved

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT TABLES                            │
├─────────────────────────────────────────────────────────────────┤
│ timetable_events       │ Weekly schedule (day, time, subject)   │
│ academic_years         │ Year definition (2025-26)              │
│ calendar_events        │ Holidays (is_non_teaching=true)        │
│ vacation_periods       │ Vacation date ranges                   │
│ exam_periods           │ Exam date ranges                       │
│ weekly_off_days        │ Weekly offs + Saturday pattern         │
│ semesters              │ Semester dates (start_date, end_date)  │
│ ocr_snapshots          │ Portal attendance snapshots            │
│ manual_attendance      │ User-entered attendance changes        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        OUTPUT TABLES                            │
├─────────────────────────────────────────────────────────────────┤
│ semester_subject_totals│ Pre-computed total classes per subject │
│ attendance_summary     │ Current attendance state per student   │
│ attendance_predictions │ Predictions (must_attend, can_bunk)    │
│ engine_computation_log │ Audit log of computations              │
└─────────────────────────────────────────────────────────────────┘
```

## Pre-Process Flow (Semester Totals)

This is triggered by admin when timetable or academic calendar changes.

```
                    ADMIN TRIGGERS
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 1. Load Timetable for Batch            │
    │    - Get published timetable_version   │
    │    - Count slots per subject per day   │
    │    - e.g., MSUD102: Mon=2, Tue=1, Thu=2│
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 2. Load Academic Calendar              │
    │    - Get academic_year for semester    │
    │    - Load holidays (is_non_teaching)   │
    │    - Load vacation_periods             │
    │    - Load exam_periods                 │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 3. Load Weekly Off Settings            │
    │    - Get weekly_off_days for year      │
    │    - Check saturday_pattern column     │
    │    - Patterns: all, none, 1st_3rd, etc │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 4. Calculate Non-Teaching Dates        │
    │    - All Sundays in semester           │
    │    - Saturdays based on pattern        │
    │    - All holiday dates                 │
    │    - All vacation dates                │
    │    - All exam dates                    │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 5. Calculate Teaching Days per Weekday │
    │    - For each weekday (Mon-Sat):       │
    │      Count occurrences in semester     │
    │      Subtract non-teaching dates       │
    │    - e.g., Mondays: 15 - 1 = 14        │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 6. Calculate Total per Subject         │
    │    - For each subject:                 │
    │      Sum(slots[day] × teaching_days)   │
    │    - e.g., MSUD102: 2×14 + 1×15 + 2×14 │
    │            = 28 + 15 + 28 = 71         │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 7. Persist to semester_subject_totals  │
    │    - Upsert records for each subject   │
    │    - Store slots_per_week              │
    │    - Store total_classes_in_semester   │
    └────────────────────────────────────────┘
```

## Live Flow (Attendance Update)

Triggered when student confirms an OCR snapshot or adds manual attendance.

```
              STUDENT CONFIRMS SNAPSHOT
              or ADDS MANUAL ATTENDANCE
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 1. Get Latest Snapshot                 │
    │    - Find most recent ocr_snapshot     │
    │    - Parse entries JSON for attendance │
    │    - This is the "baseline"            │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 2. Get Manual Attendance Entries       │
    │    - All entries AFTER snapshot date   │
    │    - Count PRESENT, ABSENT by subject  │
    │    - This is the "delta"               │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 3. Compute Current Attendance          │
    │    current_present = snapshot + manual │
    │    current_total = snapshot + manual   │
    │    current_percentage = P/T × 100      │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 4. Update attendance_summary           │
    │    - Upsert per subject per class_type │
    │    - Store snapshot_present/total      │
    │    - Store manual_present/absent       │
    │    - Store current_present/total/pct   │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 5. Calculate Predictions               │
    │    - Get semester_subject_total        │
    │    - remaining = total - current_total │
    │    - Calculate must_attend for 75%     │
    │    - Calculate can_bunk staying >75%   │
    │    - Set status: SAFE/WARNING/DANGER   │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 6. Update attendance_predictions       │
    │    - Upsert prediction per subject     │
    │    - Store must_attend, can_bunk       │
    │    - Store remaining_classes           │
    │    - Store status indicator            │
    └────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │ 7. Log Computation                     │
    │    - Insert to engine_computation_log  │
    │    - Track trigger, duration, status   │
    └────────────────────────────────────────┘
```

## Saturday Pattern Logic

The `weekly_off_days` table has a `saturday_pattern` column:

| Pattern | Description | Off Saturdays |
|---------|-------------|---------------|
| `all` | Every Saturday off | All |
| `none` | All Saturdays working | None |
| `1st_3rd` | 1st & 3rd Saturday off | 1st, 3rd of month |
| `2nd_4th` | 2nd & 4th Saturday off | 2nd, 4th of month |
| `odd` | Odd Saturdays off | 1st, 3rd, 5th |
| `even` | Even Saturdays off | 2nd, 4th |

The engine calculates which Saturday of the month a date falls on and applies the pattern.
