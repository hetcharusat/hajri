-- ============================================================================
-- SEMESTER SUBJECT TOTALS TABLE
-- Migration: 13-semester-subject-totals.sql
-- Purpose: Store precomputed total classes per subject for each semester
-- ============================================================================

-- This table stores the results of "Pre-Process 1" - the admin-triggered
-- calculation of total lectures/labs per subject based on:
-- 1. Timetable (slots per week)
-- 2. Academic Calendar (holidays, vacations, exams)
-- 3. Teaching Period (semester start/end dates)

CREATE TABLE IF NOT EXISTS semester_subject_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  
  -- Subject info snapshot
  class_type TEXT NOT NULL CHECK (class_type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  
  -- Calculated values
  slots_per_week INTEGER NOT NULL DEFAULT 0,
  total_classes_in_semester INTEGER NOT NULL DEFAULT 0,
  
  -- Calculation metadata
  calculation_details JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per batch/semester/subject
  UNIQUE(batch_id, semester_id, subject_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_semester_totals_batch ON semester_subject_totals(batch_id);
CREATE INDEX IF NOT EXISTS idx_semester_totals_semester ON semester_subject_totals(semester_id);
CREATE INDEX IF NOT EXISTS idx_semester_totals_subject ON semester_subject_totals(subject_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_semester_totals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_semester_totals_timestamp ON semester_subject_totals;
CREATE TRIGGER update_semester_totals_timestamp
  BEFORE UPDATE ON semester_subject_totals
  FOR EACH ROW EXECUTE FUNCTION update_semester_totals_updated_at();

-- RLS
ALTER TABLE semester_subject_totals ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "semester_totals_read" ON semester_subject_totals 
  FOR SELECT TO authenticated USING (true);

-- Allow service role to write (engine backend)
CREATE POLICY "semester_totals_service_write" ON semester_subject_totals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE semester_subject_totals IS 
  'Precomputed total classes per subject for each semester. Updated by admin when timetable/calendar changes.';

COMMENT ON COLUMN semester_subject_totals.slots_per_week IS 
  'How many timetable slots this subject has per week';

COMMENT ON COLUMN semester_subject_totals.total_classes_in_semester IS 
  'Total classes expected in the entire semester (excluding holidays, vacations, exams)';

COMMENT ON COLUMN semester_subject_totals.calculation_details IS 
  'JSON with semester_start, semester_end, teaching_days_by_weekday for audit';
