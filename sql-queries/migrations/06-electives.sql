-- =====================================================================
-- MIGRATION: Elective Subjects Support
-- Description: Adds elective groups, marks subjects as elective,
--              and allows multiple electives in same timetable slot
-- Date: December 26, 2025
-- =====================================================================

-- =====================================================================
-- PART 1: Create elective_groups table
-- =====================================================================

CREATE TABLE IF NOT EXISTS elective_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- e.g., "Open Elective 1", "Professional Elective"
  description TEXT,    -- Optional description
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(semester_id, name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_elective_groups_semester ON elective_groups(semester_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_elective_groups_updated_at ON elective_groups;
CREATE TRIGGER update_elective_groups_updated_at 
  BEFORE UPDATE ON elective_groups 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- PART 2: Add elective columns to subjects table
-- =====================================================================

-- Add is_elective flag
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'is_elective'
  ) THEN
    ALTER TABLE subjects ADD COLUMN is_elective BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add elective_group_id reference
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'elective_group_id'
  ) THEN
    ALTER TABLE subjects ADD COLUMN elective_group_id UUID REFERENCES elective_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for elective lookups
CREATE INDEX IF NOT EXISTS idx_subjects_elective_group ON subjects(elective_group_id);

-- =====================================================================
-- PART 3: Create student_electives table (user's chosen electives)
-- =====================================================================

CREATE TABLE IF NOT EXISTS student_electives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  elective_group_id UUID NOT NULL REFERENCES elective_groups(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One choice per elective group per student
  UNIQUE(student_id, elective_group_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_electives_student ON student_electives(student_id);
CREATE INDEX IF NOT EXISTS idx_student_electives_group ON student_electives(elective_group_id);
CREATE INDEX IF NOT EXISTS idx_student_electives_subject ON student_electives(subject_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_student_electives_updated_at ON student_electives;
CREATE TRIGGER update_student_electives_updated_at 
  BEFORE UPDATE ON student_electives 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- PART 4: Modify timetable_events constraint for elective stacking
-- =====================================================================

-- Drop the old unique constraint that prevents multiple events in same slot
-- Old: UNIQUE (version_id, day_of_week, start_time)
DO $$
BEGIN
  -- Try to drop if exists (constraint name may vary)
  ALTER TABLE timetable_events 
    DROP CONSTRAINT IF EXISTS timetable_events_version_id_day_of_week_start_time_key;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Constraint doesn't exist, that's fine
END $$;

-- Add elective_group_id to timetable_events for grouping
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'timetable_events' AND column_name = 'elective_group_id'
  ) THEN
    ALTER TABLE timetable_events ADD COLUMN elective_group_id UUID REFERENCES elective_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for elective group lookups in events
CREATE INDEX IF NOT EXISTS idx_tt_events_elective_group ON timetable_events(elective_group_id);

-- =====================================================================
-- PART 5: Create validation function for slot conflicts
-- =====================================================================

-- This function checks if a timetable event can be placed in a slot
-- Rules:
-- 1. Regular subjects: only ONE per slot (no overlap)
-- 2. Elective subjects: multiple allowed IF they belong to SAME elective_group
-- 3. Can't mix regular and elective in same slot

DROP FUNCTION IF EXISTS check_timetable_slot_conflict(UUID, INTEGER, TIME, TIME, UUID, UUID);
CREATE OR REPLACE FUNCTION check_timetable_slot_conflict(
  p_version_id UUID,
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_end_time TIME,
  p_elective_group_id UUID,
  p_exclude_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
  has_conflict BOOLEAN,
  conflict_reason TEXT,
  conflicting_events JSONB
)
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_conflicts JSONB;
  v_regular_count INTEGER;
  v_elective_count INTEGER;
  v_other_group_count INTEGER;
BEGIN
  -- Find all overlapping events in the same slot
  SELECT 
    jsonb_agg(jsonb_build_object(
      'id', te.id,
      'offering_id', te.offering_id,
      'elective_group_id', te.elective_group_id,
      'subject_name', s.name
    )),
    COUNT(*) FILTER (WHERE te.elective_group_id IS NULL),
    COUNT(*) FILTER (WHERE te.elective_group_id IS NOT NULL),
    COUNT(*) FILTER (WHERE te.elective_group_id IS NOT NULL AND te.elective_group_id != p_elective_group_id)
  INTO v_conflicts, v_regular_count, v_elective_count, v_other_group_count
  FROM timetable_events te
  JOIN course_offerings co ON co.id = te.offering_id
  JOIN subjects s ON s.id = co.subject_id
  WHERE te.version_id = p_version_id
    AND te.day_of_week = p_day_of_week
    AND (
      (te.start_time < p_end_time AND te.end_time > p_start_time) -- Overlapping time
    )
    AND (p_exclude_event_id IS NULL OR te.id != p_exclude_event_id);

  -- No conflicts at all
  IF v_conflicts IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- Case 1: Slot has regular (non-elective) subjects
  IF v_regular_count > 0 THEN
    RETURN QUERY SELECT true, 
      'Slot already has a regular subject. Cannot add more events.'::TEXT,
      v_conflicts;
    RETURN;
  END IF;

  -- Case 2: Adding regular subject to elective slot
  IF p_elective_group_id IS NULL AND v_elective_count > 0 THEN
    RETURN QUERY SELECT true,
      'Slot has elective subjects. Cannot add regular subject.'::TEXT,
      v_conflicts;
    RETURN;
  END IF;

  -- Case 3: Adding elective from different group
  IF p_elective_group_id IS NOT NULL AND v_other_group_count > 0 THEN
    RETURN QUERY SELECT true,
      'Slot has electives from a different group. Cannot mix elective groups.'::TEXT,
      v_conflicts;
    RETURN;
  END IF;

  -- No conflict - either empty slot or same elective group
  RETURN QUERY SELECT false, NULL::TEXT, NULL::JSONB;
END;
$fn$;

-- =====================================================================
-- PART 6: Create trigger to enforce slot rules
-- =====================================================================

DROP FUNCTION IF EXISTS validate_timetable_event() CASCADE;
CREATE OR REPLACE FUNCTION validate_timetable_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_elective_group_id UUID;
  v_conflict RECORD;
BEGIN
  -- Optimization: Skip validation if slot-defining columns haven't changed
  IF TG_OP = 'UPDATE' THEN
    IF NEW.version_id = OLD.version_id AND 
       NEW.day_of_week = OLD.day_of_week AND 
       NEW.start_time = OLD.start_time AND 
       NEW.end_time = OLD.end_time AND
       NEW.offering_id = OLD.offering_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Get elective_group_id from the offering's subject
  SELECT s.elective_group_id INTO v_elective_group_id
  FROM course_offerings co
  JOIN subjects s ON s.id = co.subject_id
  WHERE co.id = NEW.offering_id;

  -- Store it in the event for easier querying
  NEW.elective_group_id := v_elective_group_id;

  -- Check for conflicts
  SELECT * INTO v_conflict
  FROM check_timetable_slot_conflict(
    NEW.version_id,
    NEW.day_of_week,
    NEW.start_time,
    NEW.end_time,
    v_elective_group_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END
  );

  IF v_conflict.has_conflict THEN
    RAISE EXCEPTION 'Timetable conflict: %', v_conflict.conflict_reason;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS validate_timetable_event_trigger ON timetable_events;
CREATE TRIGGER validate_timetable_event_trigger
  BEFORE INSERT OR UPDATE ON timetable_events
  FOR EACH ROW
  EXECUTE FUNCTION validate_timetable_event();

-- =====================================================================
-- PART 7: Helper view for elective subjects with group info
-- =====================================================================

DROP VIEW IF EXISTS elective_subjects_view;
CREATE VIEW elective_subjects_view AS
SELECT 
  s.id,
  s.code,
  s.name,
  s.type,
  s.credits,
  s.semester_id,
  s.is_elective,
  s.elective_group_id,
  eg.name as elective_group_name,
  eg.description as elective_group_description,
  sem.semester_number,
  b.name as branch_name,
  b.abbreviation as branch_abbr
FROM subjects s
LEFT JOIN elective_groups eg ON eg.id = s.elective_group_id
JOIN semesters sem ON sem.id = s.semester_id
JOIN branches b ON b.id = sem.branch_id
WHERE s.is_elective = true;

-- =====================================================================
-- PART 8: RLS Policies for new tables
-- =====================================================================

-- Enable RLS
ALTER TABLE elective_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_electives ENABLE ROW LEVEL SECURITY;

-- elective_groups policies (public read, admin write)
DROP POLICY IF EXISTS "elective_groups_public_read" ON elective_groups;
CREATE POLICY "elective_groups_public_read" ON elective_groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "elective_groups_admin_write" ON elective_groups;
CREATE POLICY "elective_groups_admin_write" ON elective_groups
  FOR ALL USING (
    (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

-- student_electives policies (students can manage their own, admin can manage all)
DROP POLICY IF EXISTS "student_electives_own_read" ON student_electives;
CREATE POLICY "student_electives_own_read" ON student_electives
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "student_electives_own_write" ON student_electives;
CREATE POLICY "student_electives_own_write" ON student_electives
  FOR INSERT WITH CHECK (
    -- Student can insert their own OR admin can insert any
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "student_electives_own_update" ON student_electives;
CREATE POLICY "student_electives_own_update" ON student_electives
  FOR UPDATE USING (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "student_electives_own_delete" ON student_electives;
CREATE POLICY "student_electives_own_delete" ON student_electives
  FOR DELETE USING (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

-- =====================================================================
-- PART 9: Grant permissions
-- =====================================================================

GRANT SELECT ON elective_groups TO anon, authenticated;
GRANT ALL ON elective_groups TO authenticated;

GRANT SELECT ON student_electives TO anon, authenticated;
GRANT ALL ON student_electives TO authenticated;

GRANT SELECT ON elective_subjects_view TO anon, authenticated;

-- =====================================================================
-- DONE! 
-- Run this migration in Supabase SQL Editor
-- =====================================================================
