-- Run this in Supabase SQL Editor (Database -> SQL Editor).
-- This adds:
-- 1) faculty.department_id (optional FK to departments)
-- 2) faculty.abbr (short code)
-- 3) semester_faculty link table (explicit faculty <-> semester mapping)
-- 4) Ensures room/offering linking columns exist (best-effort)

-- 1) Faculty: department_id + abbr
alter table public.faculty
  add column if not exists department_id uuid;

alter table public.faculty
  add column if not exists abbr text;

-- Add FK only if it doesn't already exist
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'faculty_department_id_fkey'
  ) then
    alter table public.faculty
      add constraint faculty_department_id_fkey
      foreign key (department_id) references public.departments(id)
      on delete set null;
  end if;
end $$;

create index if not exists faculty_department_id_idx on public.faculty(department_id);

-- 2) Semester <-> Faculty link
create table if not exists public.semester_faculty (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null,
  faculty_id uuid not null,
  created_at timestamptz not null default now(),
  unique (semester_id, faculty_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'semester_faculty_semester_id_fkey') then
    alter table public.semester_faculty
      add constraint semester_faculty_semester_id_fkey
      foreign key (semester_id) references public.semesters(id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'semester_faculty_faculty_id_fkey') then
    alter table public.semester_faculty
      add constraint semester_faculty_faculty_id_fkey
      foreign key (faculty_id) references public.faculty(id)
      on delete cascade;
  end if;
end $$;

create index if not exists semester_faculty_semester_id_idx on public.semester_faculty(semester_id);
create index if not exists semester_faculty_faculty_id_idx on public.semester_faculty(faculty_id);

-- 3) Rooms / offerings / timetable room linking (best-effort)
-- If these columns already exist, these statements are no-ops.

alter table public.course_offerings
  add column if not exists default_room_id uuid;

-- Ensure a unique key exists so the app can upsert by (batch_id, subject_id)
create unique index if not exists course_offerings_batch_subject_uniq
  on public.course_offerings(batch_id, subject_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'course_offerings_default_room_id_fkey') then
    alter table public.course_offerings
      add constraint course_offerings_default_room_id_fkey
      foreign key (default_room_id) references public.rooms(id)
      on delete set null;
  end if;
end $$;

alter table public.timetable_events
  add column if not exists room_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'timetable_events_room_id_fkey') then
    alter table public.timetable_events
      add constraint timetable_events_room_id_fkey
      foreign key (room_id) references public.rooms(id)
      on delete set null;
  end if;
end $$;

-- Optional: if you want rooms scoped by department in UI
-- alter table public.rooms add column if not exists department_id uuid;
-- do $$
-- begin
--   if not exists (select 1 from pg_constraint where conname = 'rooms_department_id_fkey') then
--     alter table public.rooms
--       add constraint rooms_department_id_fkey
--       foreign key (department_id) references public.departments(id)
--       on delete set null;
--   end if;
-- end $$;
-- create index if not exists rooms_department_id_idx on public.rooms(department_id);

-- Optional: if you are removing these columns entirely from rooms
-- (the UI has been updated to not use them)
-- alter table public.rooms drop column if exists building;
-- alter table public.rooms drop column if exists capacity;

-- NOTE: This file does NOT create RLS policies.
-- If you have RLS enabled, add policies for semester_faculty and for new columns as needed.
