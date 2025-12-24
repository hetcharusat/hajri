-- Run this in Supabase SQL Editor AFTER your tables exist.
-- Goal: allow anyone to read public data, but only approved admins can write.
--
-- 1) Create admin_users table
-- 2) Add your email(s)
-- 3) Enable RLS write policies for admin operations

CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add yourself as admin (replace with YOUR email)
-- INSERT INTO admin_users (email) VALUES ('you@example.com');

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can see the admin list
CREATE POLICY IF NOT EXISTS "Admins read admin_users"
ON admin_users FOR SELECT
USING (EXISTS (
  SELECT 1 FROM admin_users a
  WHERE a.email = (auth.jwt() ->> 'email')
));

-- Only admins can edit admin list
CREATE POLICY IF NOT EXISTS "Admins write admin_users"
ON admin_users FOR ALL
USING (EXISTS (
  SELECT 1 FROM admin_users a
  WHERE a.email = (auth.jwt() ->> 'email')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM admin_users a
  WHERE a.email = (auth.jwt() ->> 'email')
));

-- Helper predicate (inline): is_admin
-- We repeat it in policies for simplicity.

-- Departments
CREATE POLICY IF NOT EXISTS "Admins insert departments"
ON departments FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins update departments"
ON departments FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins delete departments"
ON departments FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

-- Semesters
CREATE POLICY IF NOT EXISTS "Admins insert semesters"
ON semesters FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins update semesters"
ON semesters FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins delete semesters"
ON semesters FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

-- Subjects
CREATE POLICY IF NOT EXISTS "Admins insert subjects"
ON subjects FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins update subjects"
ON subjects FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins delete subjects"
ON subjects FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

-- Timetable
CREATE POLICY IF NOT EXISTS "Admins insert timetable"
ON timetable_entries FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins update timetable"
ON timetable_entries FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY IF NOT EXISTS "Admins delete timetable"
ON timetable_entries FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));
