-- =====================================================================
-- FIX: Elective RLS Policies
-- Run this IMMEDIATELY to fix the "admin_users" recursion error
-- =====================================================================

-- Drop the broken policies
DROP POLICY IF EXISTS "elective_groups_admin_write" ON elective_groups;
DROP POLICY IF EXISTS "student_electives_own_write" ON student_electives;
DROP POLICY IF EXISTS "student_electives_own_update" ON student_electives;
DROP POLICY IF EXISTS "student_electives_own_delete" ON student_electives;
DROP POLICY IF EXISTS "student_electives_own_read" ON student_electives;

-- Recreate with correct table reference (users, not admin_users)

-- elective_groups: admins can write
CREATE POLICY "elective_groups_admin_write" ON elective_groups
  FOR ALL USING (
    (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

-- student_electives: students manage own, admins manage all
CREATE POLICY "student_electives_own_read" ON student_electives
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

CREATE POLICY "student_electives_own_write" ON student_electives
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

CREATE POLICY "student_electives_own_update" ON student_electives
  FOR UPDATE USING (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

CREATE POLICY "student_electives_own_delete" ON student_electives
  FOR DELETE USING (
    student_id IN (SELECT id FROM students WHERE email = auth.email())
    OR (SELECT u.is_admin FROM users u WHERE u.id = auth.uid()) = true
  );

-- Done!
