-- Remove old constraint that only checks (semester_id, code)
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_semester_id_code_key;

-- Add new constraint that checks (semester_id, code, type)
ALTER TABLE public.subjects ADD CONSTRAINT subjects_semester_id_code_type_key UNIQUE (semester_id, code, type);
