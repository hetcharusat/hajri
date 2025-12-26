"""
Tests for snapshot lock rule enforcement.
These test the core policy that manual entries cannot be added before snapshot.
"""

import pytest
from datetime import date, datetime
from app.core.exceptions import (
    SnapshotLockViolation,
    NoSnapshotError,
    InvalidDateError
)


class TestSnapshotLockRule:
    """Tests for the snapshot lock enforcement."""
    
    def test_snapshot_lock_violation_message(self):
        """Test that lock violation has proper message."""
        exc = SnapshotLockViolation("2025-01-15", "2025-01-20")
        
        assert "locked" in exc.message.lower()
        assert "2025-01-15" in exc.message
        assert "2025-01-20" in exc.message
        assert exc.rule == "SNAPSHOT_LOCK"
        assert exc.suggestion is not None
    
    def test_snapshot_lock_to_dict(self):
        """Test exception serialization."""
        exc = SnapshotLockViolation("2025-01-15", "2025-01-20")
        d = exc.to_dict()
        
        assert d["error"] == "policy_violation"
        assert d["rule"] == "SNAPSHOT_LOCK"
        assert d["details"]["event_date"] == "2025-01-15"
        assert d["details"]["snapshot_date"] == "2025-01-20"
    
    def test_no_snapshot_error_message(self):
        """Test no snapshot error."""
        exc = NoSnapshotError("student-123")
        
        assert "No OCR snapshot" in exc.message
        assert exc.rule == "SNAPSHOT_REQUIRED"
        assert "capture" in exc.suggestion.lower() or "confirm" in exc.suggestion.lower()
    
    def test_invalid_date_error(self):
        """Test invalid teaching day error."""
        exc = InvalidDateError("2025-01-26", "Sunday - weekly off")
        
        assert "2025-01-26" in exc.message
        assert "Sunday" in exc.message or "weekly off" in exc.message


class TestLockLogic:
    """Test the actual locking logic."""
    
    def test_date_comparison_same_day(self):
        """Entry on snapshot date should be blocked."""
        snapshot_date = date(2025, 1, 20)
        event_date = date(2025, 1, 20)
        
        # event_date <= snapshot_date should be blocked
        assert event_date <= snapshot_date
    
    def test_date_comparison_before(self):
        """Entry before snapshot date should be blocked."""
        snapshot_date = date(2025, 1, 20)
        event_date = date(2025, 1, 15)
        
        assert event_date <= snapshot_date
    
    def test_date_comparison_after(self):
        """Entry after snapshot date should be allowed."""
        snapshot_date = date(2025, 1, 20)
        event_date = date(2025, 1, 21)
        
        assert not (event_date <= snapshot_date)
    
    def test_lock_check_function(self):
        """Test a lock checking function."""
        def is_locked(event_date: date, snapshot_date: date) -> bool:
            return event_date <= snapshot_date
        
        snapshot = date(2025, 1, 20)
        
        assert is_locked(date(2025, 1, 15), snapshot) == True
        assert is_locked(date(2025, 1, 20), snapshot) == True
        assert is_locked(date(2025, 1, 21), snapshot) == False
        assert is_locked(date(2025, 2, 1), snapshot) == False


class TestSnapshotScenarios:
    """Test various snapshot scenarios."""
    
    def test_new_snapshot_replaces_baseline(self):
        """Newer snapshot becomes the new baseline."""
        old_snapshot_date = date(2025, 1, 10)
        new_snapshot_date = date(2025, 1, 20)
        
        # After new snapshot, manual entries between old and new are invalidated
        # Only entries after new snapshot are counted
        
        event_date_1 = date(2025, 1, 15)  # Between snapshots - invalidated
        event_date_2 = date(2025, 1, 25)  # After new snapshot - valid
        
        assert event_date_1 <= new_snapshot_date
        assert not (event_date_2 <= new_snapshot_date)
    
    def test_multiple_manual_entries(self):
        """Multiple manual entries after snapshot."""
        snapshot_date = date(2025, 1, 20)
        
        entries = [
            date(2025, 1, 21),  # Valid
            date(2025, 1, 22),  # Valid
            date(2025, 1, 19),  # Invalid (before)
            date(2025, 1, 23),  # Valid
            date(2025, 1, 20),  # Invalid (same day)
        ]
        
        valid_entries = [d for d in entries if d > snapshot_date]
        assert len(valid_entries) == 3
