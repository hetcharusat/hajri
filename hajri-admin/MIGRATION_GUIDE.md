# Migration Instructions

## Add `slots` column to `period_templates` table

The application now stores period definitions in a `slots` JSONB column instead of a separate `periods` table.

### Option 1: Run Migration Script (Recommended)

Connect to your Supabase database and run:

```sql
-- Run the migration script
\i migrations/add_slots_to_period_templates.sql
```

Or execute the SQL directly in the Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `migrations/add_slots_to_period_templates.sql`
4. Click "Run"

### Option 2: Manual Steps

If you prefer to run the steps manually:

```sql
-- 1. Add the slots column
ALTER TABLE period_templates ADD COLUMN IF NOT EXISTS slots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. If you have existing data in a periods table, migrate it
-- (The migration script includes automatic migration logic)
```

### What This Does

1. **Adds `slots` column**: Creates a JSONB column to store period definitions directly in the template
2. **Migrates existing data**: If you have a `periods` table, it will automatically migrate the data into the corresponding template's `slots` array
3. **Sets default**: New templates will have an empty array `[]` by default

### Verify Migration

After running the migration, verify it worked:

```sql
-- Check the column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'period_templates' AND column_name = 'slots';

-- Check existing templates
SELECT id, name, jsonb_array_length(slots) as period_count, is_active
FROM period_templates;
```

### Schema Alignment

This migration aligns the database with `CLEAN-SCHEMA.sql` which defines:

```sql
CREATE TABLE period_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slots JSONB NOT NULL,  -- <-- This column
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Next Steps

After the migration:
1. The Period Templates page will work correctly
2. The Timetable editor will load periods from `period_templates.slots`
3. You can safely drop the old `periods` table if you have one (after verifying data migration)
