-- Migration: Add semester_id to period_templates for semester-scoped templates
-- Run this in your Supabase SQL Editor
-- 
-- Period templates are now scoped to a specific semester.
-- Example: A template created in "CE Sem 1" only applies to that semester
-- Import feature allows copying templates from other semesters

-- Add semester_id column (nullable to allow legacy/global templates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'period_templates' AND column_name = 'semester_id'
  ) THEN
    ALTER TABLE period_templates ADD COLUMN semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added semester_id column to period_templates';
  ELSE
    RAISE NOTICE 'semester_id column already exists in period_templates';
  END IF;
END $$;

-- Create index for faster semester lookups
CREATE INDEX IF NOT EXISTS idx_period_templates_semester_id ON period_templates(semester_id);

-- Add comment for documentation
COMMENT ON COLUMN period_templates.semester_id IS 'Links template to a specific semester. Templates are scoped per semester.';

-- Success message
SELECT 'Migration complete: period_templates now scoped to semesters' AS result;
