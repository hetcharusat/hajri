"""
Policy violation exceptions for HAJRI Engine.
These are NOT crashes - they are explainable rule violations.
"""

from typing import Optional, Dict, Any


class PolicyViolation(Exception):
    """Base class for policy violations."""
    
    def __init__(
        self,
        message: str,
        rule: str,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.rule = rule
        self.suggestion = suggestion
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": "policy_violation",
            "message": self.message,
            "rule": self.rule,
            "suggestion": self.suggestion,
            "details": self.details
        }


class SnapshotLockViolation(PolicyViolation):
    """Attempt to modify data before the snapshot timestamp."""
    
    def __init__(self, event_date: str, snapshot_date: str):
        super().__init__(
            message=f"Cannot add attendance for {event_date}. This date is locked by snapshot from {snapshot_date}.",
            rule="SNAPSHOT_LOCK",
            suggestion="Upload a new OCR snapshot that includes this date, or only add attendance for dates after the snapshot.",
            details={
                "event_date": event_date,
                "snapshot_date": snapshot_date
            }
        )


class NoSnapshotError(PolicyViolation):
    """No baseline snapshot exists for this student."""
    
    def __init__(self, student_id: str):
        super().__init__(
            message="No OCR snapshot found. Cannot compute attendance without a baseline.",
            rule="SNAPSHOT_REQUIRED",
            suggestion="Please capture and confirm an OCR snapshot of your university attendance portal first.",
            details={"student_id": student_id}
        )


class NoActiveContextError(PolicyViolation):
    """Student doesn't have an active batch/semester context."""
    
    def __init__(self, student_id: str):
        super().__init__(
            message="No active academic context found. Please set your batch and semester.",
            rule="CONTEXT_REQUIRED",
            suggestion="Go to Settings and select your current batch and semester.",
            details={"student_id": student_id}
        )


class SemesterReadOnlyError(PolicyViolation):
    """Semester has ended and is now read-only."""
    
    def __init__(self, semester_name: str):
        super().__init__(
            message=f"Semester '{semester_name}' has ended. Attendance tracking is disabled.",
            rule="SEMESTER_READONLY",
            suggestion="Switch to your current semester to continue tracking.",
            details={"semester": semester_name}
        )


class InvalidDateError(PolicyViolation):
    """Date is not a valid teaching day."""
    
    def __init__(self, date: str, reason: str):
        super().__init__(
            message=f"Cannot add attendance for {date}: {reason}",
            rule="VALID_TEACHING_DAY",
            suggestion="Only add attendance for actual teaching days.",
            details={"date": date, "reason": reason}
        )


class SubjectNotFoundError(PolicyViolation):
    """Subject code from OCR couldn't be matched."""
    
    def __init__(self, ocr_code: str):
        super().__init__(
            message=f"Unknown subject code: '{ocr_code}'",
            rule="SUBJECT_MAPPING",
            suggestion="Please manually map this code to a subject in your timetable.",
            details={"ocr_code": ocr_code}
        )


class DuplicateEntryError(PolicyViolation):
    """Attendance entry already exists."""
    
    def __init__(self, subject: str, date: str):
        super().__init__(
            message=f"Attendance for {subject} on {date} already exists.",
            rule="NO_DUPLICATE",
            suggestion="Edit the existing entry instead of creating a new one.",
            details={"subject": subject, "date": date}
        )


class SnapshotDecreaseWarning(PolicyViolation):
    """New snapshot shows lower totals than previous - needs confirmation."""
    
    def __init__(self, subject: str, old_total: int, new_total: int):
        super().__init__(
            message=f"Subject '{subject}' shows fewer classes ({new_total}) than before ({old_total}). This may indicate a reset.",
            rule="SNAPSHOT_DECREASE_CONFIRM",
            suggestion="Please confirm this change is intentional.",
            details={
                "subject": subject,
                "old_total": old_total,
                "new_total": new_total
            }
        )
