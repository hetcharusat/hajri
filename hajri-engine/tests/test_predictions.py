"""
Pure logic tests for HAJRI Engine.
These tests don't require database - they test pure computation functions.
"""

import pytest
from app.services.predictions import (
    compute_prediction,
    compute_recovery_classes,
    compute_percentage,
    determine_status
)
from app.models.enums import PredictionStatus


class TestComputePrediction:
    """Tests for the core prediction computation."""
    
    def test_basic_prediction(self):
        """Test basic prediction calculation."""
        # Current: 30/40 (75%), Remaining: 20, Required: 75%
        must_attend, can_bunk, status = compute_prediction(
            current_present=30,
            current_total=40,
            remaining_classes=20,
            required_percentage=75.0
        )
        
        # Total will be 60, need ceil(0.75 * 60) = 45
        # Must attend: 45 - 30 = 15
        # Can bunk: 20 - 15 = 5
        assert must_attend == 15
        assert can_bunk == 5
        assert status == PredictionStatus.WARNING  # exactly 75%
    
    def test_safe_student(self):
        """Test student with high attendance."""
        # Current: 36/40 (90%), Remaining: 20, Required: 75%
        must_attend, can_bunk, status = compute_prediction(
            current_present=36,
            current_total=40,
            remaining_classes=20,
            required_percentage=75.0
        )
        
        # Total will be 60, need ceil(0.75 * 60) = 45
        # Must attend: max(0, 45 - 36) = 9
        # Can bunk: 20 - 9 = 11
        assert must_attend == 9
        assert can_bunk == 11
        assert status == PredictionStatus.SAFE  # 90% > 80%
    
    def test_critical_student(self):
        """Test student with very low attendance."""
        # Current: 20/40 (50%), Remaining: 20, Required: 75%
        must_attend, can_bunk, status = compute_prediction(
            current_present=20,
            current_total=40,
            remaining_classes=20,
            required_percentage=75.0
        )
        
        # Total will be 60, need ceil(0.75 * 60) = 45
        # Must attend: 45 - 20 = 25, but only 20 remaining, so 20
        # Can bunk: 20 - 20 = 0
        assert must_attend == 20
        assert can_bunk == 0
        assert status == PredictionStatus.CRITICAL  # 50% < 65%
    
    def test_already_safe(self):
        """Test student who already has enough."""
        # Current: 45/50 (90%), Remaining: 10, Required: 75%
        must_attend, can_bunk, status = compute_prediction(
            current_present=45,
            current_total=50,
            remaining_classes=10,
            required_percentage=75.0
        )
        
        # Total will be 60, need ceil(0.75 * 60) = 45
        # Already have 45, must attend 0
        # Can bunk: 10 - 0 = 10
        assert must_attend == 0
        assert can_bunk == 10
        assert status == PredictionStatus.SAFE
    
    def test_zero_remaining(self):
        """Test when semester is over."""
        must_attend, can_bunk, status = compute_prediction(
            current_present=30,
            current_total=40,
            remaining_classes=0,
            required_percentage=75.0
        )
        
        assert must_attend == 0
        assert can_bunk == 0
        assert status == PredictionStatus.WARNING
    
    def test_negative_remaining(self):
        """Test edge case with negative remaining."""
        must_attend, can_bunk, status = compute_prediction(
            current_present=30,
            current_total=40,
            remaining_classes=-5,
            required_percentage=75.0
        )
        
        # Should treat as 0 remaining
        assert must_attend == 0
        assert can_bunk == 0
    
    def test_danger_zone(self):
        """Test student in danger zone (65-75%)."""
        # 70%
        must_attend, can_bunk, status = compute_prediction(
            current_present=28,
            current_total=40,
            remaining_classes=20,
            required_percentage=75.0
        )
        
        assert status == PredictionStatus.DANGER


class TestComputeRecoveryClasses:
    """Tests for recovery calculation."""
    
    def test_recovery_needed(self):
        """Test when recovery is needed."""
        # Current: 20/40 (50%), need 75%
        # (20 + x) / (40 + x) >= 0.75
        # 20 + x >= 0.75 * (40 + x)
        # 20 + x >= 30 + 0.75x
        # 0.25x >= 10
        # x >= 40
        recovery = compute_recovery_classes(
            current_present=20,
            current_total=40,
            required_percentage=75.0
        )
        
        assert recovery == 40
    
    def test_no_recovery_needed(self):
        """Test when already above threshold."""
        recovery = compute_recovery_classes(
            current_present=36,
            current_total=40,
            required_percentage=75.0
        )
        
        assert recovery == 0
    
    def test_exactly_at_threshold(self):
        """Test when exactly at threshold."""
        recovery = compute_recovery_classes(
            current_present=30,
            current_total=40,
            required_percentage=75.0
        )
        
        assert recovery == 0
    
    def test_zero_total(self):
        """Test with zero total classes."""
        recovery = compute_recovery_classes(
            current_present=0,
            current_total=0,
            required_percentage=75.0
        )
        
        assert recovery == 0


class TestComputePercentage:
    """Tests for percentage calculation."""
    
    def test_basic_percentage(self):
        assert compute_percentage(75, 100) == 75.0
        assert compute_percentage(30, 40) == 75.0
        assert compute_percentage(1, 3) == 33.33
    
    def test_zero_total(self):
        assert compute_percentage(0, 0) == 0.0
        assert compute_percentage(5, 0) == 0.0
    
    def test_rounding(self):
        # 1/3 = 0.333... should round to 33.33
        assert compute_percentage(1, 3) == 33.33
        # 2/3 = 0.666... should round to 66.67
        assert compute_percentage(2, 3) == 66.67


class TestDetermineStatus:
    """Tests for status determination."""
    
    def test_safe(self):
        assert determine_status(80.0) == PredictionStatus.SAFE
        assert determine_status(90.0) == PredictionStatus.SAFE
        assert determine_status(100.0) == PredictionStatus.SAFE
    
    def test_warning(self):
        assert determine_status(75.0) == PredictionStatus.WARNING
        assert determine_status(79.99) == PredictionStatus.WARNING
    
    def test_danger(self):
        assert determine_status(65.0) == PredictionStatus.DANGER
        assert determine_status(74.99) == PredictionStatus.DANGER
    
    def test_critical(self):
        assert determine_status(64.99) == PredictionStatus.CRITICAL
        assert determine_status(50.0) == PredictionStatus.CRITICAL
        assert determine_status(0.0) == PredictionStatus.CRITICAL


class TestEdgeCases:
    """Edge case tests."""
    
    def test_100_percent_required(self):
        """Test impossible 100% requirement."""
        recovery = compute_recovery_classes(
            current_present=90,
            current_total=100,
            required_percentage=100.0
        )
        # Impossible to recover
        assert recovery == 0
    
    def test_first_class(self):
        """Test after first class attended."""
        must_attend, can_bunk, status = compute_prediction(
            current_present=1,
            current_total=1,
            remaining_classes=59,
            required_percentage=75.0
        )
        
        assert status == PredictionStatus.SAFE  # 100%
        # Total 60, need 45, have 1, must attend 44
        assert must_attend == 44
        assert can_bunk == 15
    
    def test_perfect_attendance(self):
        """Test 100% attendance."""
        must_attend, can_bunk, status = compute_prediction(
            current_present=50,
            current_total=50,
            remaining_classes=10,
            required_percentage=75.0
        )
        
        assert status == PredictionStatus.SAFE
        assert must_attend == 0
        assert can_bunk == 10
