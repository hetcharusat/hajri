-- =====================================================================
-- MIGRATION: Fix Room Deletion Conflict
-- Description: Updates the timetable event validation trigger to skip 
--              checks when only non-slot columns (like room_id) are updated.
--              This prevents errors when deleting a room that is used in 
--              a slot that might have existing (legacy) conflicts.
-- Date: December 27, 2025
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_timetable_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_new_is_elective BOOLEAN;
  v_existing_event RECORD;
BEGIN
  -- Optimization: Skip validation if slot-defining columns haven't changed
  -- This is CRITICAL for allowing room deletion (which sets room_id to NULL)
  -- even if the event is in a slot that has other issues.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.version_id = OLD.version_id AND 
       NEW.day_of_week = OLD.day_of_week AND 
       NEW.start_time = OLD.start_time AND 
       NEW.offering_id = OLD.offering_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Get is_elective for the new event
  SELECT s.is_elective INTO v_new_is_elective
  FROM course_offerings co
  JOIN subjects s ON s.id = co.subject_id
  WHERE co.id = NEW.offering_id;

  -- Check for existing event at same slot
  SELECT 
    te.id,
    s.is_elective as existing_is_elective,
    s.code as subject_code
  INTO v_existing_event
  FROM timetable_events te
  JOIN course_offerings co ON te.offering_id = co.id
  JOIN subjects s ON co.subject_id = s.id
  WHERE te.version_id = NEW.version_id
    AND te.day_of_week = NEW.day_of_week
    AND te.start_time = NEW.start_time
    AND te.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;
  
  IF v_existing_event IS NULL THEN
    -- No conflict
    RETURN NEW;
  END IF;
  
  -- Rule 1: If existing is regular (not elective), block any new event
  IF NOT v_existing_event.existing_is_elective THEN
    RAISE EXCEPTION 'Slot already occupied by regular subject: %', v_existing_event.subject_code;
  END IF;
  
  -- Rule 2: If existing is elective but new is regular, block
  IF NOT v_new_is_elective THEN
    RAISE EXCEPTION 'Cannot add regular subject to slot with electives';
  END IF;
  
  -- Rule 3: Both are electives - allow stacking!
  RETURN NEW;
END;
$fn$;

-- Re-apply the trigger just in case
DROP TRIGGER IF EXISTS validate_timetable_event_trigger ON timetable_events;
CREATE TRIGGER validate_timetable_event_trigger
  BEFORE INSERT OR UPDATE ON timetable_events
  FOR EACH ROW
  EXECUTE FUNCTION validate_timetable_event();
