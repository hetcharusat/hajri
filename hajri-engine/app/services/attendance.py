"""
Core attendance computation service for HAJRI Engine.
This is the main recomputation pipeline.
"""

from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from supabase import Client
import pendulum

from app.models.enums import (
    ClassType, AttendanceStatus, PredictionStatus,
    ComputeTrigger, ComputeStatus
)
from app.services.predictions import (
    compute_prediction, compute_percentage, determine_status, compute_recovery_classes
)
from app.services.snapshots import get_latest_snapshot, match_ocr_code_to_subject
from app.core.exceptions import NoSnapshotError, NoActiveContextError
from app.config import get_settings


async def get_student_context(
    db: Client,
    student_id: str
) -> Dict:
    """
    Get active academic context for a student.
    
    Returns:
        Dict with batch_id, semester_id, etc.
    
    Raises:
        NoActiveContextError if no context set.
    """
    result = db.table("app_users") \
        .select("*, students(*)") \
        .eq("student_id", student_id) \
        .single() \
        .execute()
    
    if not result.data:
        raise NoActiveContextError(student_id)
    
    user = result.data
    if not user.get("current_batch_id") or not user.get("current_semester_id"):
        raise NoActiveContextError(student_id)
    
    return {
        "student_id": student_id,
        "batch_id": user["current_batch_id"],
        "semester_id": user["current_semester_id"],
        "preferences": user.get("preferences", {})
    }


async def get_subjects_for_batch(
    db: Client,
    batch_id: str,
    semester_id: str
) -> List[Dict]:
    """
    Get all subjects that should be tracked for a batch.
    Based on course_offerings linked to this batch.
    """
    result = db.table("course_offerings") \
        .select("*, subjects(*)") \
        .eq("batch_id", batch_id) \
        .execute()
    
    subjects = []
    seen_ids = set()
    
    for offering in result.data or []:
        subj = offering.get("subjects")
        if subj and subj["id"] not in seen_ids:
            subjects.append(subj)
            seen_ids.add(subj["id"])
    
    return subjects


async def aggregate_manual_entries(
    db: Client,
    student_id: str,
    snapshot_id: str,
    snapshot_time: datetime,
    subject_id: str
) -> Dict[str, int]:
    """
    Aggregate manual attendance entries for a subject AFTER the snapshot.
    
    Returns:
        Dict with present, absent, total counts.
    """
    # Get manual entries after snapshot time for this subject
    result = db.table("manual_attendance") \
        .select("*") \
        .eq("student_id", student_id) \
        .eq("snapshot_id", snapshot_id) \
        .eq("subject_id", subject_id) \
        .gte("event_date", snapshot_time.date().isoformat()) \
        .execute()
    
    present = 0
    absent = 0
    
    for entry in result.data or []:
        status = entry.get("status")
        if status == AttendanceStatus.PRESENT.value:
            present += 1
        elif status == AttendanceStatus.ABSENT.value:
            absent += 1
        # CANCELLED doesn't count toward total
    
    return {
        "present": present,
        "absent": absent,
        "total": present + absent
    }


async def get_remaining_classes(
    db: Client,
    batch_id: str,
    subject_id: str,
    from_date: date
) -> int:
    """
    Calculate remaining expected classes for a subject.
    Uses timetable + academic calendar.
    
    Returns:
        Number of remaining teaching slots.
    """
    settings = get_settings()
    
    # Get semester end date
    # For now, assume end of current semester from academic calendar
    # This is a simplified version - should use count_teaching_days() function
    
    # Get timetable events for this subject
    result = db.table("timetable_events") \
        .select("*, course_offerings!inner(subject_id, batch_id)") \
        .eq("course_offerings.subject_id", subject_id) \
        .eq("course_offerings.batch_id", batch_id) \
        .execute()
    
    weekly_slots = len(result.data or [])
    
    # Estimate remaining weeks (simplified)
    # In production, this should use the calendar functions
    today = pendulum.now(settings.default_timezone).date()
    
    # Get semester end date from teaching_periods or estimate
    semester_result = db.table("teaching_periods") \
        .select("end_date") \
        .eq("is_current", True) \
        .limit(1) \
        .execute()
    
    if semester_result.data:
        end_date = pendulum.parse(semester_result.data[0]["end_date"]).date()
    else:
        # Default: assume 16 weeks semester, estimate 8 weeks remaining
        end_date = today.add(weeks=8)
    
    # Count weeks remaining
    remaining_weeks = max(0, (end_date - today).days // 7)
    
    return weekly_slots * remaining_weeks


async def recompute_for_student(
    db: Client,
    student_id: str,
    trigger: ComputeTrigger,
    trigger_id: Optional[str] = None
) -> Tuple[int, ComputeStatus]:
    """
    Full recomputation pipeline for a student.
    
    Steps:
    1. Validate context
    2. Get latest snapshot
    3. For each subject:
       a. Get snapshot baseline
       b. Aggregate manual entries
       c. Compute current totals
       d. Compute predictions
       e. Persist to summary/prediction tables
    
    Returns:
        Tuple of (subjects_updated, status)
    """
    start_time = pendulum.now("UTC")
    
    try:
        # Step 1: Get context
        context = await get_student_context(db, student_id)
        batch_id = context["batch_id"]
        semester_id = context["semester_id"]
        
        # Step 2: Get latest snapshot
        snapshot = await get_latest_snapshot(db, student_id, batch_id)
        if not snapshot:
            raise NoSnapshotError(student_id)
        
        snapshot_id = snapshot["id"]
        snapshot_time = pendulum.parse(snapshot["confirmed_at"])
        snapshot_entries = snapshot.get("entries", [])
        
        # Build lookup from snapshot entries by subject code
        snapshot_by_code = {}
        for entry in snapshot_entries:
            code = entry.get("course_code")
            if code:
                snapshot_by_code[code] = entry
        
        # Step 3: Get subjects for this batch
        subjects = await get_subjects_for_batch(db, batch_id, semester_id)
        
        settings = get_settings()
        required_pct = settings.default_required_percentage
        
        subjects_updated = 0
        
        for subject in subjects:
            subject_id = subject["id"]
            subject_code = subject["code"]
            class_type = subject.get("type", "LECTURE")
            
            # Find snapshot entry for this subject
            snap_entry = snapshot_by_code.get(subject_code)
            
            if snap_entry:
                snap_present = snap_entry.get("present", 0)
                snap_total = snap_entry.get("total", 0)
            else:
                # Subject not in snapshot - check if there's a previous summary
                prev_summary = db.table("attendance_summary") \
                    .select("snapshot_present, snapshot_total") \
                    .eq("student_id", student_id) \
                    .eq("subject_id", subject_id) \
                    .limit(1) \
                    .execute()
                
                if prev_summary.data:
                    snap_present = prev_summary.data[0].get("snapshot_present", 0)
                    snap_total = prev_summary.data[0].get("snapshot_total", 0)
                else:
                    snap_present = 0
                    snap_total = 0
            
            # Step 4: Aggregate manual entries
            manual = await aggregate_manual_entries(
                db, student_id, snapshot_id, snapshot_time, subject_id
            )
            
            # Step 5: Compute current totals
            current_present = snap_present + manual["present"]
            current_total = snap_total + manual["total"]
            current_pct = compute_percentage(current_present, current_total)
            
            # Step 6: Compute predictions
            remaining = await get_remaining_classes(
                db, batch_id, subject_id, snapshot_time.date()
            )
            
            must_attend, can_bunk, status = compute_prediction(
                current_present, current_total, remaining, required_pct
            )
            
            # Step 7: Upsert summary
            db.table("attendance_summary").upsert({
                "student_id": student_id,
                "subject_id": subject_id,
                "batch_id": batch_id,
                "semester_id": semester_id,
                "class_type": class_type,
                "snapshot_id": snapshot_id,
                "snapshot_at": snapshot_time.isoformat(),
                "snapshot_present": snap_present,
                "snapshot_total": snap_total,
                "manual_present": manual["present"],
                "manual_absent": manual["absent"],
                "manual_total": manual["total"],
                "current_present": current_present,
                "current_total": current_total,
                "current_percentage": current_pct,
                "last_recomputed_at": pendulum.now("UTC").isoformat()
            }, on_conflict="student_id,subject_id,class_type").execute()
            
            # Step 8: Upsert prediction
            recovery = compute_recovery_classes(current_present, current_total, required_pct)
            
            db.table("attendance_predictions").upsert({
                "student_id": student_id,
                "subject_id": subject_id,
                "batch_id": batch_id,
                "current_present": current_present,
                "current_total": current_total,
                "current_percentage": current_pct,
                "required_percentage": required_pct,
                "remaining_classes": remaining,
                "must_attend": must_attend,
                "can_bunk": can_bunk,
                "status": status.value,
                "prediction_computed_at": pendulum.now("UTC").isoformat()
            }, on_conflict="student_id,subject_id").execute()
            
            subjects_updated += 1
        
        # Log computation
        end_time = pendulum.now("UTC")
        duration_ms = int((end_time - start_time).total_seconds() * 1000)
        
        db.table("engine_computation_log").insert({
            "student_id": student_id,
            "trigger_type": trigger.value,
            "trigger_id": trigger_id,
            "status": ComputeStatus.SUCCESS.value,
            "subjects_updated": subjects_updated,
            "started_at": start_time.isoformat(),
            "completed_at": end_time.isoformat(),
            "duration_ms": duration_ms
        }).execute()
        
        return subjects_updated, ComputeStatus.SUCCESS
        
    except Exception as e:
        # Log failure
        end_time = pendulum.now("UTC")
        duration_ms = int((end_time - start_time).total_seconds() * 1000)
        
        db.table("engine_computation_log").insert({
            "student_id": student_id,
            "trigger_type": trigger.value,
            "trigger_id": trigger_id,
            "status": ComputeStatus.FAILED.value,
            "subjects_updated": 0,
            "started_at": start_time.isoformat(),
            "completed_at": end_time.isoformat(),
            "duration_ms": duration_ms,
            "error_message": str(e),
            "error_details": {"type": type(e).__name__}
        }).execute()
        
        raise
