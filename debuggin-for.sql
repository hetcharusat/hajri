-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.academic_calendar (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  payload jsonb NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT academic_calendar_pkey PRIMARY KEY (id)
);
CREATE TABLE public.academic_years (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  institution text DEFAULT 'CHARUSAT'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT academic_years_pkey PRIMARY KEY (id)
);
CREATE TABLE public.admin_users (
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (email)
);
CREATE TABLE public.app_users (
  id uuid NOT NULL,
  student_id uuid,
  current_batch_id uuid,
  current_semester_id uuid,
  preferences jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_users_pkey PRIMARY KEY (id),
  CONSTRAINT app_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT app_users_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT app_users_current_batch_id_fkey FOREIGN KEY (current_batch_id) REFERENCES public.batches(id),
  CONSTRAINT app_users_current_semester_id_fkey FOREIGN KEY (current_semester_id) REFERENCES public.semesters(id)
);
CREATE TABLE public.attendance_predictions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  current_present integer NOT NULL DEFAULT 0,
  current_total integer NOT NULL DEFAULT 0,
  current_percentage numeric DEFAULT 0.00,
  required_percentage numeric DEFAULT 75.00,
  remaining_classes integer NOT NULL DEFAULT 0,
  semester_end_date date,
  must_attend integer NOT NULL DEFAULT 0,
  can_bunk integer NOT NULL DEFAULT 0,
  status text CHECK (status = ANY (ARRAY['SAFE'::text, 'WARNING'::text, 'DANGER'::text, 'CRITICAL'::text])),
  prediction_computed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_predictions_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_predictions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT attendance_predictions_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id),
  CONSTRAINT attendance_predictions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.attendance_summary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  semester_id uuid NOT NULL,
  class_type text NOT NULL CHECK (class_type = ANY (ARRAY['LECTURE'::text, 'LAB'::text, 'TUTORIAL'::text, 'ALL'::text])),
  snapshot_id uuid,
  snapshot_at timestamp with time zone,
  snapshot_present integer NOT NULL DEFAULT 0,
  snapshot_total integer NOT NULL DEFAULT 0,
  manual_present integer NOT NULL DEFAULT 0,
  manual_absent integer NOT NULL DEFAULT 0,
  manual_total integer NOT NULL DEFAULT 0,
  current_present integer NOT NULL DEFAULT 0,
  current_total integer NOT NULL DEFAULT 0,
  current_percentage numeric DEFAULT 0.00,
  last_recomputed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_summary_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_summary_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT attendance_summary_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT attendance_summary_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id),
  CONSTRAINT attendance_summary_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT attendance_summary_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.ocr_snapshots(id)
);
CREATE TABLE public.batch_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT batch_group_members_pkey PRIMARY KEY (id),
  CONSTRAINT batch_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.batch_groups(id),
  CONSTRAINT batch_group_members_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);
CREATE TABLE public.batch_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT batch_groups_pkey PRIMARY KEY (id),
  CONSTRAINT batch_groups_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  batch_letter text NOT NULL CHECK (batch_letter ~ '^[A-Z]$'::text),
  created_at timestamp with time zone DEFAULT now(),
  name text,
  CONSTRAINT batches_pkey PRIMARY KEY (id),
  CONSTRAINT batches_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text NOT NULL,
  department_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT branches_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid,
  event_date date NOT NULL,
  end_date date,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['holiday'::text, 'academic'::text, 'college_event'::text, 'exam'::text, 'vacation'::text])),
  title text NOT NULL,
  description text,
  is_non_teaching boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_events_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL,
  class_number integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  name text,
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id)
);
CREATE TABLE public.course_offerings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  faculty_id uuid,
  default_room_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  component_id uuid,
  CONSTRAINT course_offerings_pkey PRIMARY KEY (id),
  CONSTRAINT course_offerings_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT course_offerings_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id),
  CONSTRAINT course_offerings_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT course_offerings_default_room_id_fkey FOREIGN KEY (default_room_id) REFERENCES public.rooms(id),
  CONSTRAINT course_offerings_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.subject_components(id)
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.elective_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT elective_groups_pkey PRIMARY KEY (id),
  CONSTRAINT elective_groups_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id)
);
CREATE TABLE public.engine_computation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type = ANY (ARRAY['SNAPSHOT_CONFIRM'::text, 'MANUAL_ENTRY'::text, 'FORCE_RECOMPUTE'::text, 'CALENDAR_UPDATE'::text])),
  trigger_id uuid,
  status text NOT NULL CHECK (status = ANY (ARRAY['SUCCESS'::text, 'PARTIAL'::text, 'FAILED'::text])),
  subjects_updated integer DEFAULT 0,
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  duration_ms integer,
  error_message text,
  error_details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT engine_computation_log_pkey PRIMARY KEY (id),
  CONSTRAINT engine_computation_log_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.event_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_batches_pkey PRIMARY KEY (id),
  CONSTRAINT event_batches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.timetable_events(id),
  CONSTRAINT event_batches_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);
CREATE TABLE public.event_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  room_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT event_rooms_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.timetable_events(id),
  CONSTRAINT event_rooms_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id)
);
CREATE TABLE public.exam_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid,
  name text NOT NULL,
  exam_type text NOT NULL CHECK (exam_type = ANY (ARRAY['regular'::text, 'remedial'::text, 'supplementary'::text])),
  semester_type text NOT NULL CHECK (semester_type = ANY (ARRAY['odd'::text, 'even'::text])),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exam_periods_pkey PRIMARY KEY (id),
  CONSTRAINT exam_periods_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.faculty (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  department_id uuid,
  abbr text,
  CONSTRAINT faculty_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.faculty_constraints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL UNIQUE,
  max_hours_per_week integer,
  max_hours_per_day integer,
  unavailable_periods jsonb,
  preferred_periods jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT faculty_constraints_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_constraints_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id)
);
CREATE TABLE public.manual_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  event_date date NOT NULL,
  class_type text NOT NULL CHECK (class_type = ANY (ARRAY['LECTURE'::text, 'LAB'::text, 'TUTORIAL'::text])),
  period_slot integer,
  status text NOT NULL CHECK (status = ANY (ARRAY['PRESENT'::text, 'ABSENT'::text, 'CANCELLED'::text])),
  timetable_event_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT manual_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT manual_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT manual_attendance_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT manual_attendance_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.ocr_snapshots(id),
  CONSTRAINT manual_attendance_timetable_event_id_fkey FOREIGN KEY (timetable_event_id) REFERENCES public.timetable_events(id)
);
CREATE TABLE public.ocr_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  semester_id uuid NOT NULL,
  captured_at timestamp with time zone NOT NULL,
  confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
  source_type text DEFAULT 'university_portal'::text,
  entries jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ocr_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT ocr_snapshots_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT ocr_snapshots_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id),
  CONSTRAINT ocr_snapshots_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id)
);
CREATE TABLE public.offering_teachers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offering_id uuid NOT NULL,
  faculty_id uuid NOT NULL,
  role text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT offering_teachers_pkey PRIMARY KEY (id),
  CONSTRAINT offering_teachers_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT offering_teachers_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id)
);
CREATE TABLE public.period_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  branch_id uuid,
  semester_id uuid,
  CONSTRAINT period_templates_pkey PRIMARY KEY (id),
  CONSTRAINT period_templates_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT period_templates_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id)
);
CREATE TABLE public.periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  period_number integer NOT NULL,
  name text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  is_break boolean NOT NULL DEFAULT false,
  day_of_week integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT periods_pkey PRIMARY KEY (id),
  CONSTRAINT periods_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.period_templates(id)
);
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_number text NOT NULL UNIQUE,
  department_id uuid,
  capacity integer,
  type text DEFAULT 'CLASSROOM'::text CHECK (type = ANY (ARRAY['CLASSROOM'::text, 'LAB'::text, 'HALL'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.semester_faculty (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL,
  faculty_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT semester_faculty_pkey PRIMARY KEY (id),
  CONSTRAINT semester_faculty_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT semester_faculty_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id)
);
CREATE TABLE public.semester_subject_totals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  semester_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  class_type text NOT NULL CHECK (class_type = ANY (ARRAY['LECTURE'::text, 'LAB'::text, 'TUTORIAL'::text])),
  slots_per_week integer NOT NULL DEFAULT 0,
  total_classes_in_semester integer NOT NULL DEFAULT 0,
  calculation_details jsonb DEFAULT '{}'::jsonb,
  calculated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT semester_subject_totals_pkey PRIMARY KEY (id),
  CONSTRAINT semester_subject_totals_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id),
  CONSTRAINT semester_subject_totals_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT semester_subject_totals_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.semesters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  semester_number integer NOT NULL CHECK (semester_number >= 1 AND semester_number <= 8),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT semesters_pkey PRIMARY KEY (id),
  CONSTRAINT semesters_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.student_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  backup_data jsonb NOT NULL,
  backup_timestamp timestamp with time zone DEFAULT now(),
  device_info jsonb,
  CONSTRAINT student_backups_pkey PRIMARY KEY (id),
  CONSTRAINT student_backups_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.student_electives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  elective_group_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT student_electives_pkey PRIMARY KEY (id),
  CONSTRAINT student_electives_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_electives_elective_group_id_fkey FOREIGN KEY (elective_group_id) REFERENCES public.elective_groups(id),
  CONSTRAINT student_electives_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  roll_number text NOT NULL UNIQUE,
  name text NOT NULL,
  email text UNIQUE,
  batch_id uuid,
  enrollment_year integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);
CREATE TABLE public.subject_code_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ocr_code text NOT NULL,
  ocr_name text,
  subject_id uuid NOT NULL,
  batch_id uuid,
  semester_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subject_code_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT subject_code_mappings_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT subject_code_mappings_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id),
  CONSTRAINT subject_code_mappings_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT subject_code_mappings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.subject_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  component_type text NOT NULL CHECK (component_type = ANY (ARRAY['LECTURE'::text, 'LAB'::text, 'TUTORIAL'::text, 'PRACTICAL'::text, 'SEMINAR'::text])),
  default_duration_minutes integer NOT NULL DEFAULT 60,
  credits_portion numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subject_components_pkey PRIMARY KEY (id),
  CONSTRAINT subject_components_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  credits integer DEFAULT 3,
  type text DEFAULT 'LECTURE'::text CHECK (type = ANY (ARRAY['LECTURE'::text, 'LAB'::text, 'TUTORIAL'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_elective boolean DEFAULT false,
  elective_group_id uuid,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT subjects_elective_group_id_fkey FOREIGN KEY (elective_group_id) REFERENCES public.elective_groups(id)
);
CREATE TABLE public.teaching_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid,
  name text NOT NULL,
  semester_type text NOT NULL CHECK (semester_type = ANY (ARRAY['odd'::text, 'even'::text])),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teaching_periods_pkey PRIMARY KEY (id),
  CONSTRAINT teaching_periods_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.timetable_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid,
  faculty_id uuid,
  room_id uuid,
  batch_id uuid,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  version integer DEFAULT 1,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT timetable_entries_pkey PRIMARY KEY (id),
  CONSTRAINT timetable_entries_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT timetable_entries_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id),
  CONSTRAINT timetable_entries_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT timetable_entries_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);
CREATE TABLE public.timetable_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  room_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  period_id uuid,
  component_type text CHECK (component_type = ANY (ARRAY['LECTURE'::text, 'LAB'::text, 'TUTORIAL'::text, 'PRACTICAL'::text, 'SEMINAR'::text])),
  elective_group_id uuid,
  CONSTRAINT timetable_events_pkey PRIMARY KEY (id),
  CONSTRAINT timetable_events_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.timetable_versions(id),
  CONSTRAINT timetable_events_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id),
  CONSTRAINT timetable_events_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT timetable_events_elective_group_id_fkey FOREIGN KEY (elective_group_id) REFERENCES public.elective_groups(id),
  CONSTRAINT timetable_events_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id)
);
CREATE TABLE public.timetable_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::timetable_version_status,
  name text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT timetable_versions_pkey PRIMARY KEY (id),
  CONSTRAINT timetable_versions_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id),
  CONSTRAINT timetable_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.user_backups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  backup_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_backups_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  is_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.vacation_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  applies_to text DEFAULT 'all'::text CHECK (applies_to = ANY (ARRAY['all'::text, 'students'::text, 'employees'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vacation_periods_pkey PRIMARY KEY (id),
  CONSTRAINT vacation_periods_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.weekly_off_days (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year_id uuid,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_off boolean DEFAULT true,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  saturday_pattern text CHECK (saturday_pattern IS NULL OR (saturday_pattern = ANY (ARRAY['all'::text, '1st_3rd'::text, '2nd_4th'::text, 'none'::text, 'odd'::text, 'even'::text]))),
  CONSTRAINT weekly_off_days_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_off_days_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);