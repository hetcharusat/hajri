"""
Engine control API endpoints for HAJRI Engine.
Internal/debug endpoints for forcing recomputation.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
import pendulum

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.database import get_db
from app.models.schemas import RecomputeRequest, RecomputeResponse
from app.models.enums import ComputeTrigger
from app.services.attendance import recompute_for_student
from app.services.semester_totals import (
    calculate_semester_totals,
    persist_semester_totals,
    count_weekly_slots_per_subject,
    get_teaching_period_for_semester,
    get_non_teaching_dates,
    get_weekly_off_settings,
    is_saturday_off
)


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


@router.post("/test-recompute/{student_id}")
async def test_recompute(
    student_id: str,
    db: Client = Depends(get_db)
):
    """
    Test recompute endpoint - NO AUTH REQUIRED.
    For development testing only.
    """
    start = pendulum.now("UTC")
    
    try:
        subjects_updated, status = await recompute_for_student(
            db,
            student_id,
            ComputeTrigger.FORCE_RECOMPUTE,
            None
        )
        
        end = pendulum.now("UTC")
        duration_ms = int((end - start).total_seconds() * 1000)
        
        return {
            "success": True,
            "students_processed": 1,
            "subjects_updated": subjects_updated,
            "duration_ms": duration_ms,
            "status": status.value
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc()
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


# ============================================================================
# ADMIN ENDPOINTS - Pre-Process 1: Semester Totals Calculation
# ============================================================================

@router.post("/admin/calculate-semester-totals")
async def admin_calculate_semester_totals(
    batch_id: str,
    semester_id: str,
    persist: bool = True,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    PRE-PROCESS 1: Calculate total lectures/labs for each subject in semester.
    
    This uses:
    - Timetable (slots per week per subject)
    - Academic Calendar (holidays, vacations, exams)
    - Teaching Period (semester start/end dates)
    
    Admin should run this whenever timetable or calendar changes.
    """
    return await _calculate_semester_totals_impl(db, batch_id, semester_id, persist)


@router.post("/test/calculate-semester-totals")
async def test_calculate_semester_totals(
    batch_id: str,
    semester_id: str,
    persist: bool = True,
    db: Client = Depends(get_db)
):
    """
    Test version of semester totals calculation - NO AUTH.
    """
    return await _calculate_semester_totals_impl(db, batch_id, semester_id, persist)


@router.post("/test/calculate-semester-totals-bulk")
async def test_calculate_semester_totals_bulk(
    class_id: str = None,
    semester_id: str = None,
    department: str = None,
    branch: str = None,
    semester_num: int = None,
    persist: bool = True,
    db: Client = Depends(get_db)
):
    """
    Calculate semester totals for multiple batches at once.
    NO AUTH - for test portal only.
    
    Use either:
    - class_id + semester_id: All batches in a specific class
    - department + branch + semester_num: All matching batches
    """
    import asyncio
    start = pendulum.now("UTC")
    
    try:
        # Find matching batches
        query = db.table("batches").select("id, name, batch_letter, class_id, classes(id, semester_id)")
        
        if class_id:
            query = query.eq("class_id", class_id)
        
        result = query.execute()
        batches = result.data or []
        
        # Filter by semester_id if provided
        if semester_id:
            batches = [b for b in batches if b.get("classes", {}).get("semester_id") == semester_id]
        
        if not batches:
            return {"error": "No batches found matching criteria"}
        
        # Calculate for each batch
        results = []
        total_subjects = 0
        errors = []
        
        for batch in batches:
            batch_id = batch["id"]
            sem_id = semester_id or batch.get("classes", {}).get("semester_id")
            
            if not sem_id:
                errors.append(f"Batch {batch_id}: No semester_id")
                continue
            
            try:
                calc_result = await _calculate_semester_totals_impl(db, batch_id, sem_id, persist)
                if calc_result.get("status") == "success":
                    results.append({
                        "batch_id": batch_id,
                        "batch_name": batch.get("name") or batch.get("batch_letter") or "Full",
                        "subjects_calculated": calc_result.get("subjects_calculated", 0),
                        "duration_ms": calc_result.get("duration_ms", 0)
                    })
                    total_subjects += calc_result.get("subjects_calculated", 0)
                else:
                    errors.append(f"Batch {batch_id}: {calc_result.get('message')}")
            except Exception as e:
                errors.append(f"Batch {batch_id}: {str(e)}")
        
        end = pendulum.now("UTC")
        duration_ms = int((end - start).total_seconds() * 1000)
        
        return {
            "status": "success",
            "batches_processed": len(results),
            "total_subjects": total_subjects,
            "duration_ms": duration_ms,
            "results": results,
            "errors": errors if errors else None
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


async def _calculate_semester_totals_impl(db: Client, batch_id: str, semester_id: str, persist: bool):
    """Internal implementation for semester totals calculation."""
    start = pendulum.now("UTC")
    
    try:
        # Calculate totals
        totals = await calculate_semester_totals(db, batch_id, semester_id)
        
        if not totals:
            return {
                "status": "error",
                "message": "No subjects found. Check timetable is published.",
                "subjects": []
            }
        
        # Persist if requested
        persisted_count = 0
        if persist:
            persisted_count = await persist_semester_totals(db, batch_id, semester_id, totals)
        
        end = pendulum.now("UTC")
        duration_ms = int((end - start).total_seconds() * 1000)
        
        # Format response
        subjects_list = []
        for subject_id, data in totals.items():
            subjects_list.append({
                "subject_code": data["subject_code"],
                "subject_name": data["subject_name"],
                "class_type": data["class_type"],
                "slots_per_week": data["slots_per_week"],
                "total_classes_in_semester": data["total_classes_in_semester"],
                "calculation_details": data["calculation_details"]
            })
        
        return {
            "status": "success",
            "batch_id": batch_id,
            "semester_id": semester_id,
            "subjects_calculated": len(subjects_list),
            "subjects_persisted": persisted_count,
            "duration_ms": duration_ms,
            "subjects": subjects_list
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "subjects": []
        }


@router.get("/admin/semester-totals/{batch_id}/{semester_id}")
async def get_semester_totals(
    batch_id: str,
    semester_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Get precomputed semester totals for a batch.
    """
    result = db.table("semester_subject_totals") \
        .select("*, subjects(code, name)") \
        .eq("batch_id", batch_id) \
        .eq("semester_id", semester_id) \
        .execute()
    
    return {
        "batch_id": batch_id,
        "semester_id": semester_id,
        "subjects": result.data or []
    }


@router.get("/debug/student-context")
async def debug_student_context(
    student_id: str,
    db: Client = Depends(get_db)
):
    """
    Debug endpoint to see full student context and engine data.
    NO AUTH for testing.
    """
    target_student_id = student_id
    
    if not target_student_id:
        raise HTTPException(status_code=400, detail="No student_id specified")
    
    # Get app_user context
    app_user = db.table("app_users") \
        .select("*, students(*)") \
        .eq("student_id", target_student_id) \
        .single() \
        .execute()
    
    if not app_user.data:
        return {"error": "No app_users record found", "student_id": target_student_id}
    
    batch_id = app_user.data.get("current_batch_id")
    semester_id = app_user.data.get("current_semester_id")
    
    # Get subjects
    subjects = db.table("course_offerings") \
        .select("*, subjects(*)") \
        .eq("batch_id", batch_id) \
        .execute()
    
    # Get timetable
    timetable_version = db.table("timetable_versions") \
        .select("id, name, status") \
        .eq("batch_id", batch_id) \
        .eq("status", "published") \
        .limit(1) \
        .execute()
    
    timetable_events = []
    if timetable_version.data:
        version_id = timetable_version.data[0]["id"]
        events = db.table("timetable_events") \
            .select("*, course_offerings(*, subjects(*))") \
            .eq("version_id", version_id) \
            .execute()
        timetable_events = events.data or []
    
    # Get snapshot
    snapshot = db.table("ocr_snapshots") \
        .select("*") \
        .eq("student_id", target_student_id) \
        .order("confirmed_at", desc=True) \
        .limit(1) \
        .execute()
    
    # Get semester totals
    semester_totals = db.table("semester_subject_totals") \
        .select("*, subjects(code, name)") \
        .eq("batch_id", batch_id) \
        .eq("semester_id", semester_id) \
        .execute()
    
    # Get attendance summary
    summary = db.table("attendance_summary") \
        .select("*, subjects(code, name)") \
        .eq("student_id", target_student_id) \
        .execute()
    
    # Get predictions
    predictions = db.table("attendance_predictions") \
        .select("*, subjects(code, name)") \
        .eq("student_id", target_student_id) \
        .execute()
    
    # Get manual attendance entries
    manual_entries = db.table("manual_attendance") \
        .select("*, subjects(code, name)") \
        .eq("student_id", target_student_id) \
        .order("event_date", desc=False) \
        .execute()
    
    return {
        "student_id": target_student_id,
        "app_user": {
            "id": app_user.data.get("id"),
            "batch_id": batch_id,
            "semester_id": semester_id,
            "student_name": app_user.data.get("students", {}).get("name")
        },
        "subjects_count": len(subjects.data or []),
        "subjects": [
            {
                "id": s.get("subject_id"),
                "code": s.get("subjects", {}).get("code"),
                "name": s.get("subjects", {}).get("name"),
                "type": s.get("subjects", {}).get("type")
            }
            for s in (subjects.data or [])
        ],
        "timetable": {
            "version": timetable_version.data[0] if timetable_version.data else None,
            "events_count": len(timetable_events)
        },
        "snapshot": snapshot.data[0] if snapshot.data else None,
        "semester_totals": semester_totals.data or [],
        "attendance_summary": summary.data or [],
        "predictions": predictions.data or [],
        "manual_attendance": manual_entries.data or []
    }


# =============================================================================
# TEST ENDPOINTS - Manual Attendance CRUD (No Auth)
# =============================================================================

@router.post("/test/manual-attendance")
async def test_add_manual_attendance(
    student_id: str,
    subject_id: str,
    event_date: str,
    status: str = "PRESENT",
    class_type: str = "LECTURE",
    db: Client = Depends(get_db)
):
    """
    Add/update manual attendance entry for testing.
    NO AUTH - for test portal only.
    
    Args:
        student_id: The student UUID
        subject_id: The subject UUID
        event_date: Date string YYYY-MM-DD
        status: PRESENT, ABSENT, or CANCELLED
        class_type: LECTURE, LAB, or TUTORIAL
    """
    try:
        # Get student's snapshot
        snapshot = db.table("ocr_snapshots") \
            .select("id, confirmed_at") \
            .eq("student_id", student_id) \
            .order("confirmed_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not snapshot.data:
            return {"error": "No snapshot found for student", "student_id": student_id}
        
        snapshot_id = snapshot.data[0]["id"]
        
        # Check if entry already exists
        existing = db.table("manual_attendance") \
            .select("id") \
            .eq("student_id", student_id) \
            .eq("subject_id", subject_id) \
            .eq("event_date", event_date) \
            .eq("class_type", class_type) \
            .limit(1) \
            .execute()
        
        if existing.data:
            # Update existing
            result = db.table("manual_attendance") \
                .update({"status": status}) \
                .eq("id", existing.data[0]["id"]) \
                .execute()
            action = "updated"
            entry_id = existing.data[0]["id"]
        else:
            # Insert new
            result = db.table("manual_attendance").insert({
                "student_id": student_id,
                "subject_id": subject_id,
                "snapshot_id": snapshot_id,
                "event_date": event_date,
                "class_type": class_type,
                "status": status
            }).execute()
            action = "created"
            entry_id = result.data[0]["id"]
        
        return {
            "success": True,
            "action": action,
            "entry_id": entry_id,
            "event_date": event_date,
            "status": status
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.post("/test/bulk-manual-attendance")
async def test_bulk_add_manual_attendance(
    student_id: str,
    subject_id: str,
    start_date: str,
    num_days: int = 10,
    pattern: str = "PPPPPPPPPP",  # P=Present, A=Absent, skip weekends
    class_type: str = "LECTURE",
    db: Client = Depends(get_db)
):
    """
    Add multiple days of manual attendance for testing.
    NO AUTH - for test portal only.
    
    Args:
        student_id: The student UUID
        subject_id: The subject UUID
        start_date: Starting date YYYY-MM-DD
        num_days: Number of attendance entries to create
        pattern: String of P/A for each day (P=Present, A=Absent)
        class_type: LECTURE, LAB, or TUTORIAL
    """
    import pendulum
    
    try:
        # Get student's snapshot
        snapshot = db.table("ocr_snapshots") \
            .select("id, confirmed_at") \
            .eq("student_id", student_id) \
            .order("confirmed_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not snapshot.data:
            return {"error": "No snapshot found for student"}
        
        snapshot_id = snapshot.data[0]["id"]
        
        # Generate entries
        current = pendulum.parse(start_date)
        entries_created = []
        pattern_idx = 0
        
        while len(entries_created) < num_days and pattern_idx < len(pattern):
            # Skip weekends (Sunday = 0 in some systems, we use Python weekday)
            if current.weekday() == 6:  # Sunday
                current = current.add(days=1)
                continue
            
            status = "PRESENT" if pattern[pattern_idx].upper() == "P" else "ABSENT"
            date_str = current.format("YYYY-MM-DD")
            
            # Check if exists
            existing = db.table("manual_attendance") \
                .select("id") \
                .eq("student_id", student_id) \
                .eq("subject_id", subject_id) \
                .eq("event_date", date_str) \
                .eq("class_type", class_type) \
                .limit(1) \
                .execute()
            
            if existing.data:
                db.table("manual_attendance") \
                    .update({"status": status}) \
                    .eq("id", existing.data[0]["id"]) \
                    .execute()
                action = "updated"
                entry_id = existing.data[0]["id"]
            else:
                result = db.table("manual_attendance").insert({
                    "student_id": student_id,
                    "subject_id": subject_id,
                    "snapshot_id": snapshot_id,
                    "event_date": date_str,
                    "class_type": class_type,
                    "status": status
                }).execute()
                action = "created"
                entry_id = result.data[0]["id"]
            
            entries_created.append({
                "date": date_str,
                "status": status,
                "action": action,
                "id": entry_id
            })
            
            pattern_idx += 1
            current = current.add(days=1)
        
        return {
            "success": True,
            "entries_created": len(entries_created),
            "entries": entries_created
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.put("/test/manual-attendance/{entry_id}")
async def test_update_manual_attendance(
    entry_id: str,
    status: str,
    db: Client = Depends(get_db)
):
    """
    Update a specific manual attendance entry.
    NO AUTH - for test portal only.
    
    Args:
        entry_id: The manual_attendance UUID
        status: New status (PRESENT, ABSENT, CANCELLED)
    """
    try:
        result = db.table("manual_attendance") \
            .update({"status": status}) \
            .eq("id", entry_id) \
            .execute()
        
        if not result.data:
            return {"error": "Entry not found", "entry_id": entry_id}
        
        return {
            "success": True,
            "entry_id": entry_id,
            "new_status": status,
            "updated_at": result.data[0].get("updated_at")
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.delete("/test/manual-attendance/{entry_id}")
async def test_delete_manual_attendance(
    entry_id: str,
    db: Client = Depends(get_db)
):
    """
    Delete a specific manual attendance entry.
    NO AUTH - for test portal only.
    """
    try:
        db.table("manual_attendance") \
            .delete() \
            .eq("id", entry_id) \
            .execute()
        
        return {"success": True, "deleted_id": entry_id}
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.delete("/test/clear-manual-attendance/{student_id}")
async def test_clear_manual_attendance(
    student_id: str,
    db: Client = Depends(get_db)
):
    """
    Delete all manual attendance entries for a student.
    NO AUTH - for test portal only.
    """
    try:
        result = db.table("manual_attendance") \
            .delete() \
            .eq("student_id", student_id) \
            .execute()
        
        return {
            "success": True,
            "student_id": student_id,
            "entries_deleted": len(result.data or [])
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/test/batch/{batch_id}")
async def test_get_batch_details(
    batch_id: str,
    db: Client = Depends(get_db)
):
    """
    Get detailed batch information including subjects, timetable, students.
    NO AUTH - for test portal only.
    """
    try:
        # Get batch info
        batch = db.table("batches") \
            .select("*, classes(name)") \
            .eq("id", batch_id) \
            .single() \
            .execute()
        
        if not batch.data:
            return {"error": "Batch not found"}
        
        # Get subjects/course offerings
        offerings = db.table("course_offerings") \
            .select("*, subjects(id, code, name, type, credits)") \
            .eq("batch_id", batch_id) \
            .execute()
        
        # Get timetable events
        version = db.table("timetable_versions") \
            .select("id, name, status") \
            .eq("batch_id", batch_id) \
            .eq("status", "published") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        events = []
        weekly_summary = {}
        if version.data:
            events_result = db.table("timetable_events") \
                .select("*, course_offerings(subjects(code, name, type))") \
                .eq("version_id", version.data[0]["id"]) \
                .order("day_of_week") \
                .order("start_time") \
                .execute()
            events = events_result.data or []
            
            # Summarize by subject
            for e in events:
                subj = e.get("course_offerings", {}).get("subjects", {})
                code = subj.get("code", "Unknown")
                if code not in weekly_summary:
                    weekly_summary[code] = {"name": subj.get("name"), "type": subj.get("type"), "slots_per_week": 0, "days": []}
                weekly_summary[code]["slots_per_week"] += 1
                # DB uses 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday
                day_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][e.get("day_of_week", 0)]
                weekly_summary[code]["days"].append(day_name)
        
        # Get students in this batch
        students = db.table("students") \
            .select("id, name, roll_number") \
            .eq("batch_id", batch_id) \
            .limit(10) \
            .execute()
        
        # Get academic year
        academic_year = db.table("academic_years") \
            .select("*") \
            .limit(1) \
            .execute()
        
        return {
            "batch": {
                "id": batch.data.get("id"),
                "name": batch.data.get("name"),
                "class_name": batch.data.get("classes", {}).get("name"),
                "current_semester_id": batch.data.get("current_semester_id")
            },
            "subjects": [
                {
                    "id": o.get("subjects", {}).get("id"),
                    "code": o.get("subjects", {}).get("code"),
                    "name": o.get("subjects", {}).get("name"),
                    "type": o.get("subjects", {}).get("type"),
                    "credits": o.get("subjects", {}).get("credits")
                }
                for o in (offerings.data or [])
            ],
            "timetable": {
                "version": version.data[0] if version.data else None,
                "events_count": len(events),
                "weekly_summary": weekly_summary
            },
            "students_sample": students.data or [],
            "academic_year": academic_year.data[0] if academic_year.data else None
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.post("/test/setup-real-test")
async def test_setup_real_batch_test(
    batch_id: str,
    semester_start: str = "2025-12-15",
    semester_end: str = "2026-04-10",
    db: Client = Depends(get_db)
):
    """
    Set up a test student in a real batch with real timetable.
    Creates or reuses a test student and app_user record.
    Also creates a semester if one doesn't exist.
    NO AUTH - for test portal only.
    """
    try:
        test_student_id = "11111111-1111-1111-1111-111111111111"
        
        # Get batch info
        batch = db.table("batches") \
            .select("*") \
            .eq("id", batch_id) \
            .single() \
            .execute()
        
        if not batch.data:
            return {"error": "Batch not found"}
        
        # Check for any existing semester or create one
        existing_sem = db.table("semesters") \
            .select("id") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if existing_sem.data:
            semester_id = existing_sem.data[0]["id"]
        else:
            # Create a new semester
            new_sem = db.table("semesters").insert({
                "name": "Even Semester 2025-26",
                "start_date": semester_start,
                "end_date": semester_end
            }).execute()
            semester_id = new_sem.data[0]["id"]
        
        # Check if test student exists
        existing = db.table("students") \
            .select("id") \
            .eq("id", test_student_id) \
            .limit(1) \
            .execute()
        
        if existing.data:
            # Update to new batch
            db.table("students") \
                .update({"batch_id": batch_id}) \
                .eq("id", test_student_id) \
                .execute()
            action = "updated"
        else:
            # Create test student
            db.table("students").insert({
                "id": test_student_id,
                "name": "Test Student (Real Batch)",
                "roll_number": "TEST001",
                "batch_id": batch_id,
                "email": "test@test.com"
            }).execute()
            action = "created"
        
        # Update or create app_user
        app_user = db.table("app_users") \
            .select("id") \
            .eq("student_id", test_student_id) \
            .limit(1) \
            .execute()
        
        if app_user.data:
            db.table("app_users") \
                .update({
                    "current_batch_id": batch_id,
                    "current_semester_id": semester_id
                }) \
                .eq("id", app_user.data[0]["id"]) \
                .execute()
        else:
            db.table("app_users").insert({
                "student_id": test_student_id,
                "current_batch_id": batch_id,
                "current_semester_id": semester_id,
                "onboarding_completed": True
            }).execute()
        
        # Clear old data
        db.table("ocr_snapshots").delete().eq("student_id", test_student_id).execute()
        db.table("manual_attendance").delete().eq("student_id", test_student_id).execute()
        db.table("attendance_summary").delete().eq("student_id", test_student_id).execute()
        db.table("attendance_predictions").delete().eq("student_id", test_student_id).execute()
        
        return {
            "success": True,
            "action": action,
            "student_id": test_student_id,
            "batch_id": batch_id,
            "semester_id": semester_id,
            "message": f"Test student {action} in batch. Old data cleared. Ready for testing!"
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/test/all-batches")
async def test_get_all_batches(
    db: Client = Depends(get_db)
):
    """
    Get all batches with class/department info for testing.
    """
    try:
        result = db.table("batches") \
            .select("id, name, batch_letter, class_id, classes(id, name, class_number, semester_id)") \
            .order("created_at", desc=True) \
            .execute()
        
        # Get all semesters (branch_id, semester_number)
        semesters_result = db.table("semesters") \
            .select("id, semester_number, branch_id") \
            .execute()
        
        # Get all branches (which map to departments)
        branches_result = db.table("branches") \
            .select("id, name, department_id") \
            .execute()
        
        # Get all departments
        depts_result = db.table("departments") \
            .select("id, name") \
            .execute()
        
        sem_map = {s["id"]: s for s in (semesters_result.data or [])}
        branch_map = {b["id"]: b for b in (branches_result.data or [])}
        dept_map = {d["id"]: d for d in (depts_result.data or [])}
        
        batches = []
        for b in result.data or []:
            cls = b.get("classes", {}) or {}
            sem_id = cls.get("semester_id")
            sem = sem_map.get(sem_id, {})
            branch = branch_map.get(sem.get("branch_id"), {})
            dept = dept_map.get(branch.get("department_id"), {})
            
            # Generate display names - use class_number if name is null
            batch_display = b.get("name") or b.get("batch_letter") or "Full Class"
            class_number = cls.get("class_number")
            class_display = cls.get("name") or (f"Class {class_number}" if class_number else "Class 1")
            
            batches.append({
                "id": b.get("id"),
                "batch_name": b.get("name"),
                "batch_letter": b.get("batch_letter"),
                "batch_display": batch_display,
                "class_id": cls.get("id"),
                "class_name": cls.get("name"),
                "class_number": class_number,
                "class_display": class_display,
                "semester_id": sem_id,
                "semester": sem.get("semester_number"),
                "branch_id": sem.get("branch_id"),
                "branch": branch.get("name"),
                "department_id": branch.get("department_id"),
                "department": dept.get("name"),
                "label": f"{dept.get('name', '?')} → {branch.get('name', '?')} → Sem {sem.get('semester_number', '?')} → {class_display} → {batch_display}"
            })
        
        return {"batches": batches}
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/test/timetables")
async def test_get_available_timetables(
    db: Client = Depends(get_db)
):
    """
    Get all available timetables for testing.
    NO AUTH - for test portal only.
    """
    try:
        result = db.table("timetable_versions") \
            .select("*, batches(name, classes(name)), timetable_events(count)") \
            .order("created_at", desc=True) \
            .execute()
        
        return {
            "timetables": [
                {
                    "id": t.get("id"),
                    "name": t.get("name"),
                    "status": t.get("status"),
                    "batch_id": t.get("batch_id"),
                    "batch_name": t.get("batches", {}).get("name"),
                    "class_name": t.get("batches", {}).get("classes", {}).get("name"),
                    "events_count": t.get("timetable_events", [{}])[0].get("count", 0) if t.get("timetable_events") else 0,
                    "created_at": t.get("created_at")
                }
                for t in (result.data or [])
            ]
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/test/academic-calendar/{academic_year_id}")
async def test_get_academic_calendar(
    academic_year_id: str,
    db: Client = Depends(get_db)
):
    """
    Get academic calendar data for testing.
    Shows holidays, vacations, exam periods.
    """
    try:
        holidays = db.table("calendar_events") \
            .select("*") \
            .eq("academic_year_id", academic_year_id) \
            .eq("is_non_teaching", True) \
            .order("event_date") \
            .execute()
        
        vacations = db.table("vacation_periods") \
            .select("*") \
            .eq("academic_year_id", academic_year_id) \
            .order("start_date") \
            .execute()
        
        exams = db.table("exam_periods") \
            .select("*") \
            .eq("academic_year_id", academic_year_id) \
            .order("start_date") \
            .execute()
        
        return {
            "academic_year_id": academic_year_id,
            "holidays": holidays.data or [],
            "vacations": vacations.data or [],
            "exam_periods": exams.data or []
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/test/student-context/{student_id}")
async def test_student_context(
    student_id: str,
    db: Client = Depends(get_db)
):
    """
    Get student context for debugging.
    NO AUTH - for test portal only.
    """
    try:
        # Get app_user context
        app_user = db.table("app_users") \
            .select("*, students(*)") \
            .eq("student_id", student_id) \
            .single() \
            .execute()
        
        if not app_user.data:
            return {"error": "No app_users record found", "student_id": student_id}
        
        batch_id = app_user.data.get("current_batch_id")
        semester_id = app_user.data.get("current_semester_id")
        
        # Get batch info
        batch = None
        if batch_id:
            batch_result = db.table("batches") \
                .select("*, classes(*)") \
                .eq("id", batch_id) \
                .single() \
                .execute()
            batch = batch_result.data
        
        # Get subjects
        subjects = []
        if batch_id:
            subjects_result = db.table("course_offerings") \
                .select("*, subjects(*)") \
                .eq("batch_id", batch_id) \
                .execute()
            subjects = subjects_result.data or []
        
        # Get timetable events count
        timetable_events_count = 0
        if batch_id:
            timetable_version = db.table("timetable_versions") \
                .select("id") \
                .eq("batch_id", batch_id) \
                .eq("status", "published") \
                .limit(1) \
                .execute()
            if timetable_version.data:
                events = db.table("timetable_events") \
                    .select("id", count="exact") \
                    .eq("version_id", timetable_version.data[0]["id"]) \
                    .execute()
                timetable_events_count = events.count or 0
        
        return {
            "student_id": student_id,
            "student": app_user.data.get("students"),
            "batch_id": batch_id,
            "semester_id": semester_id,
            "batch": batch,
            "subjects_count": len(subjects),
            "subjects": [{"code": s["subjects"]["code"], "name": s["subjects"]["name"], "type": s.get("class_type", "LECTURE")} for s in subjects],
            "timetable_events_count": timetable_events_count
        }
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/test/predictions/{student_id}")
async def test_get_predictions(
    student_id: str,
    db: Client = Depends(get_db)
):
    """
    Get simplified predictions for a student.
    NO AUTH - for test portal only.
    
    Returns:
    - Dashboard view (current attendance per subject)
    - Predictions (can_bunk, must_attend per subject)
    - Overall totals
    """
    from app.services.predictions import compute_simple_prediction, compute_percentage, determine_simple_status
    
    try:
        # Get app_user context
        app_user = db.table("app_users") \
            .select("current_batch_id, current_semester_id") \
            .eq("student_id", student_id) \
            .single() \
            .execute()
        
        if not app_user.data:
            return {"error": "No app_users record found", "student_id": student_id}
        
        batch_id = app_user.data.get("current_batch_id")
        semester_id = app_user.data.get("current_semester_id")
        
        # Get attendance summaries
        summary_result = db.table("attendance_summary") \
            .select("*, subjects(code, name, type)") \
            .eq("student_id", student_id) \
            .eq("batch_id", batch_id) \
            .execute()
        
        # Get semester totals
        totals_result = db.table("semester_subject_totals") \
            .select("subject_id, total_classes_in_semester") \
            .eq("batch_id", batch_id) \
            .eq("semester_id", semester_id) \
            .execute()
        
        expected_totals = {r["subject_id"]: r["total_classes_in_semester"] for r in (totals_result.data or [])}
        
        # Build dashboard and predictions
        dashboard = []
        predictions = []
        total_can_bunk = 0
        total_must_attend = 0
        subjects_at_risk = 0
        overall_present = 0
        overall_total = 0
        total_remaining = 0
        
        for row in summary_result.data or []:
            subj = row.get("subjects", {})
            subject_id = row["subject_id"]
            present = row["current_present"]
            total = row["current_total"]
            pct = compute_percentage(present, total)
            
            overall_present += present
            overall_total += total
            
            # Dashboard entry
            dashboard.append({
                "subject_code": subj.get("code", ""),
                "subject_name": subj.get("name", ""),
                "class_type": row["class_type"],
                "present": present,
                "total": total,
                "percentage": pct,
                "status": determine_simple_status(pct)
            })
            
            # Calculate predictions
            expected = expected_totals.get(subject_id, 0)
            remaining = max(0, expected - total)
            total_remaining += remaining
            
            pred = compute_simple_prediction(present, total, remaining)
            
            predictions.append({
                "subject_code": subj.get("code", ""),
                "subject_name": subj.get("name", ""),
                "class_type": row["class_type"],
                "present": present,
                "total": total,
                "percentage": pct,
                "can_bunk": pred["can_bunk"],
                "must_attend": pred["must_attend"],
                "classes_remaining": remaining,
                "semester_total": pred["semester_total"],
                "classes_to_recover": pred["classes_to_recover"],
                "status": pred["status"]
            })
            
            total_can_bunk += pred["can_bunk"]
            total_must_attend += pred["must_attend"]
            if pct < 75:
                subjects_at_risk += 1
        
        return {
            "student_id": student_id,
            
            # DASHBOARD - Current attendance (like college portal)
            "dashboard": {
                "overall_present": overall_present,
                "overall_total": overall_total,
                "overall_percentage": compute_percentage(overall_present, overall_total),
                "subjects": dashboard
            },
            
            # PREDICTIONS - What you can/must do
            "predictions": {
                "total_can_bunk": total_can_bunk,
                "total_must_attend": total_must_attend,
                "subjects_at_risk": subjects_at_risk,
                "classes_remaining_in_semester": total_remaining,
                "subjects": predictions
            }
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.post("/test/debug-semester-totals")
async def test_debug_semester_totals(
    batch_id: str,
    semester_id: str,
    db: Client = Depends(get_db)
):
    """
    Debug endpoint to see exactly how semester totals are calculated.
    Shows academic calendar matching and excluded dates.
    NO AUTH - for testing only.
    """
    try:
        # Step 1: Get weekly slots
        weekly_slots = await count_weekly_slots_per_subject(db, batch_id)
        
        # Step 2: Get semester dates
        period = await get_teaching_period_for_semester(db, semester_id)
        
        if not period:
            return {"error": "No teaching period found for semester"}
        
        start_date = pendulum.parse(period["start_date"]).date()
        end_date = pendulum.parse(period["end_date"]).date()
        
        # Step 3: Check academic year lookup
        year_result = db.table("academic_years") \
            .select("*") \
            .lte("start_date", start_date.isoformat()) \
            .gte("end_date", end_date.isoformat()) \
            .limit(1) \
            .execute()
        
        academic_year = year_result.data[0] if year_result.data else None
        
        # Step 4: Get non-teaching dates (now returns tuple with weekly settings)
        non_teaching_dates, weekly_settings = await get_non_teaching_dates(db, start_date, end_date, batch_id)
        
        # Step 5: Get holidays for display
        holidays_list = []
        vacations_list = []
        exams_list = []
        
        if academic_year:
            holidays = db.table("calendar_events") \
                .select("event_date, end_date, title, event_type") \
                .eq("academic_year_id", academic_year["id"]) \
                .eq("is_non_teaching", True) \
                .order("event_date") \
                .execute()
            holidays_list = holidays.data or []
            
            vacations = db.table("vacation_periods") \
                .select("name, start_date, end_date") \
                .eq("academic_year_id", academic_year["id"]) \
                .execute()
            vacations_list = vacations.data or []
            
            exams = db.table("exam_periods") \
                .select("name, start_date, end_date") \
                .eq("academic_year_id", academic_year["id"]) \
                .execute()
            exams_list = exams.data or []
        
        # Sample subject calculation with detailed breakdown
        sample_subject_debug = None
        if weekly_slots:
            first_subject = list(weekly_slots.values())[0]
            day_slots = first_subject["day_slots"]
            
            # Count teaching days vs non-teaching per weekday
            # DB uses 0=Monday, same as Python weekday()
            weekday_analysis = {}
            for weekday in range(7):
                teaching = 0
                non_teaching = 0
                current = start_date
                while current <= end_date:
                    # Python weekday() returns 0=Monday, matches DB convention
                    if current.weekday() == weekday:
                        if current in set(non_teaching_dates):
                            non_teaching += 1
                        else:
                            teaching += 1
                    current = pendulum.instance(datetime.combine(current, datetime.min.time())).add(days=1).date()
                
                # DB uses 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday
                weekday_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday]
                weekday_analysis[weekday_name] = {
                    "teaching_days": teaching,
                    "non_teaching_days": non_teaching,
                    "slots": day_slots.get(weekday, 0)
                }
            
            sample_subject_debug = {
                "subject": first_subject["subject_code"],
                "class_type": first_subject["class_type"],
                # DB uses 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday
                "day_slots": {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][k]: v for k, v in day_slots.items()},
                "weekday_analysis": weekday_analysis
            }
        
        return {
            "semester_period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "total_days": (end_date - start_date).days + 1
            },
            "academic_year_found": academic_year is not None,
            "academic_year": {
                "id": academic_year["id"] if academic_year else None,
                "name": academic_year.get("name") if academic_year else None,
                "start": academic_year.get("start_date") if academic_year else None,
                "end": academic_year.get("end_date") if academic_year else None
            } if academic_year else None,
            "calendar_data": {
                "holidays_count": len(holidays_list),
                "holidays": [{"date": h["event_date"], "title": h.get("title", "")} for h in holidays_list[:10]],
                "vacations": vacations_list,
                "exam_periods": exams_list
            },
            "weekly_off_settings": {
                "sunday_off": weekly_settings.get("sunday_off", True),
                "saturday_pattern": weekly_settings.get("saturday_pattern", "all"),
                "monday_off": weekly_settings.get("monday_off", False),
                "tuesday_off": weekly_settings.get("tuesday_off", False),
                "wednesday_off": weekly_settings.get("wednesday_off", False),
                "thursday_off": weekly_settings.get("thursday_off", False),
                "friday_off": weekly_settings.get("friday_off", False),
            },
            "non_teaching_dates_count": len(non_teaching_dates),
            "non_teaching_sample": [d.isoformat() for d in non_teaching_dates[:15]],
            "subjects_count": len(weekly_slots),
            "sample_subject": sample_subject_debug
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.post("/test/create-real-snapshot")
async def test_create_real_snapshot(
    student_id: str = "11111111-1111-1111-1111-111111111111",
    snapshot_date: str | None = None,  # Default to today
    attendance_percentage: int = 85,  # Default attendance %
    db: Client = Depends(get_db)
):
    """
    Create a snapshot with realistic data from the real batch's subjects.
    
    For each subject in the student's batch:
    - Get total classes from semester_subject_totals
    - Calculate present = total * attendance_percentage / 100
    
    NO AUTH - for test portal only.
    """
    try:
        from datetime import date
        
        if not snapshot_date:
            snapshot_date = pendulum.now("Asia/Kolkata").format("YYYY-MM-DD")
        
        # Get student's app_user info
        app_user = db.table("app_users") \
            .select("current_batch_id, current_semester_id") \
            .eq("student_id", student_id) \
            .single() \
            .execute()
        
        if not app_user.data:
            return {"error": "Student not found in app_users"}
        
        batch_id = app_user.data["current_batch_id"]
        semester_id = app_user.data["current_semester_id"]
        
        # Get semester totals for this batch
        totals = db.table("semester_subject_totals") \
            .select("*, subjects(code, name)") \
            .eq("batch_id", batch_id) \
            .eq("semester_id", semester_id) \
            .execute()
        
        if not totals.data:
            return {
                "error": "No semester totals found. Run /test/calculate-semester-totals first.",
                "batch_id": batch_id,
                "semester_id": semester_id
            }
        
        # Build entries JSON array
        entries = []
        for total in totals.data:
            # Calculate how many classes at this point in semester
            # Since we're at a point in the semester, let's say 50% through
            total_classes = total["total_classes_in_semester"]
            classes_so_far = max(1, int(total_classes * 0.5))  # Half of semester
            
            # Calculate present based on attendance_percentage
            present = int(classes_so_far * attendance_percentage / 100)
            percentage = round(present / classes_so_far * 100, 1) if classes_so_far > 0 else 0
            
            entry = {
                "subject_code": total["subjects"]["code"],
                "subject_name": total["subjects"]["name"],
                "class_type": total["class_type"],
                "present": present,
                "total": classes_so_far,
                "percentage": percentage,
                "confidence": 0.95
            }
            entries.append(entry)
        
        # Create snapshot with entries JSONB
        snapshot = db.table("ocr_snapshots").insert({
            "student_id": student_id,
            "batch_id": batch_id,
            "semester_id": semester_id,
            "captured_at": pendulum.parse(snapshot_date).set(hour=10).isoformat(),
            "confirmed_at": pendulum.now("UTC").isoformat(),
            "source_type": "test_portal",
            "entries": entries,  # Pass as list directly, supabase handles JSONB
            "metadata": {"test": True, "attendance_percentage": attendance_percentage}
        }).execute()
        
        snapshot_id = snapshot.data[0]["id"]
        
        return {
            "success": True,
            "snapshot_id": snapshot_id,
            "snapshot_date": snapshot_date,
            "attendance_percentage": attendance_percentage,
            "subjects_count": len(entries),
            "subjects": [
                {
                    "subject": f"{e['subject_code']} ({e['class_type']})",
                    "present": e["present"],
                    "total": e["total"],
                    "percentage": e["percentage"]
                }
                for e in entries
            ]
        }
        
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}
