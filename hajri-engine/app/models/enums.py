"""
Enums for HAJRI Engine.
"""

from enum import Enum


class ClassType(str, Enum):
    """Type of class/lecture."""
    LECTURE = "LECTURE"
    LAB = "LAB"
    TUTORIAL = "TUTORIAL"


class AttendanceStatus(str, Enum):
    """Manual attendance entry status."""
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    CANCELLED = "CANCELLED"


class PredictionStatus(str, Enum):
    """Attendance health status."""
    SAFE = "SAFE"         # >= 80%
    WARNING = "WARNING"   # 75-80%
    DANGER = "DANGER"     # 65-75%
    CRITICAL = "CRITICAL" # < 65%


class ComputeTrigger(str, Enum):
    """What triggered a recomputation."""
    SNAPSHOT_CONFIRM = "SNAPSHOT_CONFIRM"
    MANUAL_ENTRY = "MANUAL_ENTRY"
    FORCE_RECOMPUTE = "FORCE_RECOMPUTE"
    CALENDAR_UPDATE = "CALENDAR_UPDATE"


class ComputeStatus(str, Enum):
    """Computation result status."""
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
