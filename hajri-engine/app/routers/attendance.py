"""
Attendance API endpoints for HAJRI Engine.
"""

from datetime import date
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from supabase import Client
import pendulum

from app.core.auth import AuthenticatedUser, get_current_student
from app.core.database import get_db
from app.core.exceptions import (
    PolicyViolation,
    SnapshotLockViolation,
    NoSnapshotError,
    InvalidDateError,
    DuplicateEntryError
)
from app.models.schemas import (
    ManualAttendanceRequest,
    ManualAttendanceResponse,
    ManualAttendanceBulkRequest,
    AttendanceSummaryResponse,
    SubjectSummary,
    PolicyViolationResponse
)
from app.models.enums import ComputeTrigger, AttendanceStatus
from app.services.snapshots import get_latest_snapshot
from app.services.attendance import (
    recompute_for_student,
    get_student_context,
    get_subjects_for_batch
)
from app.services.predictions import compute_percentage, determine_status
from app.config import get_settings


router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.post(
    "/manual",
    response_model=ManualAttendanceResponse,
    responses={
        400: {"model": PolicyViolationResponse, "description": "Policy violation"},
        401: {"description": "Unauthorized"}
    }
)
async def add_manual_attendance(
    request: ManualAttendanceRequest,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
):
    """
    Add a manual attendance entry.
    
    Rules:
    - Must have a snapshot baseline first
    - Cannot add entries for dates ON or BEFORE the snapshot date
    - Must be a valid teaching day (not holiday/vacation)
    """
    settings = get_settings()
    
    try:
        # Get context
        context = await get_student_context(db, user.student_id)
        batch_id = context["batch_id"]
        
        # Get latest snapshot
        snapshot = await get_latest_snapshot(db, user.student_id, batch_id)
        if not snapshot:
            raise NoSnapshotError(user.student_id)
        
        snapshot_id = snapshot["id"]
        snapshot_time = pendulum.parse(snapshot["confirmed_at"])
        snapshot_date = snapshot_time.date()
        
        # CRITICAL: Enforce snapshot lock rule
        if request.event_date <= snapshot_date:
            raise SnapshotLockViolation(
                str(request.event_date),
                str(snapshot_date)
            )
        
        # Validate it's a teaching day (call database function)
        teaching_check = db.rpc(
            "is_teaching_day",
            {"check_date": request.event_date.isoformat()}
        ).execute()
        
        if teaching_check.data is False:
            raise InvalidDateError(
                str(request.event_date),
                "Not a teaching day (holiday or weekly off)"
            )
        
        # Check for duplicate
        existing = db.table("manual_attendance") \
            .select("id") \
            .eq("student_id", user.student_id) \
            .eq("subject_id", request.subject_id) \
            .eq("event_date", request.event_date.isoformat()) \
            .eq("class_type", request.class_type.value) \
            .limit(1) \
            .execute()
        
        if existing.data:
            # Update existing entry
            result = db.table("manual_attendance") \
                .update({
                    "status": request.status.value,
                    "period_slot": request.period_slot
                }) \
                .eq("id", existing.data[0]["id"]) \
                .execute()
            entry_id = existing.data[0]["id"]
        else:
            # Insert new entry
            result = db.table("manual_attendance").insert({
                "student_id": user.student_id,
                "subject_id": request.subject_id,
                "snapshot_id": snapshot_id,
                "event_date": request.event_date.isoformat(),
                "class_type": request.class_type.value,
                "status": request.status.value,
                "period_slot": request.period_slot
            }).execute()
            entry_id = result.data[0]["id"]
        
        # Trigger recomputation in background
        background_tasks.add_task(
            recompute_for_student,
            db,
            user.student_id,
            ComputeTrigger.MANUAL_ENTRY,
            entry_id
        )
        
        return ManualAttendanceResponse(
            id=entry_id,
            subject_id=request.subject_id,
            event_date=request.event_date,
            status=request.status,
            recompute_triggered=True
        )
        
    except PolicyViolation as e:
        raise HTTPException(status_code=400, detail=e.to_dict())


@router.get(
    "/summary",
    response_model=AttendanceSummaryResponse
)
async def get_summary(
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
):
    """
    Get pre-computed attendance summary.
    
    This is a READ-ONLY endpoint - no computation happens here.
    Data is pre-computed on every snapshot confirm or manual entry.
    """
    context = await get_student_context(db, user.student_id)
    
    # Get all summaries for this student
    result = db.table("attendance_summary") \
        .select("*, subjects(code, name, type)") \
        .eq("student_id", user.student_id) \
        .eq("batch_id", context["batch_id"]) \
        .execute()
    
    subjects = []
    overall_present = 0
    overall_total = 0
    snapshot_at = None
    
    for row in result.data or []:
        subj = row.get("subjects", {})
        
        subjects.append(SubjectSummary(
            subject_id=row["subject_id"],
            subject_code=subj.get("code", ""),
            subject_name=subj.get("name", ""),
            class_type=row["class_type"],
            snapshot_present=row["snapshot_present"],
            snapshot_total=row["snapshot_total"],
            manual_present=row["manual_present"],
            manual_absent=row["manual_absent"],
            current_present=row["current_present"],
            current_total=row["current_total"],
            current_percentage=float(row["current_percentage"] or 0),
            status=determine_status(float(row["current_percentage"] or 0)),
            last_updated=row["last_recomputed_at"]
        ))
        
        overall_present += row["current_present"]
        overall_total += row["current_total"]
        
        if row["snapshot_at"] and not snapshot_at:
            snapshot_at = row["snapshot_at"]
    
    # Get semester number (schema uses semester_number, not name)
    semester_name = ""
    try:
        semester_result = db.table("semesters") \
            .select("semester_number") \
            .eq("id", context["semester_id"]) \
            .single() \
            .execute()
        if semester_result.data:
            semester_name = f"Semester {semester_result.data.get('semester_number', '')}"
    except Exception:
        # If semester lookup fails, continue without it
        pass
    
    return AttendanceSummaryResponse(
        student_id=user.student_id,
        batch_id=context["batch_id"],
        semester_name=semester_name,
        snapshot_at=snapshot_at,
        subjects=subjects,
        overall_present=overall_present,
        overall_total=overall_total,
        overall_percentage=compute_percentage(overall_present, overall_total),
        computed_at=pendulum.now("UTC")
    )


@router.get("/manual")
async def get_manual_entries(
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db),
    subject_id: str = None,
    from_date: date = None,
    to_date: date = None
):
    """
    Get manual attendance entries for the current student.
    """
    query = db.table("manual_attendance") \
        .select("*, subjects(code, name)") \
        .eq("student_id", user.student_id) \
        .order("event_date", desc=True)
    
    if subject_id:
        query = query.eq("subject_id", subject_id)
    if from_date:
        query = query.gte("event_date", from_date.isoformat())
    if to_date:
        query = query.lte("event_date", to_date.isoformat())
    
    result = query.limit(100).execute()
    
    return {"entries": result.data or []}


@router.delete("/manual/{entry_id}")
async def delete_manual_entry(
    entry_id: str,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
):
    """
    Delete a manual attendance entry.
    """
    # Verify ownership
    existing = db.table("manual_attendance") \
        .select("id") \
        .eq("id", entry_id) \
        .eq("student_id", user.student_id) \
        .single() \
        .execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    # Delete
    db.table("manual_attendance").delete().eq("id", entry_id).execute()
    
    # Trigger recomputation
    background_tasks.add_task(
        recompute_for_student,
        db,
        user.student_id,
        ComputeTrigger.MANUAL_ENTRY,
        entry_id
    )
    
    return {"deleted": True, "recompute_triggered": True}
