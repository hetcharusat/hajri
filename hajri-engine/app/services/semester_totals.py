"""
Semester Totals Service for HAJRI Engine.

PRE-PROCESS 1: Calculate total lectures/labs per subject for entire semester.
This uses:
- Timetable (how many slots per week per subject)
- Academic Calendar (teaching days, holidays, vacations, exams)
- Teaching Periods (semester start/end dates)

This can be run by admin whenever timetable or calendar changes.
"""

from datetime import date, datetime
from typing import Dict, List, Optional, Tuple
from supabase import Client
import pendulum

from app.config import get_settings


async def count_weekly_slots_per_subject(
    db: Client,
    batch_id: str
) -> Dict[str, Dict]:
    """
    Count how many timetable slots each subject has per week.
    
    Returns:
        Dict keyed by subject_id with values:
        {
            'subject_id': str,
            'subject_code': str,
            'subject_name': str,
            'class_type': str,
            'slots_per_week': int,
            'day_slots': {0: 1, 1: 2, ...}  # slots per day of week
        }
    """
    # Get published timetable for this batch
    version_result = db.table("timetable_versions") \
        .select("id") \
        .eq("batch_id", batch_id) \
        .eq("status", "published") \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
    
    if not version_result.data:
        return {}
    
    version_id = version_result.data[0]["id"]
    
    # Get all events for this version
    events_result = db.table("timetable_events") \
        .select("*, course_offerings(*, subjects(*))") \
        .eq("version_id", version_id) \
        .execute()
    
    subjects_slots = {}
    
    for event in events_result.data or []:
        offering = event.get("course_offerings", {})
        subject = offering.get("subjects", {})
        
        if not subject:
            continue
        
        subject_id = subject["id"]
        day_of_week = event.get("day_of_week", 0)
        
        if subject_id not in subjects_slots:
            subjects_slots[subject_id] = {
                "subject_id": subject_id,
                "subject_code": subject.get("code", ""),
                "subject_name": subject.get("name", ""),
                "class_type": subject.get("type", "LECTURE"),
                "slots_per_week": 0,
                "day_slots": {}
            }
        
        subjects_slots[subject_id]["slots_per_week"] += 1
        
        # Track which days
        day_slots = subjects_slots[subject_id]["day_slots"]
        day_slots[day_of_week] = day_slots.get(day_of_week, 0) + 1
    
    return subjects_slots


async def get_teaching_period_for_semester(
    db: Client,
    semester_id: str
) -> Optional[Dict]:
    """
    Get the teaching period dates for a semester.
    
    Returns:
        Dict with start_date, end_date, or None if not found.
    """
    # First try to get from semester table directly
    semester_result = db.table("semesters") \
        .select("start_date, end_date") \
        .eq("id", semester_id) \
        .single() \
        .execute()
    
    if semester_result.data:
        return {
            "start_date": semester_result.data["start_date"],
            "end_date": semester_result.data["end_date"]
        }
    
    # Fallback: Get current teaching period
    period_result = db.table("teaching_periods") \
        .select("start_date, end_date") \
        .order("start_date", desc=True) \
        .limit(1) \
        .execute()
    
    if period_result.data:
        return period_result.data[0]
    
    return None


async def get_weekly_off_settings(
    db: Client,
    academic_year_id: Optional[str],
    batch_id: Optional[str] = None
) -> Dict:
    """
    Get weekly off settings for a batch or academic year.
    Uses the weekly_off_days table with saturday_pattern column.
    
    Returns:
        Dict with off day settings and saturday_pattern
    """
    settings = {
        "sunday_off": True,  # Default
        "monday_off": False,
        "tuesday_off": False,
        "wednesday_off": False,
        "thursday_off": False,
        "friday_off": False,
        "saturday_pattern": "all"  # Default: all Saturdays off
    }
    
    if not academic_year_id:
        return settings
    
    # Get weekly off days from table
    try:
        result = db.table("weekly_off_days") \
            .select("day_of_week, is_off, saturday_pattern") \
            .eq("academic_year_id", academic_year_id) \
            .execute()
        
        if result.data:
            # Map day_of_week (0=Sunday, 1=Monday, ..., 6=Saturday) to settings
            day_map = {
                0: "sunday_off",
                1: "monday_off",
                2: "tuesday_off",
                3: "wednesday_off",
                4: "thursday_off",
                5: "friday_off",
            }
            
            for row in result.data:
                day = row["day_of_week"]
                is_off = row.get("is_off", True)
                
                if day in day_map:
                    settings[day_map[day]] = is_off
                elif day == 6:  # Saturday - use saturday_pattern column
                    pattern = row.get("saturday_pattern")
                    if pattern:
                        settings["saturday_pattern"] = pattern
                    elif is_off:
                        settings["saturday_pattern"] = "all"
                    else:
                        settings["saturday_pattern"] = "none"
    except Exception:
        # Table might not exist, use defaults
        pass
    
    return settings


def is_saturday_off(check_date: date, pattern: str) -> bool:
    """
    Check if a specific Saturday is off based on the pattern.
    
    Patterns:
        - 'all': Every Saturday off
        - 'none': No Saturday off
        - '1st_3rd': 1st and 3rd Saturday of month off
        - '2nd_4th': 2nd and 4th Saturday of month off
        - 'odd': 1st, 3rd, 5th Saturday off
        - 'even': 2nd, 4th Saturday off
    """
    if check_date.weekday() != 5:  # Not a Saturday
        return False
    
    if pattern == 'all':
        return True
    elif pattern == 'none':
        return False
    else:
        # Find which Saturday of the month this is
        first_of_month = check_date.replace(day=1)
        # Find first Saturday of month
        days_until_saturday = (5 - first_of_month.weekday()) % 7
        first_saturday = first_of_month + pendulum.duration(days=days_until_saturday)
        
        # Calculate which Saturday number (1st, 2nd, 3rd, etc.)
        # Handle both date and pendulum.Date objects
        if hasattr(first_saturday, 'date'):
            first_saturday = first_saturday.date()
        if hasattr(check_date, 'date') and callable(getattr(check_date, 'date')):
            check_date_val = check_date.date() if not isinstance(check_date, date) else check_date
        else:
            check_date_val = check_date
        days_diff = (check_date_val - first_saturday).days
        saturday_num = (days_diff // 7) + 1
        
        if pattern == '1st_3rd':
            return saturday_num in (1, 3)
        elif pattern == '2nd_4th':
            return saturday_num in (2, 4)
        elif pattern == 'odd':
            return saturday_num in (1, 3, 5)
        elif pattern == 'even':
            return saturday_num in (2, 4)
        else:
            return True  # Default: off


async def get_non_teaching_dates(
    db: Client,
    start_date: date,
    end_date: date,
    batch_id: Optional[str] = None
) -> Tuple[List[date], Dict, Dict]:
    """
    Get all non-teaching dates in a range.
    Uses weekly_off_settings, calendar_events, vacation_periods, exam_periods.
    
    Returns:
        Tuple of (list of non-teaching dates, weekly_off_settings, breakdown_details)
        breakdown_details contains categorized non-teaching days with names
    """
    non_teaching = set()
    breakdown = {
        "sundays": [],
        "saturdays": [],
        "holidays": [],
        "vacations": [],
        "exams": [],
        "other_weekly_offs": []
    }
    
    # Get academic year
    year_result = db.table("academic_years") \
        .select("id") \
        .lte("start_date", start_date.isoformat()) \
        .gte("end_date", end_date.isoformat()) \
        .limit(1) \
        .execute()
    
    academic_year_id = None
    if year_result.data:
        academic_year_id = year_result.data[0]["id"]
    
    # Get weekly off settings (from DB or defaults)
    weekly_settings = await get_weekly_off_settings(db, academic_year_id, batch_id)
    
    # Build weekly off days map from settings
    weekly_off_days = {
        6: weekly_settings.get("sunday_off", True),     # Python weekday 6 = Sunday
        0: weekly_settings.get("monday_off", False),    # Python weekday 0 = Monday
        1: weekly_settings.get("tuesday_off", False),
        2: weekly_settings.get("wednesday_off", False),
        3: weekly_settings.get("thursday_off", False),
        4: weekly_settings.get("friday_off", False),
    }
    saturday_pattern = weekly_settings.get("saturday_pattern", "all")
    
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Iterate through all dates and apply weekly off logic
    current = start_date
    while current <= end_date:
        py_weekday = current.weekday()  # Monday=0, ..., Saturday=5, Sunday=6
        
        # Sunday
        if py_weekday == 6 and weekly_off_days.get(6, True):
            non_teaching.add(current)
            breakdown["sundays"].append(current.isoformat())
        # Saturday using pattern
        elif py_weekday == 5:
            if is_saturday_off(current, saturday_pattern):
                non_teaching.add(current)
                breakdown["saturdays"].append(current.isoformat())
        # Other weekdays
        elif weekly_off_days.get(py_weekday, False):
            non_teaching.add(current)
            breakdown["other_weekly_offs"].append({
                "date": current.isoformat(),
                "day": day_names[py_weekday]
            })
        
        current = pendulum.instance(datetime.combine(current, datetime.min.time())).add(days=1).date()
    
    if academic_year_id:
        # Get holidays with names (column is 'title' not 'name')
        holidays = db.table("calendar_events") \
            .select("event_date, end_date, title, event_type") \
            .eq("academic_year_id", academic_year_id) \
            .eq("is_non_teaching", True) \
            .gte("event_date", start_date.isoformat()) \
            .lte("event_date", end_date.isoformat()) \
            .execute()
        
        for h in holidays.data or []:
            h_start = pendulum.parse(h["event_date"]).date()
            h_end = pendulum.parse(h.get("end_date") or h["event_date"]).date()
            holiday_name = h.get("title", "Holiday")
            
            # Add to breakdown (once per event, not per day)
            breakdown["holidays"].append({
                "name": holiday_name,
                "start_date": h_start.isoformat(),
                "end_date": h_end.isoformat() if h_end != h_start else None,
                "type": h.get("event_type", "holiday")
            })
            
            current = h_start
            while current <= h_end and current <= end_date:
                non_teaching.add(current)
                current = pendulum.instance(datetime.combine(current, datetime.min.time())).add(days=1).date()
        
        # Get vacation periods with names
        vacations = db.table("vacation_periods") \
            .select("start_date, end_date, name") \
            .eq("academic_year_id", academic_year_id) \
            .execute()
        
        for v in vacations.data or []:
            v_start = max(pendulum.parse(v["start_date"]).date(), start_date)
            v_end = min(pendulum.parse(v["end_date"]).date(), end_date)
            
            if v_start <= v_end:  # Only include if overlaps with semester
                breakdown["vacations"].append({
                    "name": v.get("name", "Vacation"),
                    "start_date": v_start.isoformat(),
                    "end_date": v_end.isoformat(),
                    "days": (v_end - v_start).days + 1
                })
                
                current = v_start
                while current <= v_end:
                    non_teaching.add(current)
                    current = pendulum.instance(datetime.combine(current, datetime.min.time())).add(days=1).date()
        
        # Get exam periods with names
        exams = db.table("exam_periods") \
            .select("start_date, end_date, name, exam_type") \
            .eq("academic_year_id", academic_year_id) \
            .execute()
        
        for e in exams.data or []:
            e_start = max(pendulum.parse(e["start_date"]).date(), start_date)
            e_end = min(pendulum.parse(e["end_date"]).date(), end_date)
            
            if e_start <= e_end:  # Only include if overlaps with semester
                breakdown["exams"].append({
                    "name": e.get("name", "Exams"),
                    "type": e.get("exam_type", "exam"),
                    "start_date": e_start.isoformat(),
                    "end_date": e_end.isoformat(),
                    "days": (e_end - e_start).days + 1
                })
                
                current = e_start
                while current <= e_end:
                    non_teaching.add(current)
                    current = pendulum.instance(datetime.combine(current, datetime.min.time())).add(days=1).date()
    
    return sorted(list(non_teaching)), weekly_settings, breakdown


async def calculate_semester_totals(
    db: Client,
    batch_id: str,
    semester_id: str
) -> Dict[str, Dict]:
    """
    Calculate total lectures/labs for each subject in the entire semester.
    
    This is the PRE-PROCESS 1 that admin should run.
    
    Returns:
        Dict keyed by subject_id with values:
        {
            'subject_id': str,
            'subject_code': str,
            'subject_name': str,
            'class_type': str,
            'slots_per_week': int,
            'total_weeks': int,
            'non_teaching_days': int,
            'total_classes_in_semester': int,
            'calculation_details': {...}
        }
    """
    # Step 1: Get weekly slots per subject
    weekly_slots = await count_weekly_slots_per_subject(db, batch_id)
    
    if not weekly_slots:
        return {}
    
    # Step 2: Get semester dates
    period = await get_teaching_period_for_semester(db, semester_id)
    
    if not period:
        # Fallback defaults
        today = pendulum.today()
        period = {
            "start_date": today.start_of("month").to_date_string(),
            "end_date": today.add(months=4).to_date_string()
        }
    
    start_date = pendulum.parse(period["start_date"]).date()
    end_date = pendulum.parse(period["end_date"]).date()
    
    # Step 3: Get non-teaching dates (now includes weekly off settings and breakdown)
    non_teaching_dates, weekly_settings, non_teaching_breakdown = await get_non_teaching_dates(db, start_date, end_date, batch_id)
    non_teaching_set = set(non_teaching_dates)
    
    # Step 4: For each subject, count actual teaching slots
    results = {}
    
    for subject_id, slots_info in weekly_slots.items():
        day_slots = slots_info["day_slots"]  # {day_of_week: count}
        
        total_classes = 0
        days_by_week = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0}  # Actual teaching days per weekday
        
        # Iterate through all dates in semester
        current = start_date
        while current <= end_date:
            if current not in non_teaching_set:
                # Python weekday(): Mon=0, Tue=1, ..., Sat=5, Sun=6
                # DB timetable_events.day_of_week: Mon=0, Tue=1, ..., Sat=5, Sun=6 (same!)
                py_weekday = current.weekday()
                
                # Check if this subject has classes on this day
                if py_weekday in day_slots:
                    total_classes += day_slots[py_weekday]
                    days_by_week[py_weekday] += 1
            
            current = pendulum.instance(datetime.combine(current, datetime.min.time())).add(days=1).date()
        
        total_days = (end_date - start_date).days + 1
        total_weeks = total_days // 7
        
        results[subject_id] = {
            "subject_id": subject_id,
            "subject_code": slots_info["subject_code"],
            "subject_name": slots_info["subject_name"],
            "class_type": slots_info["class_type"],
            "slots_per_week": slots_info["slots_per_week"],
            "day_slots": day_slots,
            "total_weeks": total_weeks,
            "teaching_weeks": total_weeks,  # Alias for clarity
            "total_days": total_days,
            "non_teaching_days": len(non_teaching_dates),
            "total_classes_in_semester": total_classes,
            "calculation_details": {
                "semester_start": start_date.isoformat(),
                "semester_end": end_date.isoformat(),
                "total_calendar_days": total_days,
                "teaching_weeks": total_weeks,
                "non_teaching_days_excluded": len(non_teaching_dates),
                "teaching_days_by_weekday": days_by_week,
                "formula": f"{slots_info['slots_per_week']} slots/week across {total_weeks} weeks, excluding {len(non_teaching_dates)} non-teaching days",
                "non_teaching_breakdown": {
                    "sundays_count": len(non_teaching_breakdown["sundays"]),
                    "saturdays_count": len(non_teaching_breakdown["saturdays"]),
                    "holidays": non_teaching_breakdown["holidays"],
                    "vacations": non_teaching_breakdown["vacations"],
                    "exams": non_teaching_breakdown["exams"],
                    "saturday_pattern": weekly_settings.get("saturday_pattern", "all")
                }
            }
        }
    
    return results


async def persist_semester_totals(
    db: Client,
    batch_id: str,
    semester_id: str,
    totals: Dict[str, Dict]
) -> int:
    """
    Save calculated semester totals to database.
    Creates/updates semester_subject_totals table.
    
    Returns:
        Number of records upserted.
    """
    count = 0
    
    for subject_id, data in totals.items():
        # Note: teaching_weeks is stored in calculation_details JSONB, not a separate column
        db.table("semester_subject_totals").upsert({
            "batch_id": batch_id,
            "semester_id": semester_id,
            "subject_id": subject_id,
            "class_type": data["class_type"],
            "slots_per_week": data["slots_per_week"],
            "total_classes_in_semester": data["total_classes_in_semester"],
            "calculation_details": data["calculation_details"],
            "calculated_at": pendulum.now("UTC").isoformat()
        }, on_conflict="batch_id,semester_id,subject_id").execute()
        
        count += 1
    
    return count


async def get_semester_total_for_subject(
    db: Client,
    batch_id: str,
    semester_id: str,
    subject_id: str
) -> Optional[int]:
    """
    Get precomputed total classes for a subject in a semester.
    Falls back to estimation if not precomputed.
    """
    result = db.table("semester_subject_totals") \
        .select("total_classes_in_semester") \
        .eq("batch_id", batch_id) \
        .eq("semester_id", semester_id) \
        .eq("subject_id", subject_id) \
        .limit(1) \
        .execute()
    
    if result.data:
        return result.data[0]["total_classes_in_semester"]
    
    return None
