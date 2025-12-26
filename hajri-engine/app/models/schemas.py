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
# PREDICTION SCHEMAS
# =============================================================================

class SubjectPrediction(BaseModel):
    """Prediction for a single subject."""
    subject_id: str
    subject_code: str
    subject_name: str
    
    # Current state
    current_present: int
    current_total: int
    current_percentage: float
    
    # Target
    required_percentage: float = 75.0
    
    # Predictions
    remaining_classes: int
    must_attend: int
    can_bunk: int
    
    # Status
    status: PredictionStatus
    
    # If critical, how many more needed to recover
    classes_to_recover: Optional[int] = None


class PredictionsResponse(BaseModel):
    """All predictions for a student."""
    student_id: str
    semester_end_date: Optional[date]
    
    subjects: List[SubjectPrediction]
    
    # Summary
    safe_count: int
    warning_count: int
    danger_count: int
    critical_count: int
    
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
