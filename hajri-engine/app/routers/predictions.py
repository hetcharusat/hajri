"""
Predictions API endpoints for HAJRI Engine.

SIMPLIFIED PREDICTIONS:
- Current attendance (present/total/percentage) - like college dashboard
- can_bunk: Classes you can safely skip
- must_attend: Minimum classes you MUST attend for 75%
"""

from fastapi import APIRouter, Depends
from supabase import Client
import pendulum

from app.core.auth import AuthenticatedUser, get_current_student
from app.core.database import get_db
from app.models.schemas import (
    PredictionsResponse, 
    SubjectPrediction,
    AttendanceDashboardResponse,
    SubjectAttendance
)
from app.services.attendance import get_student_context
from app.services.predictions import (
    compute_simple_prediction,
    compute_percentage,
    determine_simple_status
)


router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.get("/dashboard")
async def get_dashboard(
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
) -> AttendanceDashboardResponse:
    """
    Get current attendance dashboard - mimics college portal view.
    Shows: Present / Total = Percentage for each subject.
    """
    context = await get_student_context(db, user.student_id)
    
    # Get attendance summaries
    result = db.table("attendance_summary") \
        .select("*, subjects(code, name, type)") \
        .eq("student_id", user.student_id) \
        .eq("batch_id", context["batch_id"]) \
        .execute()
    
    subjects = []
    overall_present = 0
    overall_total = 0
    last_updated = None
    
    for row in result.data or []:
        subj = row.get("subjects", {})
        present = row["current_present"]
        total = row["current_total"]
        pct = compute_percentage(present, total)
        
        subjects.append(SubjectAttendance(
            subject_id=row["subject_id"],
            subject_code=subj.get("code", ""),
            subject_name=subj.get("name", ""),
            class_type=row["class_type"],
            present=present,
            total=total,
            percentage=pct,
            status=determine_simple_status(pct)
        ))
        
        overall_present += present
        overall_total += total
        
        if row.get("last_recomputed_at"):
            ts = pendulum.parse(row["last_recomputed_at"])
            if not last_updated or ts > last_updated:
                last_updated = ts
    
    # Get semester name
    semester_result = db.table("semesters") \
        .select("name") \
        .eq("id", context["semester_id"]) \
        .single() \
        .execute()
    semester_name = semester_result.data.get("name", "Current") if semester_result.data else "Current"
    
    return AttendanceDashboardResponse(
        semester=semester_name,
        last_updated=last_updated or pendulum.now("UTC"),
        overall_present=overall_present,
        overall_total=overall_total,
        overall_percentage=compute_percentage(overall_present, overall_total),
        subjects=subjects
    )


@router.get("")
async def get_predictions(
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
) -> PredictionsResponse:
    """
    Get attendance predictions - what you can/must do.
    
    Key metrics:
    - can_bunk: Total classes you can safely skip across all subjects
    - must_attend: Minimum classes you must attend for 75%
    - classes_to_recover: If below 75%, attend this many consecutively to recover
    """
    context = await get_student_context(db, user.student_id)
    
    # Get attendance summary with semester totals for remaining classes calc
    summary_result = db.table("attendance_summary") \
        .select("*, subjects(code, name, type)") \
        .eq("student_id", user.student_id) \
        .eq("batch_id", context["batch_id"]) \
        .execute()
    
    # Get semester totals (expected classes per subject)
    totals_result = db.table("semester_subject_totals") \
        .select("subject_id, total_classes_in_semester") \
        .eq("batch_id", context["batch_id"]) \
        .eq("semester_id", context["semester_id"]) \
        .execute()
    
    # Build lookup: subject_id -> expected total
    expected_totals = {r["subject_id"]: r["total_classes_in_semester"] for r in (totals_result.data or [])}
    
    subjects = []
    total_can_bunk = 0
    total_must_attend = 0
    subjects_at_risk = 0
    total_remaining = 0
    
    for row in summary_result.data or []:
        subj = row.get("subjects", {})
        subject_id = row["subject_id"]
        present = row["current_present"]
        total = row["current_total"]
        pct = compute_percentage(present, total)
        
        # Calculate remaining classes
        expected = expected_totals.get(subject_id, 0)
        remaining = max(0, expected - total)
        total_remaining += remaining
        
        # Compute predictions
        pred = compute_simple_prediction(present, total, remaining)
        
        subjects.append(SubjectPrediction(
            subject_id=subject_id,
            subject_code=subj.get("code", ""),
            subject_name=subj.get("name", ""),
            class_type=row["class_type"],
            present=present,
            total=total,
            percentage=pct,
            can_bunk=pred["can_bunk"],
            must_attend=pred["must_attend"],
            classes_remaining=remaining,
            semester_total=pred["semester_total"],
            classes_to_recover=pred["classes_to_recover"],
            status=pred["status"]
        ))
        
        total_can_bunk += pred["can_bunk"]
        total_must_attend += pred["must_attend"]
        if pct < 75:
            subjects_at_risk += 1
    
    # Get semester info
    semester_result = db.table("semesters") \
        .select("name, end_date") \
        .eq("id", context["semester_id"]) \
        .single() \
        .execute()
    
    semester_name = "Current"
    semester_end = None
    if semester_result.data:
        semester_name = semester_result.data.get("name", "Current")
        semester_end = semester_result.data.get("end_date")
    
    return PredictionsResponse(
        student_id=user.student_id,
        semester=semester_name,
        semester_end=semester_end,
        classes_remaining_in_semester=total_remaining,
        total_can_bunk=total_can_bunk,
        total_must_attend=total_must_attend,
        subjects_at_risk=subjects_at_risk,
        subjects=subjects,
        computed_at=pendulum.now("UTC")
    )
