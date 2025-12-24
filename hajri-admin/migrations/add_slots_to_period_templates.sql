-- Migration: Add slots column to period_templates table
-- This migration adds the slots JSONB column to store period definitions
-- and migrates existing periods data if available

-- Add slots column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'period_templates' AND column_name = 'slots'
  ) THEN
    ALTER TABLE period_templates ADD COLUMN slots JSONB NOT NULL DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Added slots column to period_templates';
  ELSE
    RAISE NOTICE 'slots column already exists in period_templates';
  END IF;
END $$;

-- If there's a periods table, migrate its data into period_templates.slots
DO $$
DECLARE
  template_record RECORD;
  periods_data JSONB;
BEGIN
  -- Check if periods table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'periods'
  ) THEN
    RAISE NOTICE 'Found periods table, migrating data...';
    
    -- For each template, gather its periods and store as JSONB array
    FOR template_record IN 
      SELECT DISTINCT template_id FROM periods WHERE template_id IS NOT NULL
    LOOP
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id::text,
          'period_number', period_number,
          'name', name,
          'start_time', start_time::text,
          'end_time', end_time::text,
          'is_break', COALESCE(is_break, false)
        ) ORDER BY period_number
      ) INTO periods_data
      FROM periods
      WHERE template_id = template_record.template_id;
      
      -- Update the template with its periods
      UPDATE period_templates 
      SET slots = COALESCE(periods_data, '[]'::jsonb)
      WHERE id = template_record.template_id;
      
      RAISE NOTICE 'Migrated % periods for template %', 
        jsonb_array_length(COALESCE(periods_data, '[]'::jsonb)), 
        template_record.template_id;
    END LOOP;
    
    RAISE NOTICE 'Migration from periods table completed';
  ELSE
    RAISE NOTICE 'No periods table found, skipping data migration';
  END IF;
END $$;
