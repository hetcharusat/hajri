-- Academic Calendar Schema for Hajri
-- This creates tables to track academic events, holidays, vacations, and exam periods
-- Used by the attendance calculation engine to determine teaching vs non-teaching days

-- ============================================
-- 1. ACADEMIC YEARS
-- ============================================
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- "2025-26", "2026-27"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  institution TEXT DEFAULT 'CHARUSAT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date > start_date)
);

-- Only one current academic year
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_current 
ON academic_years (is_current) WHERE is_current = true;

-- ============================================
-- 2. CALENDAR EVENTS (holidays, academic events, college events)
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  end_date DATE,  -- For multi-day events like "Anti-Ragging Week"
  event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'academic', 'college_event', 'exam', 'vacation')),
  title TEXT NOT NULL,
  description TEXT,
  is_non_teaching BOOLEAN DEFAULT false,  -- Does this day count as non-teaching?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_year ON calendar_events(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- ============================================
-- 3. VACATION PERIODS
-- ============================================
CREATE TABLE IF NOT EXISTS vacation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Diwali Vacation", "Summer Vacation", etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'students', 'employees')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_vacation_periods_dates ON vacation_periods(start_date, end_date);

-- ============================================
-- 4. EXAM PERIODS
-- ============================================
CREATE TABLE IF NOT EXISTS exam_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Odd Semester Regular Exam", "Even Semester Remedial"
  exam_type TEXT NOT NULL CHECK (exam_type IN ('regular', 'remedial', 'supplementary')),
  semester_type TEXT NOT NULL CHECK (semester_type IN ('odd', 'even')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_exam_periods_dates ON exam_periods(start_date, end_date);

-- ============================================
-- 5. TEACHING PERIODS (when classes run)
-- ============================================
CREATE TABLE IF NOT EXISTS teaching_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Odd Semester Teaching", "Even Semester Teaching"
  semester_type TEXT NOT NULL CHECK (semester_type IN ('odd', 'even')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date > start_date)
);

-- ============================================
-- 6. WEEKLY OFF DAYS (default non-teaching days)
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_off_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  is_off BOOLEAN DEFAULT true,
  note TEXT,  -- "Saturday may be teaching if explicitly marked"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academic_year_id, day_of_week)
);

-- ============================================
-- HELPER VIEW: Get all non-teaching dates
-- ============================================
CREATE OR REPLACE VIEW v_non_teaching_dates AS
SELECT DISTINCT 
  d::DATE as date,
  ay.id as academic_year_id,
  ay.name as academic_year,
  COALESCE(
    (SELECT title FROM calendar_events ce 
     WHERE ce.event_date = d::DATE AND ce.is_non_teaching = true 
     LIMIT 1),
    (SELECT name FROM vacation_periods vp 
     WHERE d::DATE BETWEEN vp.start_date AND vp.end_date 
     LIMIT 1),
    (SELECT name FROM exam_periods ep 
     WHERE d::DATE BETWEEN ep.start_date AND ep.end_date 
     LIMIT 1),
    'Weekend'
  ) as reason
FROM academic_years ay
CROSS JOIN generate_series(ay.start_date, ay.end_date, '1 day'::interval) d
WHERE 
  -- Sundays
  EXTRACT(DOW FROM d::DATE) = 0
  -- Or holidays
  OR EXISTS (
    SELECT 1 FROM calendar_events ce 
    WHERE ce.academic_year_id = ay.id 
    AND ce.event_date = d::DATE 
    AND ce.is_non_teaching = true
  )
  -- Or vacation periods
  OR EXISTS (
    SELECT 1 FROM vacation_periods vp 
    WHERE vp.academic_year_id = ay.id 
    AND d::DATE BETWEEN vp.start_date AND vp.end_date
  )
  -- Or exam periods (no regular teaching)
  OR EXISTS (
    SELECT 1 FROM exam_periods ep 
    WHERE ep.academic_year_id = ay.id 
    AND d::DATE BETWEEN ep.start_date AND ep.end_date
  );

-- ============================================
-- FUNCTION: Check if a date is a teaching day
-- ============================================
CREATE OR REPLACE FUNCTION is_teaching_day(check_date DATE, year_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_year_id UUID;
  v_is_teaching BOOLEAN := true;
BEGIN
  -- Get academic year ID
  IF year_id IS NULL THEN
    SELECT id INTO v_year_id FROM academic_years WHERE is_current = true LIMIT 1;
  ELSE
    v_year_id := year_id;
  END IF;
  
  IF v_year_id IS NULL THEN
    RETURN true; -- No academic year configured, assume teaching day
  END IF;
  
  -- Check if Sunday
  IF EXTRACT(DOW FROM check_date) = 0 THEN
    RETURN false;
  END IF;
  
  -- Check weekly off days
  IF EXISTS (
    SELECT 1 FROM weekly_off_days 
    WHERE academic_year_id = v_year_id 
    AND day_of_week = EXTRACT(DOW FROM check_date)::INTEGER
    AND is_off = true
  ) THEN
    RETURN false;
  END IF;
  
  -- Check holidays
  IF EXISTS (
    SELECT 1 FROM calendar_events 
    WHERE academic_year_id = v_year_id 
    AND check_date BETWEEN event_date AND COALESCE(end_date, event_date)
    AND is_non_teaching = true
  ) THEN
    RETURN false;
  END IF;
  
  -- Check vacations
  IF EXISTS (
    SELECT 1 FROM vacation_periods 
    WHERE academic_year_id = v_year_id 
    AND check_date BETWEEN start_date AND end_date
  ) THEN
    RETURN false;
  END IF;
  
  -- Check exam periods
  IF EXISTS (
    SELECT 1 FROM exam_periods 
    WHERE academic_year_id = v_year_id 
    AND check_date BETWEEN start_date AND end_date
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Count teaching days in a range
-- ============================================
CREATE OR REPLACE FUNCTION count_teaching_days(
  from_date DATE, 
  to_date DATE, 
  year_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_date DATE;
BEGIN
  FOR v_date IN SELECT generate_series(from_date, to_date, '1 day'::interval)::DATE
  LOOP
    IF is_teaching_day(v_date, year_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_off_days ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow read access" ON academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON vacation_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON exam_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON teaching_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access" ON weekly_off_days FOR SELECT TO authenticated USING (true);

-- Allow admins to write (assuming admin check function exists)
CREATE POLICY "Allow admin write" ON academic_years FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON calendar_events FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON vacation_periods FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON exam_periods FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON teaching_periods FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON weekly_off_days FOR ALL TO authenticated 
  USING (true) WITH CHECK (true);

-- ============================================
-- SAMPLE DATA: 2025-26 Academic Year
-- ============================================
-- Uncomment to insert sample data

/*
INSERT INTO academic_years (name, start_date, end_date, is_current, institution)
VALUES ('2025-26', '2025-06-23', '2026-06-22', true, 'CHARUSAT');

-- Get the academic year ID
DO $$
DECLARE
  v_year_id UUID;
BEGIN
  SELECT id INTO v_year_id FROM academic_years WHERE name = '2025-26';
  
  -- Weekly off days (Sunday)
  INSERT INTO weekly_off_days (academic_year_id, day_of_week, is_off, note)
  VALUES (v_year_id, 0, true, 'Sunday - Weekly off');
  
  -- Holidays
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching) VALUES
  (v_year_id, '2025-08-09', 'holiday', 'Raksha Bandhan', true),
  (v_year_id, '2025-08-15', 'holiday', 'Independence Day', true),
  (v_year_id, '2025-10-02', 'holiday', 'Gandhi Jayanti', true),
  (v_year_id, '2025-10-02', 'holiday', 'Dussehra', true),
  (v_year_id, '2025-10-20', 'holiday', 'Diwali', true),
  (v_year_id, '2025-11-05', 'holiday', 'Guru Nanak Jayanti', true),
  (v_year_id, '2025-12-25', 'holiday', 'Christmas', true),
  (v_year_id, '2026-01-14', 'holiday', 'Makar Sankranti', true),
  (v_year_id, '2026-01-15', 'holiday', 'Makar Sankranti', true),
  (v_year_id, '2026-01-26', 'holiday', 'Republic Day', true),
  (v_year_id, '2026-02-15', 'holiday', 'Maha Shivratri', true),
  (v_year_id, '2026-03-04', 'holiday', 'Dhuleti', true),
  (v_year_id, '2026-04-04', 'holiday', 'Dr. B. R. Ambedkar Jayanti', true);
  
  -- Teaching periods
  INSERT INTO teaching_periods (academic_year_id, name, semester_type, start_date, end_date) VALUES
  (v_year_id, 'Odd Semester Teaching', 'odd', '2025-06-23', '2025-10-11'),
  (v_year_id, 'Even Semester Teaching', 'even', '2025-12-15', '2026-04-10');
  
  -- Vacation periods
  INSERT INTO vacation_periods (academic_year_id, name, start_date, end_date, applies_to) VALUES
  (v_year_id, 'Diwali Vacation (Students)', '2025-10-13', '2025-10-26', 'students'),
  (v_year_id, 'Diwali Vacation (Employees)', '2025-10-18', '2025-10-26', 'employees'),
  (v_year_id, 'Semester Break', '2025-11-24', '2025-12-14', 'students'),
  (v_year_id, 'Summer Vacation', '2026-05-11', '2026-06-21', 'students');
  
  -- Exam periods
  INSERT INTO exam_periods (academic_year_id, name, exam_type, semester_type, start_date, end_date) VALUES
  (v_year_id, 'Odd Semester Regular Exam', 'regular', 'odd', '2025-10-27', '2025-11-21'),
  (v_year_id, 'Odd Semester Remedial Exam', 'remedial', 'odd', '2025-12-08', '2025-12-12'),
  (v_year_id, 'Even Semester Regular Exam', 'regular', 'even', '2026-04-13', '2026-05-08'),
  (v_year_id, 'Even Semester Remedial Exam', 'remedial', 'even', '2026-05-25', '2026-05-30');
  
  -- Academic events
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching) VALUES
  (v_year_id, '2025-06-23', 'academic', 'Commencement of Class (Odd Semester)', false),
  (v_year_id, '2025-10-11', 'academic', 'End of Teaching (Odd Semester)', false),
  (v_year_id, '2025-12-15', 'academic', 'Commencement of Class (Even Semester)', false),
  (v_year_id, '2026-01-03', 'academic', '15th Convocation', false),
  (v_year_id, '2026-01-28', 'academic', '26th Foundation Day', false),
  (v_year_id, '2026-04-10', 'academic', 'End of Teaching (Even Semester)', false);
  
  -- College events
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching) VALUES
  (v_year_id, '2025-07-15', 'college_event', 'World Youth Skills Day', false),
  (v_year_id, '2025-09-05', 'college_event', 'Teachers Day Celebration', false),
  (v_year_id, '2025-09-15', 'college_event', 'Engineers Day Celebration', false),
  (v_year_id, '2025-08-29', 'college_event', 'National Sports Day', false);
END $$;
*/
