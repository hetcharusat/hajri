-- ============================================================================
-- HAJRI ENGINE TABLES
-- Migration: 08-engine-tables.sql
-- Purpose: Tables for the headless attendance computation engine
-- ============================================================================

-- ============================================================================
-- PART 1: APP USER CONTEXT
-- Links mobile app users to their academic context
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  current_batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  current_semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL,
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_student ON app_users(student_id);
CREATE INDEX IF NOT EXISTS idx_app_users_batch ON app_users(current_batch_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_app_users_updated_at ON app_users;
CREATE TRIGGER update_app_users_updated_at 
  BEFORE UPDATE ON app_users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 2: OCR SNAPSHOTS
-- Immutable storage for confirmed OCR captures
-- Each snapshot is the truth baseline for historical attendance
-- ============================================================================

CREATE TABLE IF NOT EXISTS ocr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  
  -- When the screenshot was taken (user's claim)
  captured_at TIMESTAMPTZ NOT NULL,
  -- When user confirmed in app
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Source metadata
  source_type TEXT DEFAULT 'university_portal',
  
  -- The actual OCR data - array of attendance entries
  -- Format: [{ subject_code, subject_name, class_type, present, total, percentage, confidence }]
  entries JSONB NOT NULL,
  
  -- Device/app metadata for debugging
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_snapshots_student ON ocr_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_ocr_snapshots_batch ON ocr_snapshots(batch_id);
CREATE INDEX IF NOT EXISTS idx_ocr_snapshots_confirmed ON ocr_snapshots(student_id, confirmed_at DESC);

-- ============================================================================
-- PART 3: MANUAL ATTENDANCE
-- Incremental attendance entries AFTER the latest snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS manual_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  
  -- The baseline snapshot this entry is relative to
  snapshot_id UUID NOT NULL REFERENCES ocr_snapshots(id) ON DELETE CASCADE,
  
  -- When the class occurred
  event_date DATE NOT NULL,
  
  -- Class details
  class_type TEXT NOT NULL CHECK (class_type IN ('LECTURE', 'LAB', 'TUTORIAL')),
  period_slot INTEGER, -- Optional: which period (1-8)
  
  -- Attendance status
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'CANCELLED')),
  
  -- Optional: link to specific timetable slot
  timetable_event_id UUID REFERENCES timetable_events(id) ON DELETE SET NULL,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One entry per subject/date/type/slot combination
  UNIQUE(student_id, subject_id, event_date, class_type, period_slot)
);

CREATE INDEX IF NOT EXISTS idx_manual_attendance_student ON manual_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_manual_attendance_snapshot ON manual_attendance(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_manual_attendance_date ON manual_attendance(student_id, event_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_manual_attendance_updated_at ON manual_attendance;
CREATE TRIGGER update_manual_attendance_updated_at 
  BEFORE UPDATE ON manual_attendance 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: ATTENDANCE SUMMARY (DERIVED - COMPUTED BY ENGINE)
-- Pre-computed current attendance state per student/subject
-- Updated on every snapshot confirm or manual entry
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  
  -- Class type (compute separately for LEC/LAB or combined)
  class_type TEXT NOT NULL CHECK (class_type IN ('LECTURE', 'LAB', 'TUTORIAL', 'ALL')),
  
  -- Snapshot baseline
  snapshot_id UUID REFERENCES ocr_snapshots(id) ON DELETE SET NULL,
  snapshot_at TIMESTAMPTZ,
  snapshot_present INTEGER NOT NULL DEFAULT 0,
  snapshot_total INTEGER NOT NULL DEFAULT 0,
  
  -- Manual additions (aggregated from manual_attendance)
  manual_present INTEGER NOT NULL DEFAULT 0,
  manual_absent INTEGER NOT NULL DEFAULT 0,
  manual_total INTEGER NOT NULL DEFAULT 0, -- present + absent (excludes cancelled)
  
  -- Current computed values
  current_present INTEGER NOT NULL DEFAULT 0,
  current_total INTEGER NOT NULL DEFAULT 0,
  current_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  -- Computation metadata
  last_recomputed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One summary per student/subject/type
  UNIQUE(student_id, subject_id, class_type)
);

CREATE INDEX IF NOT EXISTS idx_attendance_summary_student ON attendance_summary(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_batch ON attendance_summary(batch_id);

-- ============================================================================
-- PART 5: ATTENDANCE PREDICTIONS (DERIVED - COMPUTED BY ENGINE)
-- Pre-computed can_bunk/must_attend predictions
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  
  -- Current state (copied from summary for fast access)
  current_present INTEGER NOT NULL DEFAULT 0,
  current_total INTEGER NOT NULL DEFAULT 0,
  current_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  -- Target
  required_percentage DECIMAL(5,2) DEFAULT 75.00,
  
  -- Future projections
  remaining_classes INTEGER NOT NULL DEFAULT 0,
  semester_end_date DATE,
  
  -- Prediction outputs
  must_attend INTEGER NOT NULL DEFAULT 0,
  can_bunk INTEGER NOT NULL DEFAULT 0,
  
  -- Status indicator
  status TEXT CHECK (status IN ('SAFE', 'WARNING', 'DANGER', 'CRITICAL')),
  
  -- Computation metadata
  prediction_computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One prediction per student/subject
  UNIQUE(student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_predictions_student ON attendance_predictions(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_predictions_status ON attendance_predictions(student_id, status);

-- ============================================================================
-- PART 6: SUBJECT MAPPING (for OCR code resolution)
-- Maps OCR-extracted codes to actual subject IDs
-- ============================================================================

CREATE TABLE IF NOT EXISTS subject_code_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The code that appears in OCR
  ocr_code TEXT NOT NULL,
  ocr_name TEXT, -- Optional: name from OCR for verification
  
  -- The resolved subject
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  
  -- Context (same code might mean different subjects in different batches)
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  
  -- Who created this mapping
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique mapping per code per context
  UNIQUE(ocr_code, batch_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_code_mappings_code ON subject_code_mappings(ocr_code);
CREATE INDEX IF NOT EXISTS idx_subject_code_mappings_batch ON subject_code_mappings(batch_id);

-- ============================================================================
-- PART 7: ENGINE COMPUTATION LOG (for debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS engine_computation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- What triggered this computation
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('SNAPSHOT_CONFIRM', 'MANUAL_ENTRY', 'FORCE_RECOMPUTE', 'CALENDAR_UPDATE')),
  trigger_id UUID, -- ID of the triggering record
  
  -- Computation result
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
  subjects_updated INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Error details if failed
  error_message TEXT,
  error_details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engine_log_student ON engine_computation_log(student_id);
CREATE INDEX IF NOT EXISTS idx_engine_log_created ON engine_computation_log(created_at DESC);

-- ============================================================================
-- PART 8: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_code_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_computation_log ENABLE ROW LEVEL SECURITY;

-- App users can manage their own profile
DROP POLICY IF EXISTS "app_users_own" ON app_users;
CREATE POLICY "app_users_own" ON app_users
  FOR ALL USING (id = auth.uid());

-- Students can read/write their own snapshots
DROP POLICY IF EXISTS "ocr_snapshots_own" ON ocr_snapshots;
CREATE POLICY "ocr_snapshots_own" ON ocr_snapshots
  FOR ALL USING (student_id IN (
    SELECT student_id FROM app_users WHERE id = auth.uid()
  ));

-- Students can read/write their own manual attendance
DROP POLICY IF EXISTS "manual_attendance_own" ON manual_attendance;
CREATE POLICY "manual_attendance_own" ON manual_attendance
  FOR ALL USING (student_id IN (
    SELECT student_id FROM app_users WHERE id = auth.uid()
  ));

-- Students can read their own summaries
DROP POLICY IF EXISTS "attendance_summary_own" ON attendance_summary;
CREATE POLICY "attendance_summary_own" ON attendance_summary
  FOR SELECT USING (student_id IN (
    SELECT student_id FROM app_users WHERE id = auth.uid()
  ));

-- Students can read their own predictions
DROP POLICY IF EXISTS "attendance_predictions_own" ON attendance_predictions;
CREATE POLICY "attendance_predictions_own" ON attendance_predictions
  FOR SELECT USING (student_id IN (
    SELECT student_id FROM app_users WHERE id = auth.uid()
  ));

-- Subject mappings readable by all authenticated users
DROP POLICY IF EXISTS "subject_code_mappings_read" ON subject_code_mappings;
CREATE POLICY "subject_code_mappings_read" ON subject_code_mappings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Engine log readable by owner only
DROP POLICY IF EXISTS "engine_log_own" ON engine_computation_log;
CREATE POLICY "engine_log_own" ON engine_computation_log
  FOR SELECT USING (student_id IN (
    SELECT student_id FROM app_users WHERE id = auth.uid()
  ));

-- Admin full access policies
DROP POLICY IF EXISTS "admin_app_users" ON app_users;
CREATE POLICY "admin_app_users" ON app_users
  FOR ALL USING ((SELECT is_admin FROM users WHERE id = auth.uid()) = true);

DROP POLICY IF EXISTS "admin_ocr_snapshots" ON ocr_snapshots;
CREATE POLICY "admin_ocr_snapshots" ON ocr_snapshots
  FOR ALL USING ((SELECT is_admin FROM users WHERE id = auth.uid()) = true);

DROP POLICY IF EXISTS "admin_manual_attendance" ON manual_attendance;
CREATE POLICY "admin_manual_attendance" ON manual_attendance
  FOR ALL USING ((SELECT is_admin FROM users WHERE id = auth.uid()) = true);

DROP POLICY IF EXISTS "admin_attendance_summary" ON attendance_summary;
CREATE POLICY "admin_attendance_summary" ON attendance_summary
  FOR ALL USING ((SELECT is_admin FROM users WHERE id = auth.uid()) = true);

DROP POLICY IF EXISTS "admin_attendance_predictions" ON attendance_predictions;
CREATE POLICY "admin_attendance_predictions" ON attendance_predictions
  FOR ALL USING ((SELECT is_admin FROM users WHERE id = auth.uid()) = true);

DROP POLICY IF EXISTS "admin_subject_code_mappings" ON subject_code_mappings;
CREATE POLICY "admin_subject_code_mappings" ON subject_code_mappings
  FOR ALL USING ((SELECT is_admin FROM users WHERE id = auth.uid()) = true);

DROP POLICY IF EXISTS "admin_engine_log" ON engine_computation_log;
CREATE POLICY "admin_engine_log" ON engine_computation_log
  FOR ALL USING ((SELECT is_admin FROM users WHERE id = auth.uid()) = true);

-- ============================================================================
-- PART 9: GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON app_users TO authenticated;
GRANT SELECT, INSERT ON ocr_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON manual_attendance TO authenticated;
GRANT SELECT ON attendance_summary TO authenticated;
GRANT SELECT ON attendance_predictions TO authenticated;
GRANT SELECT, INSERT ON subject_code_mappings TO authenticated;
GRANT SELECT ON engine_computation_log TO authenticated;

-- Service role (engine) gets full access
GRANT ALL ON app_users TO service_role;
GRANT ALL ON ocr_snapshots TO service_role;
GRANT ALL ON manual_attendance TO service_role;
GRANT ALL ON attendance_summary TO service_role;
GRANT ALL ON attendance_predictions TO service_role;
GRANT ALL ON subject_code_mappings TO service_role;
GRANT ALL ON engine_computation_log TO service_role;

-- ============================================================================
-- DONE
-- ============================================================================
