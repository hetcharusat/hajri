-- Comprehensive Timetable System Redesign
-- Run this in Supabase SQL Editor after SUPABASE_SCHEMA_UPDATES.sql
-- This fixes the core design flaws for operational timetable management

-- ============================================================================
-- 1. SUBJECT COMPONENTS (Lecture/Lab/Tutorial split)
-- ============================================================================

create table if not exists public.subject_components (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  component_type text not null check (component_type in ('LECTURE', 'LAB', 'TUTORIAL', 'PRACTICAL', 'SEMINAR')),
  default_duration_minutes int not null default 60,
  credits_portion decimal(3,2), -- portion of total subject credits
  created_at timestamptz not null default now(),
  unique(subject_id, component_type)
);

create index if not exists subject_components_subject_id_idx on public.subject_components(subject_id);

comment on table public.subject_components is 'Splits subjects into teaching components (e.g., ITUC202 Lecture + ITUC202 Lab)';

-- ============================================================================
-- 2. PERIOD TEMPLATES (Institution-wide scheduling framework)
-- ============================================================================

-- Drop old slots column if it exists (from previous schema)
alter table if exists public.period_templates drop column if exists slots;

create table if not exists public.period_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.period_templates(id) on delete cascade,
  period_number int not null,
  name text not null, -- "Period 1", "Lunch Break", etc.
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  day_of_week int, -- null means applies to all days, or 0-6 for specific day
  created_at timestamptz not null default now(),
  unique(template_id, period_number, day_of_week)
);

create index if not exists periods_template_id_idx on public.periods(template_id);

comment on table public.period_templates is 'Defines institutional scheduling framework (e.g., 6 periods + breaks)';
comment on table public.periods is 'Individual period definitions with timing (e.g., Period 1: 09:10-10:10)';

-- ============================================================================
-- 3. ENHANCED COURSE OFFERINGS (Component-based + Many-to-Many Teachers)
-- ============================================================================

-- Add component reference to offerings
alter table public.course_offerings
  add column if not exists component_id uuid references public.subject_components(id) on delete set null;

create index if not exists course_offerings_component_id_idx on public.course_offerings(component_id);

-- Many-to-many: offering <-> teachers (supports co-teaching, assistants)
create table if not exists public.offering_teachers (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  faculty_id uuid not null references public.faculty(id) on delete cascade,
  role text, -- 'PRIMARY', 'ASSISTANT', 'CO_TEACHER'
  created_at timestamptz not null default now(),
  unique(offering_id, faculty_id)
);

create index if not exists offering_teachers_offering_id_idx on public.offering_teachers(offering_id);
create index if not exists offering_teachers_faculty_id_idx on public.offering_teachers(faculty_id);

comment on table public.offering_teachers is 'Many-to-many teacher assignments (supports co-teaching and batch-specific teachers)';

-- ============================================================================
-- 4. ENHANCED TIMETABLE EVENTS (Period-based + Batch Groups + Multi-Room)
-- ============================================================================

-- Replace time-based scheduling with period reference
alter table public.timetable_events
  add column if not exists period_id uuid references public.periods(id) on delete set null;

create index if not exists timetable_events_period_id_idx on public.timetable_events(period_id);

-- Add component type to events for filtering/validation
alter table public.timetable_events
  add column if not exists component_type text check (component_type in ('LECTURE', 'LAB', 'TUTORIAL', 'PRACTICAL', 'SEMINAR'));

-- Many-to-many: event <-> batches (supports combined classes and batch splits)
create table if not exists public.event_batches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.timetable_events(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(event_id, batch_id)
);

create index if not exists event_batches_event_id_idx on public.event_batches(event_id);
create index if not exists event_batches_batch_id_idx on public.event_batches(batch_id);

-- Many-to-many: event <-> rooms (supports parallel labs in multiple rooms)
create table if not exists public.event_rooms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.timetable_events(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(event_id, room_id)
);

create index if not exists event_rooms_event_id_idx on public.event_rooms(event_id);
create index if not exists event_rooms_room_id_idx on public.event_rooms(room_id);

comment on table public.event_batches is 'Supports batch grouping (A+B together) and combined classes (all batches)';
comment on table public.event_rooms is 'Supports parallel sessions in multiple rooms (e.g., labs split across 3 rooms)';

-- ============================================================================
-- 5. FACULTY WORKLOAD & CONSTRAINTS
-- ============================================================================

create table if not exists public.faculty_constraints (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculty(id) on delete cascade,
  max_hours_per_week int,
  max_hours_per_day int,
  unavailable_periods jsonb, -- [{day: 0, period_id: "uuid"}, ...]
  preferred_periods jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(faculty_id)
);

create index if not exists faculty_constraints_faculty_id_idx on public.faculty_constraints(faculty_id);

comment on table public.faculty_constraints is 'Faculty workload limits and availability constraints';

-- ============================================================================
-- 6. BATCH GROUPING (for combined sessions)
-- ============================================================================

create table if not exists public.batch_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- "A+B Combined", "Lab Group 1", etc.
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.batch_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.batch_groups(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(group_id, batch_id)
);

create index if not exists batch_group_members_group_id_idx on public.batch_group_members(group_id);
create index if not exists batch_group_members_batch_id_idx on public.batch_group_members(batch_id);

comment on table public.batch_groups is 'Pre-defined batch combinations for scheduling (e.g., A+B for lectures, A only for labs)';

-- ============================================================================
-- 7. DATA MIGRATION HELPERS
-- ============================================================================

-- Migrate existing offerings: if faculty_id exists, create offering_teachers entry
insert into public.offering_teachers (offering_id, faculty_id, role)
select id, faculty_id, 'PRIMARY'
from public.course_offerings
where faculty_id is not null
on conflict (offering_id, faculty_id) do nothing;

-- Create default lecture component for existing subjects (where no components exist)
insert into public.subject_components (subject_id, component_type, default_duration_minutes)
select s.id, 'LECTURE', 60
from public.subjects s
where not exists (
  select 1 from public.subject_components sc where sc.subject_id = s.id
)
on conflict (subject_id, component_type) do nothing;

-- Link existing offerings to default lecture component
update public.course_offerings o
set component_id = (
  select sc.id 
  from public.subject_components sc 
  where sc.subject_id = o.subject_id 
    and sc.component_type = 'LECTURE'
  limit 1
)
where o.component_id is null and o.subject_id is not null;

-- ============================================================================
-- 8. HELPER VIEWS
-- ============================================================================

-- View: Complete offering information (with all teachers)
create or replace view public.offerings_complete as
select 
  o.id,
  o.batch_id,
  o.subject_id,
  o.component_id,
  sc.component_type,
  sc.default_duration_minutes,
  s.code as subject_code,
  s.name as subject_name,
  s.credits as subject_credits,
  o.default_room_id,
  array_agg(distinct f.id) filter (where f.id is not null) as faculty_ids,
  array_agg(distinct f.name) filter (where f.name is not null) as faculty_names,
  o.created_at
from public.course_offerings o
left join public.subjects s on o.subject_id = s.id
left join public.subject_components sc on o.component_id = sc.id
left join public.offering_teachers ot on o.id = ot.offering_id
left join public.faculty f on ot.faculty_id = f.id
group by o.id, o.batch_id, o.subject_id, o.component_id, 
         sc.component_type, sc.default_duration_minutes,
         s.code, s.name, s.credits, o.default_room_id, o.created_at;

-- View: Complete event information (with all batches and rooms)
create or replace view public.events_complete as
select 
  e.id,
  e.version_id,
  e.offering_id,
  e.period_id,
  e.day_of_week,
  e.component_type,
  p.period_number,
  p.name as period_name,
  p.start_time,
  p.end_time,
  p.is_break,
  array_agg(distinct b.id) filter (where b.id is not null) as batch_ids,
  array_agg(distinct b.batch_letter) filter (where b.batch_letter is not null) as batch_letters,
  array_agg(distinct r.id) filter (where r.id is not null) as room_ids,
  array_agg(distinct r.room_number) filter (where r.room_number is not null) as room_numbers,
  e.created_at
from public.timetable_events e
left join public.periods p on e.period_id = p.id
left join public.event_batches eb on e.id = eb.event_id
left join public.batches b on eb.batch_id = b.id
left join public.event_rooms er on e.id = er.event_id
left join public.rooms r on er.room_id = r.id
group by e.id, e.version_id, e.offering_id, e.period_id, 
         e.day_of_week, e.component_type,
         p.period_number, p.name, p.start_time, p.end_time, p.is_break,
         e.created_at;

-- ============================================================================
-- 9. VALIDATION FUNCTIONS
-- ============================================================================

-- Check if faculty is double-booked
create or replace function check_faculty_conflict(
  p_version_id uuid,
  p_faculty_id uuid,
  p_period_id uuid,
  p_day_of_week int,
  p_exclude_event_id uuid default null
) returns table(conflict_event_id uuid, conflict_subject_code text) as $$
  select distinct e.id, s.code
  from timetable_events e
  join course_offerings o on e.offering_id = o.id
  join subjects s on o.subject_id = s.id
  join offering_teachers ot on o.id = ot.offering_id
  where e.version_id = p_version_id
    and e.period_id = p_period_id
    and e.day_of_week = p_day_of_week
    and ot.faculty_id = p_faculty_id
    and (p_exclude_event_id is null or e.id != p_exclude_event_id);
$$ language sql stable;

-- Check if room is double-booked
create or replace function check_room_conflict(
  p_version_id uuid,
  p_room_id uuid,
  p_period_id uuid,
  p_day_of_week int,
  p_exclude_event_id uuid default null
) returns table(conflict_event_id uuid, conflict_subject_code text) as $$
  select distinct e.id, s.code
  from timetable_events e
  join event_rooms er on e.id = er.event_id
  join course_offerings o on e.offering_id = o.id
  join subjects s on o.subject_id = s.id
  where e.version_id = p_version_id
    and e.period_id = p_period_id
    and e.day_of_week = p_day_of_week
    and er.room_id = p_room_id
    and (p_exclude_event_id is null or e.id != p_exclude_event_id);
$$ language sql stable;

-- ============================================================================
-- 10. DEFAULT PERIOD TEMPLATE (Example: Standard 6-period day)
-- ============================================================================

do $$
declare
  template_id uuid;
begin
  -- Create default template if none exists
  if not exists (select 1 from period_templates where is_active = true) then
    insert into period_templates (name, description, is_active)
    values ('Standard 6-Period Day', 'Default institutional schedule with 6 periods and breaks', true)
    returning id into template_id;
    
    -- Insert standard periods
    insert into periods (template_id, period_number, name, start_time, end_time, is_break) values
    (template_id, 1, 'Period 1', '09:10:00', '10:10:00', false),
    (template_id, 2, 'Period 2', '10:10:00', '11:10:00', false),
    (template_id, 99, 'Recess', '11:10:00', '12:10:00', true),
    (template_id, 3, 'Period 3', '12:10:00', '01:10:00', false),
    (template_id, 4, 'Period 4', '01:10:00', '02:10:00', false),
    (template_id, 98, 'Lunch Break', '02:10:00', '02:20:00', true),
    (template_id, 5, 'Period 5', '02:20:00', '03:20:00', false),
    (template_id, 6, 'Period 6', '03:20:00', '04:20:00', false);
  end if;
end $$;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- After running this migration:
-- 1. Update frontend to use new component-based offerings
-- 2. Add period template management UI
-- 3. Update timetable editor to support batch grouping
-- 4. Add conflict validation before saving events
-- 5. Build faculty workload dashboard
-- 6. Add printable timetable view (like the institutional format)
