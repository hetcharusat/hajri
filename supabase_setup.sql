-- View 1: Current Published Timetables
CREATE OR REPLACE VIEW current_timetables AS
WITH latest_versions AS (
  SELECT DISTINCT ON (batch_id)
    id,
    batch_id,
    name,
    published_at
  FROM timetable_versions
  WHERE status = 'published'
  ORDER BY batch_id, published_at DESC
)
SELECT
  lv.id AS version_id,
  lv.batch_id,
  lv.name AS version_name,
  lv.published_at,
  te.id AS event_id,
  te.day_of_week,
  te.start_time,
  te.end_time,
  s.id AS subject_id,
  s.code AS subject_code,
  s.name AS subject_name,
  s.type AS subject_type,
  s.credits,
  f.id AS faculty_id,
  f.name AS faculty_name,
  f.abbr AS faculty_abbr,
  COALESCE(r_override.room_number, r_default.room_number) AS room_number
FROM latest_versions lv
JOIN timetable_events te ON te.version_id = lv.id
JOIN course_offerings co ON co.id = te.offering_id
JOIN subjects s ON s.id = co.subject_id
LEFT JOIN faculty f ON f.id = co.faculty_id
LEFT JOIN rooms r_override ON r_override.id = te.room_id
LEFT JOIN rooms r_default ON r_default.id = co.default_room_id;

-- View 2: Batch Subjects Summary
CREATE OR REPLACE VIEW batch_subjects AS
SELECT
  co.batch_id,
  s.id AS subject_id,
  s.code AS subject_code,
  s.name AS subject_name,
  s.type AS subject_type,
  s.credits,
  f.id AS faculty_id,
  f.name AS faculty_name,
  f.abbr AS faculty_abbr,
  r.room_number AS default_room
FROM course_offerings co
JOIN subjects s ON s.id = co.subject_id
LEFT JOIN faculty f ON f.id = co.faculty_id
LEFT JOIN rooms r ON r.id = co.default_room_id;

-- View 3: Period Schedule
CREATE OR REPLACE VIEW active_period_schedule AS
SELECT
  pt.id AS template_id,
  pt.name AS template_name,
  p.id AS period_id,
  p.period_number,
  p.name AS period_name,
  p.start_time,
  p.end_time,
  p.is_break,
  p.day_of_week,
  EXTRACT(EPOCH FROM (p.end_time - p.start_time)) / 60 AS duration_minutes
FROM period_templates pt
JOIN periods p ON p.template_id = pt.id
WHERE pt.is_active = true
ORDER BY p.day_of_week NULLS FIRST, p.period_number;

-- ========================================
-- PART 2: ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_events ENABLE ROW LEVEL SECURITY;

-- Public read access (for mobile apps using anon key)
CREATE POLICY "Public read subjects"
ON subjects FOR SELECT
USING (true);

CREATE POLICY "Public read faculty"
ON faculty FOR SELECT
USING (true);

CREATE POLICY "Public read rooms"
ON rooms FOR SELECT
USING (true);

CREATE POLICY "Public read course offerings"
ON course_offerings FOR SELECT
USING (true);

CREATE POLICY "Public read period templates"
ON period_templates FOR SELECT
USING (true);

CREATE POLICY "Public read periods"
ON periods FOR SELECT
USING (true);

-- Timetables: Only published versions are readable
CREATE POLICY "Public read published timetable versions"
ON timetable_versions FOR SELECT
USING (status = 'published');

CREATE POLICY "Public read published timetable events"
ON timetable_events FOR SELECT
USING (
  version_id IN (
    SELECT id FROM timetable_versions WHERE status = 'published'
  )
);

-- Admin write policies (requires authenticated user)
-- Note: You should create an admin_users table or use auth.uid() check

-- For now, allowing all authenticated users to write
-- Replace with proper admin check in production
CREATE POLICY "Authenticated write subjects"
ON subjects FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write faculty"
ON faculty FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write rooms"
ON rooms FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write course_offerings"
ON course_offerings FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write period_templates"
ON period_templates FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write periods"
ON periods FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write timetable_versions"
ON timetable_versions FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write timetable_events"
ON timetable_events FOR ALL
USING (auth.role() = 'authenticated');


-- ========================================
-- PART 3: HELPER FUNCTIONS
-- ========================================

-- Function: Get current lecture for a batch
CREATE OR REPLACE FUNCTION get_current_lecture(
  p_batch_id UUID,
  p_current_day INTEGER,  -- 1=Mon, 2=Tue... 6=Sat
  p_current_time TIME
)
RETURNS TABLE (
  event_id UUID,
  subject_code TEXT,
  subject_name TEXT,
  subject_type TEXT,
  faculty_name TEXT,
  room_number TEXT,
  start_time TIME,
  end_time TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.event_id,
    ct.subject_code,
    ct.subject_name,
    ct.subject_type,
    ct.faculty_name,
    ct.room_number,
    ct.start_time,
    ct.end_time
  FROM current_timetables ct
  WHERE ct.batch_id = p_batch_id
    AND ct.day_of_week = p_current_day
    AND ct.start_time <= p_current_time
    AND ct.end_time > p_current_time
  ORDER BY ct.start_time
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_lecture IS
'Get the current lecture happening right now for a batch. Pass batch_id, day (1-6), and current time.';


-- ========================================
-- PART 4: DATA CLEANUP UTILITIES
-- ========================================

-- Function: Clean up draft timetables older than X days
CREATE OR REPLACE FUNCTION cleanup_old_drafts(days_old INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM timetable_versions
    WHERE status = 'draft'
      AND created_at < NOW() - (days_old || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_drafts IS
'Delete draft timetable versions older than specified days (default 7). Returns count of deleted versions.';


-- Function: Find orphaned records
CREATE OR REPLACE FUNCTION find_orphaned_offerings()
RETURNS TABLE (
  offering_id UUID,
  subject_code TEXT,
  batch_id UUID,
  issue TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    co.id AS offering_id,
    s.code AS subject_code,
    co.batch_id,
    'Missing batch' AS issue
  FROM course_offerings co
  LEFT JOIN batches b ON b.id = co.batch_id
  JOIN subjects s ON s.id = co.subject_id
  WHERE b.id IS NULL;
  
  RETURN QUERY
  SELECT
    co.id AS offering_id,
    s.code AS subject_code,
    co.batch_id,
    'Missing subject' AS issue
  FROM course_offerings co
  LEFT JOIN subjects s ON s.id = co.subject_id
  WHERE s.id IS NULL;
END;
$$ LANGUAGE plpgsql;


-- ========================================
-- PART 5: INDEXES FOR PERFORMANCE
-- ========================================

-- Indexes for faster mobile app queries
CREATE INDEX IF NOT EXISTS idx_timetable_versions_batch_published
ON timetable_versions(batch_id, published_at DESC)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_timetable_events_version_day
ON timetable_events(version_id, day_of_week, start_time);

CREATE INDEX IF NOT EXISTS idx_course_offerings_batch
ON course_offerings(batch_id);

CREATE INDEX IF NOT EXISTS idx_periods_template_day
ON periods(template_id, day_of_week, period_number);


-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Run these to verify setup:

-- 1. Check if views are created
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN ('current_timetables', 'batch_subjects', 'active_period_schedule');

-- 2. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('timetable_events', 'course_offerings', 'subjects');

-- 3. Test current timetables view (replace with actual batch_id)
-- SELECT * FROM current_timetables WHERE batch_id = 'your-batch-uuid' LIMIT 5;
