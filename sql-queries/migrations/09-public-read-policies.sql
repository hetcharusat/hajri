-- ============================================================================
-- PUBLIC READ POLICIES FOR AUTHENTICATED USERS
-- ============================================================================
-- This allows any authenticated user (logged in via Supabase Auth) to read
-- reference data following the V3 hierarchy:
-- Department → Branch → Semester → Class → Batch
--
-- Run this in Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- DEPARTMENTS (public read)  
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'Anyone can read departments'
  ) THEN
    CREATE POLICY "Anyone can read departments" ON departments
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- BRANCHES (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Anyone can read branches'
  ) THEN
    CREATE POLICY "Anyone can read branches" ON branches
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- SEMESTERS (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'semesters' AND policyname = 'Anyone can read semesters'
  ) THEN
    CREATE POLICY "Anyone can read semesters" ON semesters
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- CLASSES (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'classes' AND policyname = 'Anyone can read classes'
  ) THEN
    CREATE POLICY "Anyone can read classes" ON classes
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- BATCHES (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'Anyone can read batches'
  ) THEN
    CREATE POLICY "Anyone can read batches" ON batches
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- SUBJECTS (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'Anyone can read subjects'
  ) THEN
    CREATE POLICY "Anyone can read subjects" ON subjects
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- FACULTY (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'faculty' AND policyname = 'Anyone can read faculty'
  ) THEN
    CREATE POLICY "Anyone can read faculty" ON faculty
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- ROOMS (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Anyone can read rooms'
  ) THEN
    CREATE POLICY "Anyone can read rooms" ON rooms
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- TIMETABLE VERSIONS (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'timetable_versions' AND policyname = 'Anyone can read timetable_versions'
  ) THEN
    CREATE POLICY "Anyone can read timetable_versions" ON timetable_versions
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- TIMETABLE EVENTS (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'timetable_events' AND policyname = 'Anyone can read timetable_events'
  ) THEN
    CREATE POLICY "Anyone can read timetable_events" ON timetable_events
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- TIMETABLE ENTRIES (legacy, public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'timetable_entries' AND policyname = 'Anyone can read timetable_entries'
  ) THEN
    CREATE POLICY "Anyone can read timetable_entries" ON timetable_entries
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- COURSE OFFERINGS (public read)
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_offerings' AND policyname = 'Anyone can read course_offerings'
  ) THEN
    CREATE POLICY "Anyone can read course_offerings" ON course_offerings
      FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================================
-- Optional tables (only if they exist)
-- ============================================================================

-- PERIOD TEMPLATES
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'period_templates') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'period_templates' AND policyname = 'Anyone can read period_templates'
    ) THEN
      CREATE POLICY "Anyone can read period_templates" ON period_templates
        FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- ELECTIVE GROUPS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'elective_groups') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'elective_groups' AND policyname = 'Anyone can read elective_groups'
    ) THEN
      CREATE POLICY "Anyone can read elective_groups" ON elective_groups
        FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- STUDENT ELECTIVES
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'student_electives') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'student_electives' AND policyname = 'Anyone can read student_electives'
    ) THEN
      CREATE POLICY "Anyone can read student_electives" ON student_electives
        FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Done!
-- ============================================================================
-- After running this, authenticated users can read all reference data
-- but only admins can INSERT/UPDATE/DELETE (from 04-SUPABASE-ADMIN-POLICIES.sql)


-- ============================================================================
-- Done!
-- ============================================================================
-- After running this, authenticated users can read all reference data
-- but only admins can INSERT/UPDATE/DELETE (from 04-SUPABASE-ADMIN-POLICIES.sql)


-- ============================================================================
-- Done!
-- ============================================================================
-- After running this, authenticated users can read all reference data
-- but only admins can INSERT/UPDATE/DELETE (from 04-SUPABASE-ADMIN-POLICIES.sql)
