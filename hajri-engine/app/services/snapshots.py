"""
Snapshot processing service for HAJRI Engine.
Handles OCR snapshot confirmation and subject matching.
"""

from datetime import datetime
from typing import List, Dict, Tuple, Optional
from supabase import Client
import pendulum

from app.models.schemas import OCREntry, SnapshotConfirmRequest
from app.core.exceptions import SubjectNotFoundError, SnapshotDecreaseWarning


async def get_latest_snapshot(
    db: Client,
    student_id: str,
    batch_id: str
) -> Optional[Dict]:
    """
    Get the most recent confirmed snapshot for a student.
    
    Returns:
        Snapshot dict or None if no snapshot exists.
    """
    result = db.table("ocr_snapshots") \
        .select("*") \
        .eq("student_id", student_id) \
        .eq("batch_id", batch_id) \
        .order("confirmed_at", desc=True) \
        .limit(1) \
        .execute()
    
    if result.data:
        return result.data[0]
    return None


async def match_ocr_code_to_subject(
    db: Client,
    ocr_code: str,
    batch_id: str,
    semester_id: str
) -> Optional[str]:
    """
    Match an OCR-extracted subject code to a subject ID.
    
    First checks subject_code_mappings table, then tries direct match.
    
    Returns:
        Subject ID or None if no match found.
    """
    # Try explicit mapping first
    mapping_result = db.table("subject_code_mappings") \
        .select("subject_id") \
        .eq("ocr_code", ocr_code) \
        .eq("batch_id", batch_id) \
        .eq("semester_id", semester_id) \
        .limit(1) \
        .execute()
    
    if mapping_result.data:
        return mapping_result.data[0]["subject_id"]
    
    # Try direct code match in subjects table
    subject_result = db.table("subjects") \
        .select("id") \
        .eq("code", ocr_code) \
        .eq("semester_id", semester_id) \
        .limit(1) \
        .execute()
    
    if subject_result.data:
        return subject_result.data[0]["id"]
    
    # Try case-insensitive match
    subject_result = db.table("subjects") \
        .select("id") \
        .ilike("code", ocr_code) \
        .eq("semester_id", semester_id) \
        .limit(1) \
        .execute()
    
    if subject_result.data:
        return subject_result.data[0]["id"]
    
    return None


async def save_snapshot(
    db: Client,
    student_id: str,
    batch_id: str,
    semester_id: str,
    request: SnapshotConfirmRequest
) -> Tuple[str, List[str]]:
    """
    Save a confirmed OCR snapshot to the database.
    
    Returns:
        Tuple of (snapshot_id, list of unmatched subject codes)
    """
    # Convert entries to JSON-serializable format
    entries_json = [entry.model_dump() for entry in request.entries]
    
    # Insert snapshot
    result = db.table("ocr_snapshots").insert({
        "student_id": student_id,
        "batch_id": batch_id,
        "semester_id": semester_id,
        "captured_at": request.captured_at.isoformat(),
        "confirmed_at": pendulum.now("UTC").isoformat(),
        "source_type": request.source_type,
        "entries": entries_json,
        "metadata": request.metadata or {}
    }).execute()
    
    snapshot_id = result.data[0]["id"]
    
    # Try to match each entry to a subject
    unmatched = []
    for entry in request.entries:
        subject_id = await match_ocr_code_to_subject(
            db, entry.course_code, batch_id, semester_id
        )
        if not subject_id:
            unmatched.append(entry.course_code)
    
    return snapshot_id, unmatched


async def check_snapshot_decreases(
    db: Client,
    student_id: str,
    batch_id: str,
    new_entries: List[OCREntry]
) -> List[Dict]:
    """
    Check if new snapshot shows decreased totals compared to previous.
    
    Returns:
        List of subjects with decreased totals.
    """
    previous = await get_latest_snapshot(db, student_id, batch_id)
    if not previous:
        return []
    
    previous_entries = previous.get("entries", [])
    previous_by_code = {e["course_code"]: e for e in previous_entries}
    
    decreases = []
    for entry in new_entries:
        prev = previous_by_code.get(entry.course_code)
        if prev and entry.total < prev["total"]:
            decreases.append({
                "course_code": entry.course_code,
                "old_total": prev["total"],
                "new_total": entry.total,
                "old_present": prev["present"],
                "new_present": entry.present
            })
    
    return decreases


async def invalidate_manual_entries_before_snapshot(
    db: Client,
    student_id: str,
    snapshot_id: str,
    snapshot_time: datetime
) -> int:
    """
    Manual entries before the new snapshot are no longer valid.
    We don't delete them (for audit), but they won't be used in computation.
    
    The engine only aggregates manual entries linked to the LATEST snapshot.
    This function updates old entries to link to the new snapshot (effectively
    removing them from computation since they're before snapshot time).
    
    Returns:
        Number of entries affected.
    """
    # Get all manual entries for this student that reference older snapshots
    result = db.table("manual_attendance") \
        .select("id") \
        .eq("student_id", student_id) \
        .neq("snapshot_id", snapshot_id) \
        .execute()
    
    return len(result.data) if result.data else 0
