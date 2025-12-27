-- ============================================================================
-- QUICK FIX: Create app_users record for test portal
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Replace these with your actual values:
-- 1. Your auth user ID from the test portal login
-- 2. The test student ID used by the engine

-- First, find your batch and semester IDs
SELECT 
  bat.id as batch_id,
  c.semester_id,
  bat.batch_letter,
  c.class_number,
  sem.semester_number,
  b.abbreviation as branch
FROM batches bat
JOIN classes c ON bat.class_id = c.id
JOIN semesters sem ON c.semester_id = sem.id
JOIN branches b ON sem.branch_id = b.id
WHERE bat.batch_letter = 'A' AND c.class_number = 1
LIMIT 5;

-- Then insert the app_users record
-- UPDATE these UUIDs based on your data:
INSERT INTO app_users (id, student_id, current_batch_id, current_semester_id, is_active)
VALUES (
  '70f7674e-bd5f-47ae-b796-10dbbd7008c2',  -- Your Supabase auth user ID (from logging in)
  '11111111-1111-1111-1111-111111111111',  -- Test student ID
  '50861035-71bf-46f2-ba5e-ecf7e82fa9e4',  -- Batch A
  'ad95e385-acdc-472e-b5f1-10fd107aa9b2',  -- Semester 1
  true
)
ON CONFLICT (id) DO UPDATE SET 
  student_id = EXCLUDED.student_id,
  current_batch_id = EXCLUDED.current_batch_id,
  current_semester_id = EXCLUDED.current_semester_id,
  is_active = true,
  updated_at = NOW();

-- Verify
SELECT * FROM app_users WHERE student_id = '11111111-1111-1111-1111-111111111111';
