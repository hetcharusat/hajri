-- Migration: Add name columns to classes and batches tables
-- This enables auto-generated naming: {semester_no}{branch_abbr}{class_no} and {semester_no}{branch_abbr}{class_no}-{batch_char}

-- Add name column to classes table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'classes' AND column_name = 'name'
    ) THEN
        ALTER TABLE classes ADD COLUMN name TEXT;
        
        -- Generate names for existing classes
        UPDATE classes c
        SET name = CONCAT(
            s.semester_number,
            b.abbreviation,
            c.class_number
        )
        FROM semesters s
        JOIN branches b ON s.branch_id = b.id
        WHERE c.semester_id = s.id;
        
        RAISE NOTICE 'Added name column to classes and populated existing records';
    ELSE
        RAISE NOTICE 'Column name already exists in classes table';
    END IF;
END $$;

-- Add name column to batches table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'batches' AND column_name = 'name'
    ) THEN
        ALTER TABLE batches ADD COLUMN name TEXT;
        
        -- Generate names for existing batches
        UPDATE batches b
        SET name = CONCAT(
            s.semester_number,
            br.abbreviation,
            c.class_number,
            '-',
            b.batch_letter
        )
        FROM classes c
        JOIN semesters s ON c.semester_id = s.id
        JOIN branches br ON s.branch_id = br.id
        WHERE b.class_id = c.id;
        
        RAISE NOTICE 'Added name column to batches and populated existing records';
    ELSE
        RAISE NOTICE 'Column name already exists in batches table';
    END IF;
END $$;

-- Verification queries
SELECT 'Classes with names:' as info, COUNT(*) as count FROM classes WHERE name IS NOT NULL;
SELECT 'Batches with names:' as info, COUNT(*) as count FROM batches WHERE name IS NOT NULL;

-- Sample output
SELECT 'Sample Classes:' as info;
SELECT id, class_number, name FROM classes LIMIT 5;

SELECT 'Sample Batches:' as info;
SELECT id, batch_letter, name FROM batches LIMIT 5;
