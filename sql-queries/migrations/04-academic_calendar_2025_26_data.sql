-- Academic Calendar 2025-26 Data Import
-- Run this AFTER running 03-academic_calendar.sql (the schema)
-- This populates all data from CHARUSAT Academic Calendar 2025-26

-- ============================================
-- 1. CREATE THE ACADEMIC YEAR
-- ============================================
INSERT INTO academic_years (name, start_date, end_date, is_current, institution)
VALUES ('2025-26', '2025-06-23', '2026-06-22', true, 'CHARUSAT')
ON CONFLICT (name) DO UPDATE SET 
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_current = EXCLUDED.is_current,
  institution = EXCLUDED.institution;

-- Get the academic year ID for subsequent inserts
DO $$
DECLARE
  v_year_id UUID;
BEGIN
  SELECT id INTO v_year_id FROM academic_years WHERE name = '2025-26';
  
  -- ============================================
  -- 2. WEEKLY OFF DAYS
  -- ============================================
  -- Sunday is always off
  INSERT INTO weekly_off_days (academic_year_id, day_of_week, is_off, note)
  VALUES (v_year_id, 0, true, 'Sunday - Weekly off')
  ON CONFLICT (academic_year_id, day_of_week) DO NOTHING;
  
  -- ============================================
  -- 3. HOLIDAYS (is_non_teaching = true)
  -- ============================================
  
  -- August 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-08-09', 'holiday', 'Raksha Bandhan', true),
    (v_year_id, '2025-08-15', 'holiday', 'Independence Day', true);
  
  -- October 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-10-02', 'holiday', 'Gandhi Jayanti', true),
    (v_year_id, '2025-10-02', 'holiday', 'Dussehra', true),
    (v_year_id, '2025-10-20', 'holiday', 'Diwali', true);
  
  -- November 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-11-05', 'holiday', 'Guru Nanak Jayanti', true);
  
  -- December 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-12-25', 'holiday', 'Christmas', true);
  
  -- January 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-01-14', 'holiday', 'Makar Sankranti', true),
    (v_year_id, '2026-01-15', 'holiday', 'Makar Sankranti (Day 2)', true),
    (v_year_id, '2026-01-26', 'holiday', 'Republic Day', true);
  
  -- February 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-02-15', 'holiday', 'Maha Shivratri', true);
  
  -- March 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-03-04', 'holiday', 'Dhuleti', true);
  
  -- April 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-04-04', 'holiday', 'Dr. B. R. Ambedkar Jayanti', true);
  
  -- June 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-06-21', 'holiday', 'World Yoga Day', true);

  -- ============================================
  -- 4. ACADEMIC EVENTS (is_non_teaching = false, these are milestones)
  -- ============================================
  
  -- June 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-06-23', 'academic', 'Commencement of Class (Odd Semester)', false);
  
  -- July 2025 - Committee Meetings
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-07-04', 'academic', 'Equal Opportunity Cell (EOC)', false),
    (v_year_id, '2025-07-05', 'academic', 'Purchase Committee (PC)', false),
    (v_year_id, '2025-07-07', 'academic', 'Human Resource Committee (HR)', false),
    (v_year_id, '2025-07-09', 'academic', 'GEC – Alumni Association', false),
    (v_year_id, '2025-07-14', 'academic', 'Internal Quality Assurance Cell (IQAC)', false),
    (v_year_id, '2025-07-17', 'academic', 'Board of Management (BoM)', false),
    (v_year_id, '2025-07-19', 'academic', 'Finance Committee (FC)', false),
    (v_year_id, '2025-07-22', 'academic', 'Board of Studies (BoS)', false),
    (v_year_id, '2025-07-30', 'academic', 'CHARUSAT Event Cell (CEC)', false),
    (v_year_id, '2025-07-31', 'academic', 'Disciplinary & Surveillance Committee', false);
  
  -- August 2025 - Committee Meetings
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-08-01', 'academic', 'Infrastructure Dev. & Maintenance Committee (IDMC)', false),
    (v_year_id, '2025-08-02', 'academic', 'Purchase Committee + CIQA (CCOE)', false),
    (v_year_id, '2025-08-05', 'academic', 'Anti-Ragging Committee (ARC)', false),
    (v_year_id, '2025-08-11', 'academic', 'Research Council (RC)', false),
    (v_year_id, '2025-08-12', 'academic', 'Examination Reforms Committee (ERC)', false),
    (v_year_id, '2025-08-14', 'academic', 'Faculty Board (FB)', false),
    (v_year_id, '2025-08-28', 'academic', 'Governing Body (GB)', false);
  
  -- Anti-Ragging Week (multi-day event)
  INSERT INTO calendar_events (academic_year_id, event_date, end_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-08-12', '2025-08-18', 'academic', 'Anti-Ragging Week', false);
  
  -- September 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-09-02', 'academic', 'Convocation Planning Committee (CPC)', false),
    (v_year_id, '2025-09-03', 'academic', 'Women Development Cell (WDC)', false),
    (v_year_id, '2025-09-12', 'academic', 'Academic Council (AC)', false),
    (v_year_id, '2025-09-18', 'academic', 'University Level Student Council (ULSC)', false),
    (v_year_id, '2025-09-20', 'academic', 'Finance Committee (FC)', false);
  
  -- October 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-10-03', 'academic', 'IDMC', false),
    (v_year_id, '2025-10-04', 'academic', 'Purchase Committee', false),
    (v_year_id, '2025-10-09', 'academic', 'Board of Management (BoM)', false),
    (v_year_id, '2025-10-11', 'academic', 'End of Teaching (Odd Semester)', false);
  
  -- November 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-11-03', 'academic', 'Human Resource Committee', false),
    (v_year_id, '2025-11-15', 'academic', 'Finance Committee', false),
    (v_year_id, '2025-11-17', 'academic', 'IQAC', false);
  
  -- December 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-12-15', 'academic', 'Commencement of Class (Even Semester)', false),
    (v_year_id, '2025-12-18', 'academic', 'Joint BoM & Governing Body', false);
  
  -- January 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-01-03', 'academic', '15th Convocation', false),
    (v_year_id, '2026-01-28', 'academic', '26th Foundation Day', false);
  
  -- February 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-02-09', 'academic', 'Research Council (RC)', false),
    (v_year_id, '2026-02-13', 'academic', 'Faculty Board (FB)', false);
  
  -- March 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-03-13', 'academic', 'Academic Council (AC)', false),
    (v_year_id, '2026-03-16', 'academic', 'IQAC', false);
  
  -- April 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-04-10', 'academic', 'End of Teaching (Even Semester)', false);
  
  -- June 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-06-23', 'academic', 'Commencement of Academic Year 2026–27', false);

  -- ============================================
  -- 5. COLLEGE EVENTS
  -- ============================================
  
  -- July 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-07-15', 'college_event', 'World Youth Skills Day', false),
    (v_year_id, '2025-07-21', 'college_event', 'National Anesthesia & OT Technologist Day', false);
  
  -- August 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-08-12', 'college_event', 'National Librarian''s Day', false),
    (v_year_id, '2025-08-29', 'college_event', 'National Sports Day', false);
  
  -- September 2025
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2025-09-05', 'college_event', 'Teachers Day Celebration', false),
    (v_year_id, '2025-09-15', 'college_event', 'Engineers Day Celebration', false),
    (v_year_id, '2025-09-25', 'college_event', 'World Pharmacist Day', false);
  
  -- January 2026 - SPOURAL Sports Events
  INSERT INTO calendar_events (academic_year_id, event_date, end_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-01-01', '2026-01-27', 'college_event', 'SPOURAL Sports Events', false);
  
  -- February 2026
  INSERT INTO calendar_events (academic_year_id, event_date, event_type, title, is_non_teaching)
  VALUES 
    (v_year_id, '2026-02-21', 'college_event', 'International Mother Language Day', false),
    (v_year_id, '2026-02-28', 'college_event', 'National Science Day', false);

  -- ============================================
  -- 6. TEACHING PERIODS
  -- ============================================
  INSERT INTO teaching_periods (academic_year_id, name, semester_type, start_date, end_date)
  VALUES 
    (v_year_id, 'Odd Semester Teaching', 'odd', '2025-06-23', '2025-10-11'),
    (v_year_id, 'Even Semester Teaching', 'even', '2025-12-15', '2026-04-10');

  -- ============================================
  -- 7. VACATION PERIODS
  -- ============================================
  INSERT INTO vacation_periods (academic_year_id, name, start_date, end_date, applies_to)
  VALUES 
    (v_year_id, 'Diwali Vacation (Students)', '2025-10-13', '2025-10-26', 'students'),
    (v_year_id, 'Diwali Vacation (Employees)', '2025-10-18', '2025-10-26', 'employees'),
    (v_year_id, 'Semester Break (Students)', '2025-11-24', '2025-12-14', 'students'),
    (v_year_id, 'Summer Vacation (Students)', '2026-05-11', '2026-06-21', 'students');

  -- ============================================
  -- 8. EXAM PERIODS
  -- ============================================
  INSERT INTO exam_periods (academic_year_id, name, exam_type, semester_type, start_date, end_date)
  VALUES 
    -- Odd Semester Exams
    (v_year_id, 'Odd Semester Regular Exam', 'regular', 'odd', '2025-10-27', '2025-11-21'),
    (v_year_id, 'Odd Semester Remedial Exam', 'remedial', 'odd', '2025-12-08', '2025-12-12'),
    -- Even Semester Exams
    (v_year_id, 'Even Semester Regular Exam', 'regular', 'even', '2026-04-13', '2026-05-08'),
    (v_year_id, 'Even Semester Remedial Exam', 'remedial', 'even', '2026-05-25', '2026-05-30');

  RAISE NOTICE 'Academic Calendar 2025-26 data imported successfully!';
  RAISE NOTICE 'Academic Year ID: %', v_year_id;
  
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Count of events by type
SELECT 
  event_type, 
  COUNT(*) as count,
  SUM(CASE WHEN is_non_teaching THEN 1 ELSE 0 END) as non_teaching_count
FROM calendar_events 
WHERE academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-26')
GROUP BY event_type
ORDER BY event_type;

-- List all holidays
SELECT event_date, title 
FROM calendar_events 
WHERE academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-26')
  AND event_type = 'holiday'
ORDER BY event_date;

-- Vacation periods
SELECT name, start_date, end_date, applies_to
FROM vacation_periods
WHERE academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-26')
ORDER BY start_date;

-- Exam periods
SELECT name, exam_type, semester_type, start_date, end_date
FROM exam_periods
WHERE academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-26')
ORDER BY start_date;

-- Teaching periods
SELECT name, semester_type, start_date, end_date
FROM teaching_periods
WHERE academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-26')
ORDER BY start_date;

-- Test: Is today a teaching day?
SELECT is_teaching_day(CURRENT_DATE);

-- Test: Count teaching days in odd semester
SELECT count_teaching_days('2025-06-23', '2025-10-11');
