"""
Pure prediction logic for HAJRI Engine.
These functions are stateless and testable without database.
"""

from math import ceil
from typing import Tuple
from app.models.enums import PredictionStatus


def compute_prediction(
    current_present: int,
    current_total: int,
    remaining_classes: int,
    required_percentage: float = 75.0
) -> Tuple[int, int, PredictionStatus]:
    """
    Compute must_attend and can_bunk for a subject.
    
    Args:
        current_present: Classes attended so far
        current_total: Total classes held so far
        remaining_classes: Expected remaining classes in semester
        required_percentage: Target percentage (default 75%)
    
    Returns:
        Tuple of (must_attend, can_bunk, status)
    
    Logic:
        required_attendance = ceil(required_percentage × (current_total + remaining))
        must_attend = max(0, required_attendance - current_present)
        can_bunk = max(0, remaining - must_attend)
    
    Example:
        Current: 30/40 (75%), Remaining: 20, Required: 75%
        Total will be: 60
        Required: ceil(0.75 × 60) = 45
        Must attend: max(0, 45 - 30) = 15
        Can bunk: max(0, 20 - 15) = 5
    """
    
    # Handle edge cases
    if remaining_classes < 0:
        remaining_classes = 0
    
    future_total = current_total + remaining_classes
    
    # How many must be present to hit target
    required_attendance = ceil((required_percentage / 100) * future_total)
    
    # How many more must attend
    must_attend = max(0, required_attendance - current_present)
    
    # Can't attend more than remaining
    if must_attend > remaining_classes:
        must_attend = remaining_classes
    
    # How many can skip
    can_bunk = max(0, remaining_classes - must_attend)
    
    # Determine status based on current percentage
    current_percentage = (current_present / current_total * 100) if current_total > 0 else 0
    
    if current_percentage >= 80:
        status = PredictionStatus.SAFE
    elif current_percentage >= 75:
        status = PredictionStatus.WARNING
    elif current_percentage >= 65:
        status = PredictionStatus.DANGER
    else:
        status = PredictionStatus.CRITICAL
    
    return (must_attend, can_bunk, status)


def compute_recovery_classes(
    current_present: int,
    current_total: int,
    required_percentage: float = 75.0
) -> int:
    """
    Calculate minimum classes needed to reach required percentage.
    Returns 0 if already above threshold.
    
    This is useful when a student is below the required percentage
    and wants to know how many consecutive classes they need to attend.
    
    Formula:
        Let x = additional classes (all attended)
        (current_present + x) / (current_total + x) >= required_percentage / 100
        
        Solving for x:
        x >= (required_percentage * current_total - 100 * current_present) / (100 - required_percentage)
    """
    
    if current_total == 0:
        return 0
    
    current_percentage = (current_present / current_total) * 100
    
    if current_percentage >= required_percentage:
        return 0
    
    # Solve for x
    numerator = (required_percentage * current_total) - (100 * current_present)
    denominator = 100 - required_percentage
    
    if denominator == 0:
        return 0  # 100% required is impossible to recover
    
    x = numerator / denominator
    
    return max(0, ceil(x))


def compute_percentage(present: int, total: int) -> float:
    """Safely compute attendance percentage."""
    if total == 0:
        return 0.0
    return round((present / total) * 100, 2)


def determine_status(percentage: float) -> PredictionStatus:
    """Determine attendance health status from percentage."""
    if percentage >= 80:
        return PredictionStatus.SAFE
    elif percentage >= 75:
        return PredictionStatus.WARNING
    elif percentage >= 65:
        return PredictionStatus.DANGER
    else:
        return PredictionStatus.CRITICAL
