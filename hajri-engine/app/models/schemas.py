"""
Pydantic schemas for HAJRI Engine API.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from app.models.enums import ClassType, AttendanceStatus, PredictionStatus


# =============================================================================
# OCR SNAPSHOT SCHEMAS
# =============================================================================

class OCREntry(BaseModel):
    """Single attendance entry from OCR extraction."""
    course_code: str = Field(..., description="Subject code from university portal")
    course_name: Optional[str] = Field(None, description="Subject name from OCR")
    class_type: Optional[str] = Field(None, description="LECT/LAB from OCR")
    present: int = Field(..., ge=0, description="Classes attended")
    total: int = Field(..., ge=0, description="Total classes held")
    percentage: float = Field(..., ge=0, le=100, description="Attendance percentage")
    confidence: Optional[float] = Field(None, ge=0, le=1, description="OCR confidence score")
    
    @field_validator('percentage')
    @classmethod
    def round_percentage(cls, v):
        return round(v, 2)


class SnapshotConfirmRequest(BaseModel):
    """Request to confirm an OCR snapshot."""
    captured_at: datetime = Field(..., description="When the screenshot was taken")
    entries: List[OCREntry] = Field(..., min_length=1, description="OCR-extracted attendance entries")
    source_type: str = Field(default="university_portal")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # If snapshot shows decrease in totals, user must confirm
    confirm_decreases: bool = Field(default=False, description="Confirm if totals decreased")


class SnapshotConfirmResponse(BaseModel):
    """Response after confirming a snapshot."""
    snapshot_id: str
    confirmed_at: datetime
    entries_processed: int
    subjects_matched: int
    subjects_unmatched: List[str]
    recompute_triggered: bool
    warnings: List[str] = []


# =============================================================================
# MANUAL ATTENDANCE SCHEMAS
# =============================================================================

class ManualAttendanceRequest(BaseModel):
    """Request to add manual attendance entry."""
    subject_id: str = Field(..., description="UUID of the subject")
    event_date: date = Field(..., description="Date of the class")
    class_type: ClassType = Field(..., description="Type of class")
    status: AttendanceStatus = Field(..., description="Present/Absent/Cancelled")
    period_slot: Optional[int] = Field(None, ge=1, le=10, description="Period number if known")


class ManualAttendanceResponse(BaseModel):
    """Response after adding manual attendance."""
    id: str
    subject_id: str
    event_date: date
    status: AttendanceStatus
    recompute_triggered: bool


class ManualAttendanceBulkRequest(BaseModel):
    """Bulk add manual attendance entries."""
    entries: List[ManualAttendanceRequest] = Field(..., min_length=1, max_length=50)


# =============================================================================
# ATTENDANCE SUMMARY SCHEMAS
# =============================================================================

class SubjectSummary(BaseModel):
    """Attendance summary for a single subject."""
    subject_id: str
    subject_code: str
    subject_name: str
    class_type: ClassType
    
    # Snapshot baseline
    snapshot_present: int
    snapshot_total: int
    
    # Manual additions
    manual_present: int
    manual_absent: int
    
    # Current computed
    current_present: int
    current_total: int
    current_percentage: float
    
    # Status
    status: PredictionStatus
    
    last_updated: datetime


class AttendanceSummaryResponse(BaseModel):
    """Full attendance summary for a student."""
    student_id: str
    batch_id: str
    semester_name: str
    snapshot_at: Optional[datetime]
    
    subjects: List[SubjectSummary]
    
    # Aggregate stats
    overall_present: int
    overall_total: int
    overall_percentage: float
    
    computed_at: datetime


# =============================================================================
# PREDICTION SCHEMAS - SIMPLIFIED FOR USER CLARITY
# =============================================================================

class SubjectAttendance(BaseModel):
    """
    Simple attendance view for a subject - mimics college dashboard.
    Shows: Present / Total = Percentage%
    """
    subject_id: str
    subject_code: str
    subject_name: str
    class_type: str  # LECTURE, LAB, TUTORIAL
    
    # Current attendance (like college dashboard)
    present: int = Field(..., description="Classes attended")
    total: int = Field(..., description="Total classes held")
    percentage: float = Field(..., description="Current attendance %")
    
    # Simple status: SAFE (>=75%), LOW (<75%), CRITICAL (<65%)
    status: str = Field(..., description="SAFE / LOW / CRITICAL")
    

class SubjectPrediction(BaseModel):
    """
    Clear predictions for a subject.
    User wants to know: "Can I bunk?" and "How many must I attend?"
    """
    subject_id: str
    subject_code: str
    subject_name: str
    class_type: str
    
    # Current state (mirror of college dashboard)
    present: int
    total: int
    percentage: float
    
    # THE KEY NUMBERS USER CARES ABOUT:
    can_bunk: int = Field(..., description="Classes you CAN safely skip and still have 75%")
    must_attend: int = Field(..., description="Minimum classes you MUST attend for 75%")
    
    # Context
    classes_remaining: int = Field(..., description="Expected classes left in semester")
    semester_total: int = Field(..., description="Expected total classes by semester end")
    
    # If below 75%, how many consecutive classes to recover
    classes_to_recover: Optional[int] = Field(None, description="If below 75%, attend this many to recover")
    
    # Simple status
    status: str = Field(..., description="SAFE / LOW / CRITICAL")


class AttendanceDashboardResponse(BaseModel):
    """
    Main dashboard response - shows current attendance like college portal.
    """
    student_name: Optional[str] = None
    semester: str
    last_updated: datetime
    
    # Overall stats
    overall_present: int
    overall_total: int
    overall_percentage: float
    
    # Per-subject current attendance
    subjects: List[SubjectAttendance]


class PredictionsResponse(BaseModel):
    """
    Predictions response - tells user what they can/must do.
    """
    student_id: str
    semester: str
    semester_end: Optional[date] = None
    classes_remaining_in_semester: int
    
    # Summary - quick glance
    total_can_bunk: int = Field(..., description="Total classes you can safely skip across all subjects")
    total_must_attend: int = Field(..., description="Total minimum classes you must attend")
    subjects_at_risk: int = Field(..., description="Subjects below 75%")
    
    # Per-subject predictions
    subjects: List[SubjectPrediction]
    
    computed_at: datetime


# =============================================================================
# ENGINE CONTROL SCHEMAS
# =============================================================================

class RecomputeRequest(BaseModel):
    """Request to force recomputation."""
    student_id: Optional[str] = Field(None, description="Specific student, or all if None")
    reason: str = Field(default="manual_trigger")


class RecomputeResponse(BaseModel):
    """Response from recomputation."""
    students_processed: int
    subjects_updated: int
    duration_ms: int
    status: str


# =============================================================================
# ERROR RESPONSE SCHEMAS
# =============================================================================

class PolicyViolationResponse(BaseModel):
    """Response for policy violations."""
    error: str = "policy_violation"
    message: str
    rule: str
    suggestion: Optional[str]
    details: Dict[str, Any] = {}


class ErrorResponse(BaseModel):
    """Generic error response."""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
