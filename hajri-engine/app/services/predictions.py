"""
Pure prediction logic for HAJRI Engine.
These functions are stateless and testable without database.

SIMPLIFIED USER-FOCUSED PREDICTIONS:
- can_bunk: How many classes you can SAFELY skip and still have 75%
- must_attend: MINIMUM classes you MUST attend to reach 75% by semester end
- classes_to_recover: If below 75%, how many consecutive classes to recover
"""

from math import ceil, floor
from typing import Tuple


def compute_simple_prediction(
    present: int,
    total: int,
    remaining_classes: int,
    required_percentage: float = 75.0
) -> dict:
    """
    Compute simple, clear predictions for a subject.
    
    Args:
        present: Classes attended so far
        total: Total classes held so far
        remaining_classes: Expected remaining classes in semester
        required_percentage: Target percentage (default 75%)
    
    Returns:
        Dict with: can_bunk, must_attend, classes_to_recover, status
    
    Example:
        Current: 30/40 (75%), Remaining: 20
        Semester Total: 60 classes
        Required for 75%: 45 classes
        
        can_bunk = How many MORE absences allowed?
          = 60 - 45 (allowed absences for 75%) - (40 - 30) current absences
          = 15 - 10 = 5 bunkable
        
        must_attend = Minimum to attend from remaining
          = max(0, 45 - 30) = 15
    """
    
    # Current percentage
    current_pct = (present / total * 100) if total > 0 else 100.0
    
    # Semester total = current + remaining
    semester_total = total + remaining_classes
    
    # Required attendance for target percentage
    # Use ceil to be safe (e.g., 75% of 60 = 45)
    required_present = ceil((required_percentage / 100) * semester_total)
    
    # Current absences
    current_absences = total - present
    
    # Max allowed absences for target percentage
    max_allowed_absences = semester_total - required_present
    
    # How many more can you bunk? (absences budget remaining)
    can_bunk = max(0, max_allowed_absences - current_absences)
    
    # But can't bunk more than remaining classes
    can_bunk = min(can_bunk, remaining_classes)
    
    # Minimum classes must attend from remaining
    # = required_present - present (what you still need)
    must_attend = max(0, required_present - present)
    
    # But can't exceed remaining classes
    if must_attend > remaining_classes:
        must_attend = remaining_classes  # Even attending all won't be enough
    
    # If already below threshold, calculate recovery
    classes_to_recover = None
    if current_pct < required_percentage and total > 0:
        classes_to_recover = compute_recovery_classes(present, total, required_percentage)
    
    # Simple status
    if current_pct >= 75:
        status = "SAFE"
    elif current_pct >= 65:
        status = "LOW"
    else:
        status = "CRITICAL"
    
    return {
        "can_bunk": can_bunk,
        "must_attend": must_attend,
        "classes_to_recover": classes_to_recover,
        "status": status,
        "semester_total": semester_total,
        "classes_remaining": remaining_classes
    }


def compute_recovery_classes(
    present: int,
    total: int,
    required_percentage: float = 75.0
) -> int:
    """
    If below required %, how many consecutive classes to attend to recover?
    
    Formula: (present + x) / (total + x) = required_percentage / 100
    Solving: x = (required% * total - 100 * present) / (100 - required%)
    """
    if total == 0:
        return 0
    
    current_pct = (present / total) * 100
    if current_pct >= required_percentage:
        return 0
    
    numerator = (required_percentage * total) - (100 * present)
    denominator = 100 - required_percentage
    
    if denominator == 0:
        return 0
    
    return max(0, ceil(numerator / denominator))


def compute_percentage(present: int, total: int) -> float:
    """Safely compute attendance percentage."""
    if total == 0:
        return 0.0
    return round((present / total) * 100, 2)


def determine_simple_status(percentage: float) -> str:
    """Simple 3-tier status."""
    if percentage >= 75:
        return "SAFE"
    elif percentage >= 65:
        return "LOW"
    else:
        return "CRITICAL"


# Keep old function for backward compatibility but mark deprecated
def compute_prediction(
    current_present: int,
    current_total: int,
    remaining_classes: int,
    required_percentage: float = 75.0
) -> Tuple[int, int, str]:
    """
    DEPRECATED: Use compute_simple_prediction instead.
    Kept for backward compatibility.
    """
    result = compute_simple_prediction(
        current_present, current_total, remaining_classes, required_percentage
    )
    return (result["must_attend"], result["can_bunk"], result["status"])


def determine_status(percentage: float):
    """DEPRECATED: Use determine_simple_status instead."""
    return determine_simple_status(percentage)
