-- =====================================================================
-- SIMPLIFIED ELECTIVES MIGRATION (v2)
-- This version removes elective groups - electives just stack together
-- =====================================================================

-- =====================================================================
-- PART 1: Add is_elective column to subjects (if not exists)
-- =====================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'is_elective'
  ) THEN
    ALTER TABLE subjects ADD COLUMN is_elective BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index for elective lookups
CREATE INDEX IF NOT EXISTS idx_subjects_elective ON subjects(is_elective) WHERE is_elective = true;

-- =====================================================================
-- PART 2: Update validation trigger to allow elective stacking
-- =====================================================================

-- Remove the UNIQUE constraint on timetable_events if it exists
-- (This constraint prevents multiple events in the same slot)
DO $$
BEGIN
  ALTER TABLE timetable_events DROP CONSTRAINT IF EXISTS timetable_events_version_id_day_of_week_start_time_key;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if constraint doesn't exist
END $$;

-- Create or replace the validation function
DROP FUNCTION IF EXISTS validate_timetable_event() CASCADE;
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

-- Create the trigger
DROP TRIGGER IF EXISTS validate_timetable_event_trigger ON timetable_events;
CREATE TRIGGER validate_timetable_event_trigger
  BEFORE INSERT OR UPDATE ON timetable_events
  FOR EACH ROW
  EXECUTE FUNCTION validate_timetable_event();

-- =====================================================================
-- PART 3: Student electives table (student's chosen elective subject)
-- =====================================================================

CREATE TABLE IF NOT EXISTS student_electives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id)
);

-- Index for student lookups
CREATE INDEX IF NOT EXISTS idx_student_electives_student ON student_electives(student_id);
CREATE INDEX IF NOT EXISTS idx_student_electives_subject ON student_electives(subject_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_student_electives_updated_at ON student_electives;
CREATE TRIGGER update_student_electives_updated_at 
  BEFORE UPDATE ON student_electives 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- PART 4: RLS Policies
-- =====================================================================

ALTER TABLE student_electives ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "student_electives_admin_all" ON student_electives;
CREATE POLICY "student_electives_admin_all" ON student_electives
  FOR ALL USING (
    (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

-- Students can view and manage their own electives
DROP POLICY IF EXISTS "student_electives_own" ON student_electives;
CREATE POLICY "student_electives_own" ON student_electives
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
  );

-- =====================================================================
-- PART 5: Grants
-- =====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON student_electives TO authenticated;

-- =====================================================================
-- DONE! Simplified elective system:
-- - is_elective on subjects marks them as electives
-- - All electives can stack in the same time slot
-- - Students pick their elective subject in student_electives
-- =====================================================================
