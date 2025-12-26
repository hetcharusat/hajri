-- ============================================
-- SECURITY FIXES MIGRATION
-- Created: 2025-12-26
-- Purpose: Enable RLS on missing tables and fix function search paths
-- SAFE TO RUN: Uses IF NOT EXISTS and checks for table existence
-- ============================================

-- ============================================
-- PART 0: Ensure admin_users table exists
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on admin_users if not already
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create admin_users policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'Admins read admin_users') THEN
    CREATE POLICY "Admins read admin_users" ON admin_users FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'Admins write admin_users') THEN
    CREATE POLICY "Admins write admin_users" ON admin_users FOR ALL
    USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
    WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));
  END IF;
END $$;

-- ============================================
-- PART 1: Enable RLS on tables (only if they exist)
-- ============================================

-- Helper function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE email = (auth.jwt() ->> 'email')
  );
$$;

-- semester_faculty
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'semester_faculty') THEN
    ALTER TABLE semester_faculty ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'semester_faculty' AND policyname = 'Public read semester_faculty') THEN
      CREATE POLICY "Public read semester_faculty" ON semester_faculty FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'semester_faculty' AND policyname = 'Admins write semester_faculty') THEN
      CREATE POLICY "Admins write semester_faculty" ON semester_faculty FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

-- subject_components
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_components') THEN
    ALTER TABLE subject_components ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subject_components' AND policyname = 'Public read subject_components') THEN
      CREATE POLICY "Public read subject_components" ON subject_components FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subject_components' AND policyname = 'Admins write subject_components') THEN
      CREATE POLICY "Admins write subject_components" ON subject_components FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

-- offering_teachers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offering_teachers') THEN
    ALTER TABLE offering_teachers ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offering_teachers' AND policyname = 'Public read offering_teachers') THEN
      CREATE POLICY "Public read offering_teachers" ON offering_teachers FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'offering_teachers' AND policyname = 'Admins write offering_teachers') THEN
      CREATE POLICY "Admins write offering_teachers" ON offering_teachers FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

-- event_batches
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_batches') THEN
    ALTER TABLE event_batches ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_batches' AND policyname = 'Public read event_batches') THEN
      CREATE POLICY "Public read event_batches" ON event_batches FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_batches' AND policyname = 'Admins write event_batches') THEN
      CREATE POLICY "Admins write event_batches" ON event_batches FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

-- event_rooms
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_rooms') THEN
    ALTER TABLE event_rooms ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_rooms' AND policyname = 'Public read event_rooms') THEN
      CREATE POLICY "Public read event_rooms" ON event_rooms FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_rooms' AND policyname = 'Admins write event_rooms') THEN
      CREATE POLICY "Admins write event_rooms" ON event_rooms FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

-- faculty_constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'faculty_constraints') THEN
    ALTER TABLE faculty_constraints ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faculty_constraints' AND policyname = 'Public read faculty_constraints') THEN
      CREATE POLICY "Public read faculty_constraints" ON faculty_constraints FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'faculty_constraints' AND policyname = 'Admins write faculty_constraints') THEN
      CREATE POLICY "Admins write faculty_constraints" ON faculty_constraints FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

-- batch_groups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'batch_groups') THEN
    ALTER TABLE batch_groups ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batch_groups' AND policyname = 'Public read batch_groups') THEN
      CREATE POLICY "Public read batch_groups" ON batch_groups FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batch_groups' AND policyname = 'Admins write batch_groups') THEN
      CREATE POLICY "Admins write batch_groups" ON batch_groups FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;

-- batch_group_members
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'batch_group_members') THEN
    ALTER TABLE batch_group_members ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batch_group_members' AND policyname = 'Public read batch_group_members') THEN
      CREATE POLICY "Public read batch_group_members" ON batch_group_members FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batch_group_members' AND policyname = 'Admins write batch_group_members') THEN
      CREATE POLICY "Admins write batch_group_members" ON batch_group_members FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    END IF;
  END IF;
END $$;


-- ============================================
-- PART 2: Fix function search paths (only if referenced tables exist)
-- ============================================

-- Fix get_current_lecture function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_events') THEN
    DROP FUNCTION IF EXISTS public.get_current_lecture(UUID);
    CREATE FUNCTION public.get_current_lecture(p_batch_id UUID)
    RETURNS TABLE (
      subject_code TEXT,
      subject_name TEXT,
      faculty_name TEXT,
      room_number TEXT,
      start_time TIME,
      end_time TIME
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      v_day_of_week INT;
      v_current_time TIME;
    BEGIN
      v_day_of_week := EXTRACT(DOW FROM CURRENT_DATE)::INT;
      v_current_time := CURRENT_TIME;
      
      IF v_day_of_week = 0 THEN
        RETURN;
      END IF;
      
      RETURN QUERY
      SELECT 
        s.code AS subject_code,
        s.name AS subject_name,
        f.name AS faculty_name,
        r.room_number,
        te.start_time,
        te.end_time
      FROM timetable_events te
      JOIN timetable_versions tv ON te.version_id = tv.id
      JOIN course_offerings co ON te.offering_id = co.id
      JOIN subjects s ON co.subject_id = s.id
      LEFT JOIN faculty f ON co.faculty_id = f.id
      LEFT JOIN rooms r ON te.room_id = r.id
      WHERE tv.batch_id = p_batch_id
        AND tv.status = 'active'
        AND te.day_of_week = v_day_of_week
        AND v_current_time BETWEEN te.start_time AND te.end_time;
    END;
    $fn$;
  END IF;
END $$;


-- Fix cleanup_old_drafts function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_versions') THEN
    DROP FUNCTION IF EXISTS public.cleanup_old_drafts();
    CREATE FUNCTION public.cleanup_old_drafts()
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      deleted_count INTEGER;
    BEGIN
      WITH deleted AS (
        DELETE FROM timetable_versions
        WHERE status = 'draft'
          AND updated_at < NOW() - INTERVAL '30 days'
        RETURNING id
      )
      SELECT COUNT(*) INTO deleted_count FROM deleted;
      
      RETURN deleted_count;
    END;
    $fn$;
  END IF;
END $$;


-- Fix find_orphaned_offerings function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_offerings') THEN
    DROP FUNCTION IF EXISTS public.find_orphaned_offerings();
    CREATE FUNCTION public.find_orphaned_offerings()
    RETURNS TABLE (
      offering_id UUID,
      subject_code TEXT,
      batch_name TEXT
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      RETURN QUERY
      SELECT 
        co.id AS offering_id,
        s.code AS subject_code,
        b.name AS batch_name
      FROM course_offerings co
      JOIN subjects s ON co.subject_id = s.id
      JOIN batches b ON co.batch_id = b.id
      WHERE NOT EXISTS (
        SELECT 1 FROM timetable_events te WHERE te.offering_id = co.id
      );
    END;
    $fn$;
  END IF;
END $$;


-- Fix is_teaching_day function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_years') THEN
    DROP FUNCTION IF EXISTS public.is_teaching_day(DATE, UUID);
    CREATE FUNCTION public.is_teaching_day(check_date DATE, p_academic_year_id UUID DEFAULT NULL)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      v_day_of_week INT;
      v_academic_year_id UUID;
    BEGIN
      v_day_of_week := EXTRACT(DOW FROM check_date)::INT;
      
      IF v_day_of_week = 0 THEN
        RETURN FALSE;
      END IF;
      
      IF p_academic_year_id IS NULL THEN
        SELECT id INTO v_academic_year_id FROM academic_years WHERE is_current = TRUE LIMIT 1;
      ELSE
        v_academic_year_id := p_academic_year_id;
      END IF;
      
      IF EXISTS (
        SELECT 1 FROM weekly_off_days 
        WHERE academic_year_id = v_academic_year_id 
          AND day_of_week = v_day_of_week 
          AND is_off = TRUE
      ) THEN
        RETURN FALSE;
      END IF;
      
      IF EXISTS (
        SELECT 1 FROM calendar_events 
        WHERE academic_year_id = v_academic_year_id 
          AND check_date BETWEEN event_date AND COALESCE(end_date, event_date)
          AND is_non_teaching = TRUE
      ) THEN
        RETURN FALSE;
      END IF;
      
      IF EXISTS (
        SELECT 1 FROM vacation_periods 
        WHERE academic_year_id = v_academic_year_id 
          AND check_date BETWEEN start_date AND end_date
      ) THEN
        RETURN FALSE;
      END IF;
      
      IF EXISTS (
        SELECT 1 FROM exam_periods 
        WHERE academic_year_id = v_academic_year_id 
          AND check_date BETWEEN start_date AND end_date
      ) THEN
        RETURN FALSE;
      END IF;
      
      RETURN TRUE;
    END;
    $fn$;
  END IF;
END $$;


-- Fix count_teaching_days function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_years') THEN
    DROP FUNCTION IF EXISTS public.count_teaching_days(DATE, DATE, UUID);
    CREATE FUNCTION public.count_teaching_days(start_date DATE, end_date DATE, p_academic_year_id UUID DEFAULT NULL)
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      teaching_count INTEGER := 0;
      current_date DATE;
    BEGIN
      current_date := start_date;
      
      WHILE current_date <= end_date LOOP
        IF is_teaching_day(current_date, p_academic_year_id) THEN
          teaching_count := teaching_count + 1;
        END IF;
        current_date := current_date + INTERVAL '1 day';
      END LOOP;
      
      RETURN teaching_count;
    END;
    $fn$;
  END IF;
END $$;


-- Fix check_room_conflict function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_events') THEN
    DROP FUNCTION IF EXISTS public.check_room_conflict(UUID, INT, TIME, TIME, UUID, UUID);
    CREATE FUNCTION public.check_room_conflict(
      p_room_id UUID,
      p_day_of_week INT,
      p_start_time TIME,
      p_end_time TIME,
      p_version_id UUID,
      p_exclude_event_id UUID DEFAULT NULL
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM timetable_events te
        JOIN timetable_versions tv ON te.version_id = tv.id
        WHERE te.room_id = p_room_id
          AND te.day_of_week = p_day_of_week
          AND te.version_id = p_version_id
          AND (te.id IS DISTINCT FROM p_exclude_event_id)
          AND (
            (p_start_time >= te.start_time AND p_start_time < te.end_time)
            OR (p_end_time > te.start_time AND p_end_time <= te.end_time)
            OR (p_start_time <= te.start_time AND p_end_time >= te.end_time)
          )
      );
    END;
    $fn$;
  END IF;
END $$;


-- Fix check_faculty_conflict function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_events') THEN
    DROP FUNCTION IF EXISTS public.check_faculty_conflict(UUID, INT, TIME, TIME, UUID, UUID);
    CREATE FUNCTION public.check_faculty_conflict(
      p_faculty_id UUID,
      p_day_of_week INT,
      p_start_time TIME,
      p_end_time TIME,
      p_version_id UUID,
      p_exclude_event_id UUID DEFAULT NULL
    )
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM timetable_events te
        JOIN course_offerings co ON te.offering_id = co.id
        JOIN timetable_versions tv ON te.version_id = tv.id
        WHERE co.faculty_id = p_faculty_id
          AND te.day_of_week = p_day_of_week
          AND te.version_id = p_version_id
          AND (te.id IS DISTINCT FROM p_exclude_event_id)
          AND (
            (p_start_time >= te.start_time AND p_start_time < te.end_time)
            OR (p_end_time > te.start_time AND p_end_time <= te.end_time)
            OR (p_start_time <= te.start_time AND p_end_time >= te.end_time)
          )
      );
    END;
    $fn$;
  END IF;
END $$;


-- Fix update_updated_at_column trigger function (always safe to create)
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- Fix handle_new_user function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
    CREATE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      INSERT INTO public.users (id, email, name, avatar_url)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        updated_at = NOW();
      
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;


-- ============================================
-- PART 3: Add your admin email to admin_users
-- Replace with your actual email!
-- ============================================
INSERT INTO admin_users (email) 
VALUES ('24dce091@charusat.edu.in')
ON CONFLICT (email) DO NOTHING;


-- ============================================
-- VERIFICATION QUERIES (run separately to check)
-- ============================================
-- Check RLS status:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check admin_users:
-- SELECT * FROM admin_users;

-- Check policies:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
