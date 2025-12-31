-- ============================================================================
-- COMPLETE TEST SETUP FOR HAJRI ENGINE
-- Run this in Supabase SQL Editor to set up everything for testing
-- ============================================================================

-- ============================================================================
-- STEP 1: Create hierarchy (Branch → Semester → Class → Batch → Student)
-- ============================================================================

DO $$
DECLARE
  v_test_student_id UUID := '11111111-1111-1111-1111-111111111111';
  v_auth_user_id UUID;
  v_branch_id UUID;
  v_semester_id UUID;
  v_class_id UUID;
  v_batch_id UUID;
BEGIN
  -- Get the first auth user (your logged-in user)
  SELECT id INTO v_auth_user_id FROM auth.users LIMIT 1;
  
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found! Please log in to the app first.';
  END IF;

  RAISE NOTICE 'Using auth user: %', v_auth_user_id;

  -- ========== BRANCH ==========
  SELECT id INTO v_branch_id FROM branches WHERE abbreviation = 'CE' LIMIT 1;
  IF v_branch_id IS NULL THEN
    INSERT INTO branches (abbreviation, name) 
    VALUES ('CE', 'Computer Engineering')
    RETURNING id INTO v_branch_id;
    RAISE NOTICE 'Created branch: %', v_branch_id;
  ELSE
    RAISE NOTICE 'Found existing branch: %', v_branch_id;
  END IF;

  -- ========== SEMESTER ==========
  SELECT id INTO v_semester_id 
  FROM semesters 
  WHERE branch_id = v_branch_id AND semester_number = 4 
  LIMIT 1;
  
  IF v_semester_id IS NULL THEN
    INSERT INTO semesters (branch_id, semester_number, start_date, end_date)
    VALUES (v_branch_id, 4, '2025-01-01', '2025-05-31')
    RETURNING id INTO v_semester_id;
    RAISE NOTICE 'Created semester: %', v_semester_id;
  ELSE
    RAISE NOTICE 'Found existing semester: %', v_semester_id;
  END IF;

  -- ========== CLASS ==========
  SELECT id INTO v_class_id 
  FROM classes 
  WHERE semester_id = v_semester_id AND class_number = 1 
  LIMIT 1;
  
  IF v_class_id IS NULL THEN
    INSERT INTO classes (semester_id, class_number, name)
    VALUES (v_semester_id, 1, 'CE Sem-4 Class 1')
    RETURNING id INTO v_class_id;
    RAISE NOTICE 'Created class: %', v_class_id;
  ELSE
    RAISE NOTICE 'Found existing class: %', v_class_id;
  END IF;

  -- ========== BATCH ==========
  SELECT id INTO v_batch_id 
  FROM batches 
  WHERE class_id = v_class_id AND batch_letter = 'A' 
  LIMIT 1;
  
  IF v_batch_id IS NULL THEN
    INSERT INTO batches (class_id, batch_letter, name)
    VALUES (v_class_id, 'A', 'Batch A')
    RETURNING id INTO v_batch_id;
    RAISE NOTICE 'Created batch: %', v_batch_id;
  ELSE
    RAISE NOTICE 'Found existing batch: %', v_batch_id;
  END IF;

  -- ========== STUDENT ==========
  -- Delete existing test student first to avoid conflicts
  DELETE FROM students WHERE id = v_test_student_id;
  
  INSERT INTO students (id, roll_number, name, batch_id)
  VALUES (v_test_student_id, 'TEST001', 'Test Student', v_batch_id);
  RAISE NOTICE 'Created student: %', v_test_student_id;

  -- ========== APP_USERS ==========
  -- Delete existing to avoid conflicts
  DELETE FROM app_users WHERE id = v_auth_user_id;
  
  INSERT INTO app_users (id, student_id, current_batch_id, current_semester_id, is_active)
  VALUES (v_auth_user_id, v_test_student_id, v_batch_id, v_semester_id, true);
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ STEP 1 COMPLETE!';
  RAISE NOTICE '   Auth User: %', v_auth_user_id;
  RAISE NOTICE '   Student: %', v_test_student_id;
  RAISE NOTICE '   Batch: %', v_batch_id;
  RAISE NOTICE '   Semester: %', v_semester_id;
END $$;

-- ============================================================================
-- STEP 2: Create subjects for this semester
-- ============================================================================

DO $$
DECLARE
  v_semester_id UUID;
  v_batch_id UUID;
  v_subject_count INT;
BEGIN
  -- Get semester and batch from the app_users we just created
  SELECT current_semester_id, current_batch_id 
  INTO v_semester_id, v_batch_id
  FROM app_users 
  WHERE student_id = '11111111-1111-1111-1111-111111111111'
  LIMIT 1;

  IF v_semester_id IS NULL THEN
    RAISE EXCEPTION 'No app_users record found! Run Step 1 first.';
  END IF;

  -- Delete existing subjects for this semester to avoid duplicates
  DELETE FROM subjects WHERE semester_id = v_semester_id;

  -- Create fresh subjects
  INSERT INTO subjects (code, name, type, semester_id, credits) VALUES
    ('CS401', 'Data Structures', 'LECTURE', v_semester_id, 4),
    ('CS402', 'Database Systems', 'LECTURE', v_semester_id, 4),
    ('CS403', 'Operating Systems', 'LECTURE', v_semester_id, 4),
    ('CS404', 'Computer Networks', 'LECTURE', v_semester_id, 3),
    ('CS405', 'Web Development', 'LECTURE', v_semester_id, 3),
    ('CS401L', 'DS Lab', 'LAB', v_semester_id, 2),
    ('CS402L', 'DBMS Lab', 'LAB', v_semester_id, 2);

  SELECT COUNT(*) INTO v_subject_count FROM subjects WHERE semester_id = v_semester_id;
  RAISE NOTICE 'Created % subjects', v_subject_count;

  -- Delete existing course offerings for this batch
  DELETE FROM course_offerings WHERE batch_id = v_batch_id;

  -- Create course offerings linking subjects to batch
  INSERT INTO course_offerings (subject_id, batch_id)
  SELECT s.id, v_batch_id
  FROM subjects s
  WHERE s.semester_id = v_semester_id;

  RAISE NOTICE '';
  RAISE NOTICE '✅ STEP 2 COMPLETE! Subjects and course offerings created.';
END $$;

-- ============================================================================
-- STEP 3: Create timetable (for predictions)
-- ============================================================================

DO $$
DECLARE
  v_batch_id UUID;
  v_version_id UUID;
  v_event_count INT;
BEGIN
  -- Get batch
  SELECT current_batch_id INTO v_batch_id
  FROM app_users 
  WHERE student_id = '11111111-1111-1111-1111-111111111111'
  LIMIT 1;

  IF v_batch_id IS NULL THEN
    RAISE EXCEPTION 'No batch found! Run Step 1 first.';
  END IF;

  -- Delete existing timetable versions for this batch
  DELETE FROM timetable_versions WHERE batch_id = v_batch_id;

  -- Create timetable version
  INSERT INTO timetable_versions (batch_id, name, status)
  VALUES (v_batch_id, 'Sem 4 Timetable', 'published')
  RETURNING id INTO v_version_id;

  RAISE NOTICE 'Created timetable version: %', v_version_id;

  -- Create timetable events - each subject gets 3 slots per week
  INSERT INTO timetable_events (version_id, offering_id, day_of_week, start_time, end_time)
  SELECT 
    v_version_id,
    co.id,
    CASE 
      WHEN s.type = 'LAB' THEN (row_number() OVER (PARTITION BY s.type ORDER BY s.code) % 2) + 3  -- Wed=3, Thu=4
      ELSE (row_number() OVER (PARTITION BY s.type ORDER BY s.code) % 5) + 1  -- Mon=1 to Fri=5
    END as day_of_week,
    ('08:00:00'::time + interval '1 hour' * (row_number() OVER () - 1)),
    ('09:00:00'::time + interval '1 hour' * (row_number() OVER () - 1))
  FROM course_offerings co
  JOIN subjects s ON co.subject_id = s.id
  WHERE co.batch_id = v_batch_id;

  SELECT COUNT(*) INTO v_event_count FROM timetable_events WHERE version_id = v_version_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ STEP 3 COMPLETE! Created % timetable events.', v_event_count;
END $$;

-- ============================================================================
-- STEP 4: Create sample OCR snapshot (baseline attendance)
-- ============================================================================

DO $$
DECLARE
  v_test_student_id UUID := '11111111-1111-1111-1111-111111111111';
  v_semester_id UUID;
  v_batch_id UUID;
  v_snapshot_id UUID;
  v_entries JSONB;
BEGIN
  -- Get context
  SELECT current_semester_id, current_batch_id 
  INTO v_semester_id, v_batch_id
  FROM app_users 
  WHERE student_id = v_test_student_id
  LIMIT 1;

  IF v_semester_id IS NULL THEN
    RAISE EXCEPTION 'No app_users record found! Run Step 1 first.';
  END IF;

  -- Build entries from subjects
  SELECT jsonb_agg(
    jsonb_build_object(
      'course_code', s.code,
      'course_name', s.name,
      'class_type', s.type,
      'present', CASE WHEN s.type = 'LAB' THEN 8 ELSE 25 END,
      'total', CASE WHEN s.type = 'LAB' THEN 10 ELSE 30 END,
      'percentage', CASE WHEN s.type = 'LAB' THEN 80.0 ELSE 83.33 END
    )
  )
  INTO v_entries
  FROM subjects s
  WHERE s.semester_id = v_semester_id;

  -- Delete old snapshots for this student
  DELETE FROM ocr_snapshots WHERE student_id = v_test_student_id;

  -- Insert new snapshot (captured yesterday, confirmed now)
  INSERT INTO ocr_snapshots (
    student_id, batch_id, semester_id,
    captured_at, confirmed_at,
    source_type, entries
  ) VALUES (
    v_test_student_id, v_batch_id, v_semester_id,
    NOW() - interval '1 day', NOW(),
    'test_setup', v_entries
  ) RETURNING id INTO v_snapshot_id;

  RAISE NOTICE '';
  RAISE NOTICE '✅ STEP 4 COMPLETE!';
  RAISE NOTICE '   Snapshot ID: %', v_snapshot_id;
  RAISE NOTICE '   Entries: %', v_entries;
END $$;

-- ============================================================================
-- STEP 5: Clear any computed data (let engine recompute fresh)
-- ============================================================================

DO $$
DECLARE
  v_test_student_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- Clear attendance summary
  DELETE FROM attendance_summary WHERE student_id = v_test_student_id;
  
  -- Clear predictions
  DELETE FROM attendance_predictions WHERE student_id = v_test_student_id;
  
  -- Clear manual attendance
  DELETE FROM manual_attendance WHERE student_id = v_test_student_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ STEP 5 COMPLETE! Cleared computed data. Engine will recompute.';
END $$;

-- ============================================================================
-- STEP 6: Verify setup (separate queries to avoid UNION issues)
-- ============================================================================

SELECT '=== TEST SETUP VERIFICATION ===' as info;

SELECT 
  'App User' as record_type,
  au.id::text as record_id,
  s.name as details
FROM app_users au
JOIN students s ON au.student_id = s.id
WHERE au.student_id = '11111111-1111-1111-1111-111111111111';

SELECT 
  'Subjects' as record_type,
  COUNT(*)::text as record_id,
  string_agg(code, ', ') as details
FROM subjects
WHERE semester_id = (
  SELECT current_semester_id 
  FROM app_users 
  WHERE student_id = '11111111-1111-1111-1111-111111111111'
);

SELECT 
  'Snapshot' as record_type,
  id::text as record_id,
  'Captured: ' || captured_at::date::text as details
FROM ocr_snapshots
WHERE student_id = '11111111-1111-1111-1111-111111111111'
ORDER BY confirmed_at DESC
LIMIT 1;

SELECT 
  'Timetable Events' as record_type,
  COUNT(*)::text as record_id,
  'Ready for predictions' as details
FROM timetable_events te
JOIN timetable_versions tv ON te.version_id = tv.id
WHERE tv.batch_id = (
  SELECT current_batch_id 
  FROM app_users 
  WHERE student_id = '11111111-1111-1111-1111-111111111111'
);

SELECT '' as info;
SELECT '✅ TEST SETUP COMPLETE!' as info;
SELECT 'Now go to Test Portal → Engine Test tab and click "Check Setup"' as info;
