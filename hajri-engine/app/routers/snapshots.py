"""
Snapshot API endpoints for HAJRI Engine.
"""

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from supabase import Client

from app.core.auth import AuthenticatedUser, get_current_student
from app.core.database import get_db
from app.core.exceptions import PolicyViolation
from app.models.schemas import (
    SnapshotConfirmRequest,
    SnapshotConfirmResponse,
    PolicyViolationResponse
)
from app.models.enums import ComputeTrigger
from app.services.snapshots import (
    save_snapshot,
    check_snapshot_decreases,
    get_latest_snapshot
)
from app.services.attendance import recompute_for_student, get_student_context


router = APIRouter(prefix="/snapshots", tags=["Snapshots"])


@router.post(
    "/confirm",
    response_model=SnapshotConfirmResponse,
    responses={
        400: {"model": PolicyViolationResponse, "description": "Policy violation"},
        401: {"description": "Unauthorized"}
    }
)
async def confirm_snapshot(
    request: SnapshotConfirmRequest,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
):
    """
    Confirm an OCR snapshot as the new baseline.
    
    This:
    1. Saves the snapshot as immutable record
    2. Matches subject codes to database subjects
    3. Triggers background recomputation
    
    If the new snapshot shows DECREASED totals for any subject,
    and confirm_decreases is False, returns a warning requiring confirmation.
    """
    try:
        # Get student context
        context = await get_student_context(db, user.student_id)
        batch_id = context["batch_id"]
        semester_id = context["semester_id"]
        
        # Check for decreases
        if not request.confirm_decreases:
            decreases = await check_snapshot_decreases(
                db, user.student_id, batch_id, request.entries
            )
            if decreases:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "snapshot_decrease_warning",
                        "message": "Some subjects show decreased totals. Please confirm.",
                        "subjects": decreases,
                        "action": "Set confirm_decreases=true to proceed"
                    }
                )
        
        # Save snapshot
        snapshot_id, unmatched = await save_snapshot(
            db, user.student_id, batch_id, semester_id, request
        )
        
        # Prepare warnings
        warnings = []
        if unmatched:
            warnings.append(f"Unmatched subject codes: {', '.join(unmatched)}")
        
        # Trigger recomputation in background
        background_tasks.add_task(
            recompute_for_student,
            db,
            user.student_id,
            ComputeTrigger.SNAPSHOT_CONFIRM,
            snapshot_id
        )
        
        return SnapshotConfirmResponse(
            snapshot_id=snapshot_id,
            confirmed_at=request.captured_at,
            entries_processed=len(request.entries),
            subjects_matched=len(request.entries) - len(unmatched),
            subjects_unmatched=unmatched,
            recompute_triggered=True,
            warnings=warnings
        )
        
    except PolicyViolation as e:
        raise HTTPException(status_code=400, detail=e.to_dict())


@router.get("/latest")
async def get_latest(
    user: AuthenticatedUser = Depends(get_current_student),
    db: Client = Depends(get_db)
):
    """
    Get the latest confirmed snapshot for the current student.
    """
    context = await get_student_context(db, user.student_id)
    snapshot = await get_latest_snapshot(db, user.student_id, context["batch_id"])
    
    if not snapshot:
        return {"snapshot": None, "message": "No snapshot found"}
    
    return {
        "snapshot": snapshot,
        "entries_count": len(snapshot.get("entries", []))
    }
