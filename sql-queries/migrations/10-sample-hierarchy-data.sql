-- ============================================================================
-- TEST STUDENT FOR ENGINE DEV MODE
-- ============================================================================
-- This creates a test student linked to an existing batch in your database.
-- Run AFTER 09-public-read-policies.sql
--
-- The test portal uses student ID: 11111111-1111-1111-1111-111111111111
-- This must exist in the students table for engine API calls to work.
-- ============================================================================

-- Create a test student linked to an existing batch (DEPSTAR → CE → Sem 4 → Class 1 → Batch A)
DO $$
DECLARE
  v_batch_id UUID;
  v_test_student_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- Find an existing batch (preferring DEPSTAR CE Semester 4 Class 1 Batch A based on your screenshot)
  SELECT bat.id INTO v_batch_id
  FROM batches bat
  JOIN classes c ON bat.class_id = c.id
  JOIN semesters s ON c.semester_id = s.id
  JOIN branches b ON s.branch_id = b.id
  WHERE bat.batch_letter = 'A'
    AND c.class_number = 1
  ORDER BY s.semester_number DESC
  LIMIT 1;
  
  -- Fallback: just get any batch
  IF v_batch_id IS NULL THEN
    SELECT id INTO v_batch_id FROM batches LIMIT 1;
  END IF;
  
  IF v_batch_id IS NOT NULL THEN
    -- Insert or update the test student
    INSERT INTO students (id, roll_number, name, email, batch_id, enrollment_year)
    VALUES (v_test_student_id, 'TEST001', 'Test Student (Dev Mode)', 'test@hajri.dev', v_batch_id, 2024)
    ON CONFLICT (id) DO UPDATE SET 
      batch_id = v_batch_id,
      name = 'Test Student (Dev Mode)';
    
    RAISE NOTICE 'Created/Updated test student % linked to batch %', v_test_student_id, v_batch_id;
  ELSE
    RAISE WARNING 'No batches found in database! Cannot create test student.';
  END IF;
END $$;

-- Verify the test student
SELECT 
  s.id,
  s.name,
  s.roll_number,
  bat.batch_letter,
  c.class_number,
  sem.semester_number,
  b.abbreviation as branch,
  d.name as department
FROM students s
JOIN batches bat ON s.batch_id = bat.id
JOIN classes c ON bat.class_id = c.id
JOIN semesters sem ON c.semester_id = sem.id
JOIN branches b ON sem.branch_id = b.id
JOIN departments d ON b.department_id = d.id
WHERE s.id = '11111111-1111-1111-1111-111111111111';

