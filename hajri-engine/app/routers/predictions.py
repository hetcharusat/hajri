"""
Predictions API endpoints for HAJRI Engine.
"""

from fastapi import APIRouter, Depends
from supabase import Client
import pendulum

from app.core.auth import AuthenticatedUser, get_current_student
from app.core.database import get_db
from app.models.schemas import PredictionsResponse, SubjectPrediction
from app.models.enums import PredictionStatus
from app.services.attendance import get_student_context
from app.services.predictions import compute_recovery_classes


router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.get(
    "",
    response_model=PredictionsResponse
)
async def get_predictions(
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
):
    """
    Get pre-computed attendance predictions.
    
    This is a READ-ONLY endpoint - no computation happens here.
    Shows must_attend and can_bunk for each subject.
    """
    context = await get_student_context(db, user.student_id)
    
    # Get all predictions for this student
    result = db.table("attendance_predictions") \
        .select("*, subjects(code, name)") \
        .eq("student_id", user.student_id) \
        .eq("batch_id", context["batch_id"]) \
        .execute()
    
    subjects = []
    safe_count = 0
    warning_count = 0
    danger_count = 0
    critical_count = 0
    
    for row in result.data or []:
        subj = row.get("subjects", {})
        status = PredictionStatus(row["status"]) if row["status"] else PredictionStatus.SAFE
        
        # Count by status
        if status == PredictionStatus.SAFE:
            safe_count += 1
        elif status == PredictionStatus.WARNING:
            warning_count += 1
        elif status == PredictionStatus.DANGER:
            danger_count += 1
        elif status == PredictionStatus.CRITICAL:
            critical_count += 1
        
        # Calculate recovery classes if below threshold
        recovery = None
        if status in [PredictionStatus.DANGER, PredictionStatus.CRITICAL]:
            recovery = compute_recovery_classes(
                row["current_present"],
                row["current_total"],
                float(row["required_percentage"])
            )
        
        subjects.append(SubjectPrediction(
            subject_id=row["subject_id"],
            subject_code=subj.get("code", ""),
            subject_name=subj.get("name", ""),
            current_present=row["current_present"],
            current_total=row["current_total"],
            current_percentage=float(row["current_percentage"] or 0),
            required_percentage=float(row["required_percentage"]),
            remaining_classes=row["remaining_classes"],
            must_attend=row["must_attend"],
            can_bunk=row["can_bunk"],
            status=status,
            classes_to_recover=recovery
        ))
    
    # Get semester end date
    semester_end = None
    semester_result = db.table("teaching_periods") \
        .select("end_date") \
        .eq("is_current", True) \
        .limit(1) \
        .execute()
    
    if semester_result.data:
        semester_end = semester_result.data[0]["end_date"]
    
    return PredictionsResponse(
        student_id=user.student_id,
        semester_end_date=semester_end,
        subjects=subjects,
        safe_count=safe_count,
        warning_count=warning_count,
        danger_count=danger_count,
        critical_count=critical_count,
        computed_at=pendulum.now("UTC")
    )
