# Add Name Columns Migration Guide

## What This Migration Does

Adds `name` columns to `classes` and `batches` tables to support auto-generated naming:
- Classes: `{semester_no}{branch_abbr}{class_no}` (e.g., `3CSE1`)
- Batches: `{semester_no}{branch_abbr}{class_no}-{batch_char}` (e.g., `3CSE1-A`)

## How to Run

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `migrations/add_name_columns_to_classes_and_batches.sql`
5. Click **Run** or press `Ctrl+Enter`

### Option 2: Supabase CLI
```bash
supabase db push migrations/add_name_columns_to_classes_and_batches.sql
```

## What the Migration Does

1. **Adds `name` column to `classes` table**
   - Checks if column already exists (safe to run multiple times)
   - Generates names for existing classes using the pattern: `{semester_no}{branch_abbr}{class_no}`

2. **Adds `name` column to `batches` table**
   - Checks if column already exists (safe to run multiple times)
   - Generates names for existing batches using the pattern: `{semester_no}{branch_abbr}{class_no}-{batch_char}`

3. **Shows verification results**
   - Counts how many classes and batches have names
   - Shows sample records with generated names

## After Migration

Once the migration is complete:
- ✅ Existing classes and batches will have auto-generated names
- ✅ New classes and batches will automatically get proper names
- ✅ Names will appear in:
  - Scope Bar (top navigation breadcrumb)
  - Tree Explorer (left sidebar)
  - All dropdown selectors
  - Throughout the entire application

## Example Output

After migration, you'll see names like:
- Classes: `1CE1`, `1CE2`, `2CSE1`, `3IT1`
- Batches: `1CE1-A`, `1CE1-B`, `2CSE1-A`, `3IT1-B`

These names follow the pattern:
- `{semester_number}` = Semester (1-8)
- `{branch_abbreviation}` = Branch code (CE, CSE, IT, etc.)
- `{class_number}` = Class within that semester (1, 2, 3, etc.)
- `-{batch_letter}` = Batch section (A, B, C, etc.)

## Verification

After running the migration, you can verify:

```sql
-- Check classes with names
SELECT id, class_number, name FROM classes LIMIT 10;

-- Check batches with names
SELECT id, batch_letter, name FROM batches LIMIT 10;

-- Count records with names
SELECT 'Classes with names' as info, COUNT(*) FROM classes WHERE name IS NOT NULL
UNION ALL
SELECT 'Batches with names' as info, COUNT(*) FROM batches WHERE name IS NOT NULL;
```

## Important Notes

- ✅ **Safe to run multiple times** - The migration checks if columns exist first
- ✅ **Backwards compatible** - The app works even if migration hasn't run yet
- ✅ **Automatic population** - Existing records get names automatically
- ✅ **No data loss** - Only adds columns, doesn't modify existing data
