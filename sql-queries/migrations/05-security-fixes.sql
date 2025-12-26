-- ============================================
-- SECURITY FIXES MIGRATION
-- Created: 2025-12-26
-- Purpose: Enable RLS on missing tables and fix function search paths
-- ============================================

-- ============================================
-- PART 1: Enable RLS on tables missing it
-- ============================================

-- semester_faculty
ALTER TABLE semester_faculty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read semester_faculty"
ON semester_faculty FOR SELECT
USING (true);

CREATE POLICY "Admins insert semester_faculty"
ON semester_faculty FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update semester_faculty"
ON semester_faculty FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete semester_faculty"
ON semester_faculty FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- subject_components
ALTER TABLE subject_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read subject_components"
ON subject_components FOR SELECT
USING (true);

CREATE POLICY "Admins insert subject_components"
ON subject_components FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update subject_components"
ON subject_components FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete subject_components"
ON subject_components FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- offering_teachers
ALTER TABLE offering_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read offering_teachers"
ON offering_teachers FOR SELECT
USING (true);

CREATE POLICY "Admins insert offering_teachers"
ON offering_teachers FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update offering_teachers"
ON offering_teachers FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete offering_teachers"
ON offering_teachers FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- event_batches
ALTER TABLE event_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event_batches"
ON event_batches FOR SELECT
USING (true);

CREATE POLICY "Admins insert event_batches"
ON event_batches FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update event_batches"
ON event_batches FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete event_batches"
ON event_batches FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- event_rooms
ALTER TABLE event_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event_rooms"
ON event_rooms FOR SELECT
USING (true);

CREATE POLICY "Admins insert event_rooms"
ON event_rooms FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update event_rooms"
ON event_rooms FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete event_rooms"
ON event_rooms FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- faculty_constraints
ALTER TABLE faculty_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read faculty_constraints"
ON faculty_constraints FOR SELECT
USING (true);

CREATE POLICY "Admins insert faculty_constraints"
ON faculty_constraints FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update faculty_constraints"
ON faculty_constraints FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete faculty_constraints"
ON faculty_constraints FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- batch_groups
ALTER TABLE batch_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read batch_groups"
ON batch_groups FOR SELECT
USING (true);

CREATE POLICY "Admins insert batch_groups"
ON batch_groups FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update batch_groups"
ON batch_groups FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete batch_groups"
ON batch_groups FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- batch_group_members
ALTER TABLE batch_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read batch_group_members"
ON batch_group_members FOR SELECT
USING (true);

CREATE POLICY "Admins insert batch_group_members"
ON batch_group_members FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins update batch_group_members"
ON batch_group_members FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')))
WITH CHECK (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));

CREATE POLICY "Admins delete batch_group_members"
ON batch_group_members FOR DELETE
USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.email = (auth.jwt() ->> 'email')));


-- ============================================
-- PART 2: Fix function search paths
-- These functions need to have search_path set to prevent security issues
-- ============================================

-- Fix get_current_lecture function
CREATE OR REPLACE FUNCTION public.get_current_lecture(p_batch_id UUID)
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
AS $$
DECLARE
  v_day_of_week INT;
  v_current_time TIME;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM CURRENT_DATE)::INT;
  v_current_time := CURRENT_TIME;
  
  -- Return empty if Sunday (0) - typically no classes
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
$$;


-- Fix cleanup_old_drafts function
CREATE OR REPLACE FUNCTION public.cleanup_old_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- Fix find_orphaned_offerings function
CREATE OR REPLACE FUNCTION public.find_orphaned_offerings()
RETURNS TABLE (
  offering_id UUID,
  subject_code TEXT,
  batch_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- Fix is_teaching_day function
CREATE OR REPLACE FUNCTION public.is_teaching_day(check_date DATE, p_academic_year_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_of_week INT;
  v_academic_year_id UUID;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM check_date)::INT;
  
  -- Sunday is never a teaching day
  IF v_day_of_week = 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Get academic year if not provided
  IF p_academic_year_id IS NULL THEN
    SELECT id INTO v_academic_year_id FROM academic_years WHERE is_current = TRUE LIMIT 1;
  ELSE
    v_academic_year_id := p_academic_year_id;
  END IF;
  
  -- Check if it's a weekly off day
  IF EXISTS (
    SELECT 1 FROM weekly_off_days 
    WHERE academic_year_id = v_academic_year_id 
      AND day_of_week = v_day_of_week 
      AND is_off = TRUE
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if it's a holiday
  IF EXISTS (
    SELECT 1 FROM calendar_events 
    WHERE academic_year_id = v_academic_year_id 
      AND check_date BETWEEN event_date AND COALESCE(end_date, event_date)
      AND is_non_teaching = TRUE
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if it's during vacation
  IF EXISTS (
    SELECT 1 FROM vacation_periods 
    WHERE academic_year_id = v_academic_year_id 
      AND check_date BETWEEN start_date AND end_date
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if it's during exams
  IF EXISTS (
    SELECT 1 FROM exam_periods 
    WHERE academic_year_id = v_academic_year_id 
      AND check_date BETWEEN start_date AND end_date
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;


-- Fix count_teaching_days function
CREATE OR REPLACE FUNCTION public.count_teaching_days(start_date DATE, end_date DATE, p_academic_year_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  teaching_count INTEGER := 0;
  check_date DATE;
BEGIN
  check_date := start_date;
  
  WHILE check_date <= end_date LOOP
    IF is_teaching_day(check_date, p_academic_year_id) THEN
      teaching_count := teaching_count + 1;
    END IF;
    check_date := check_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN teaching_count;
END;
$$;


-- Fix check_room_conflict function
CREATE OR REPLACE FUNCTION public.check_room_conflict(
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
AS $$
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
$$;


-- Fix check_faculty_conflict function
CREATE OR REPLACE FUNCTION public.check_faculty_conflict(
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
AS $$
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
$$;


-- Fix update_updated_at_column trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;


-- ============================================
-- PART 3: Note about Security Definer Views
-- ============================================
-- The following views are intentionally SECURITY DEFINER for admin use:
-- - batch_subjects
-- - active_period_schedule  
-- - v_non_teaching_dates
-- - offerings_complete
-- - events_complete
-- - current_timetables
-- 
-- These views are used by the admin panel to bypass RLS and show
-- aggregated data. This is the intended behavior for an admin application.
-- No changes needed for these views.


-- ============================================
-- VERIFICATION QUERY
-- Run this after to verify all tables have RLS enabled:
-- ============================================
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;
