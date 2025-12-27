-- ============================================================================
-- TEST APP USER FOR ENGINE DEV MODE
-- ============================================================================
-- Creates an app_users record that links the test student to their academic context.
-- The engine's get_student_context() function queries this table.
-- Run AFTER 10-sample-hierarchy-data.sql
-- ============================================================================

-- First, we need to remove the FK constraint temporarily (for dev only)
-- because the test student's app_user ID doesn't exist in auth.users
-- The engine uses service_key which bypasses RLS anyway.

-- Option 1: If using real auth user (replace with your Supabase auth user ID)
-- Option 2: For testing, we'll use the student_id as the app_users.id 
--           but need to disable the FK check first

-- Create app_users record for test student with proper academic context
DO $$
DECLARE
  v_test_student_id UUID := '11111111-1111-1111-1111-111111111111';
  v_batch_id UUID;
  v_semester_id UUID;
BEGIN
  -- Get the batch and semester from the test student's assignment
  SELECT 
    s.batch_id,
    c.semester_id
  INTO v_batch_id, v_semester_id
  FROM students s
  JOIN batches bat ON s.batch_id = bat.id
  JOIN classes c ON bat.class_id = c.id
  WHERE s.id = v_test_student_id;
  
  IF v_batch_id IS NULL THEN
    -- Fallback: find any batch
    SELECT 
      bat.id,
      c.semester_id
    INTO v_batch_id, v_semester_id
    FROM batches bat
    JOIN classes c ON bat.class_id = c.id
    LIMIT 1;
  END IF;
  
  IF v_batch_id IS NOT NULL THEN
    -- Delete any existing record for this student first
    DELETE FROM app_users WHERE student_id = v_test_student_id;
    
    -- Try to insert with a real auth user ID if it exists
    -- If not, we'll need to use a workaround
    BEGIN
      -- Try using a real auth user from auth.users
      INSERT INTO app_users (id, student_id, current_batch_id, current_semester_id, is_active)
      SELECT 
        au.id,
        v_test_student_id,
        v_batch_id,
        v_semester_id,
        true
      FROM auth.users au
      LIMIT 1
      ON CONFLICT (id) DO UPDATE SET 
        student_id = v_test_student_id,
        current_batch_id = v_batch_id,
        current_semester_id = v_semester_id,
        is_active = true,
        updated_at = NOW();
      
      RAISE NOTICE 'Created app_users using existing auth user → student % (batch: %, semester: %)', 
        v_test_student_id, v_batch_id, v_semester_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not create app_users: %. You may need to insert manually after logging in.', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'No batch found! Cannot create app_users record.';
  END IF;
END $$;

-- Verify the app_users record
SELECT 
  au.id as auth_user_id,
  au.student_id,
  s.name as student_name,
  bat.batch_letter,
  c.class_number,
  sem.semester_number,
  b.abbreviation as branch
FROM app_users au
LEFT JOIN students s ON au.student_id = s.id
LEFT JOIN batches bat ON au.current_batch_id = bat.id
LEFT JOIN classes c ON bat.class_id = c.id
LEFT JOIN semesters sem ON c.semester_id = sem.id
LEFT JOIN branches b ON sem.branch_id = b.id
WHERE au.student_id = '11111111-1111-1111-1111-111111111111';
