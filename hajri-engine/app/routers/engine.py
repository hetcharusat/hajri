"""
Engine control API endpoints for HAJRI Engine.
Internal/debug endpoints for forcing recomputation.
"""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
import pendulum

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.database import get_db
from app.models.schemas import RecomputeRequest, RecomputeResponse
from app.models.enums import ComputeTrigger
from app.services.attendance import recompute_for_student


router = APIRouter(prefix="/engine", tags=["Engine Control"])


@router.post(
    "/recompute",
    response_model=RecomputeResponse
)
async def force_recompute(
    request: RecomputeRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Force recomputation for a student.
    
    This is an internal/debug endpoint.
    In production, use with caution.
    """
    start = pendulum.now("UTC")
    
    # If student_id specified, use it; otherwise use current user
    student_id = request.student_id
    if not student_id:
        if not user.student_id:
            raise HTTPException(
                status_code=400,
                detail="No student_id specified and current user is not a student"
            )
        student_id = user.student_id
    
    # Admin can recompute for any student
    if request.student_id and not user.is_admin:
        if request.student_id != user.student_id:
            raise HTTPException(
                status_code=403,
                detail="Can only recompute your own data"
            )
    
    subjects_updated, status = await recompute_for_student(
        db,
        student_id,
        ComputeTrigger.FORCE_RECOMPUTE,
        None
    )
    
    end = pendulum.now("UTC")
    duration_ms = int((end - start).total_seconds() * 1000)
    
    return RecomputeResponse(
        students_processed=1,
        subjects_updated=subjects_updated,
        duration_ms=duration_ms,
        status=status.value
    )


@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "hajri-engine",
        "timestamp": pendulum.now("UTC").isoformat()
    }


@router.get("/logs")
async def get_computation_logs(
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_db),
    limit: int = 20
):
    """
    Get recent computation logs for the current student.
    """
    if not user.student_id:
        raise HTTPException(status_code=400, detail="Not a student")
    
    result = db.table("engine_computation_log") \
        .select("*") \
        .eq("student_id", user.student_id) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    
    return {"logs": result.data or []}
