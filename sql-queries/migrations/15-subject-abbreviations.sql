-- Migration 15: Add abbreviation column to subjects table for OCR integration
-- This column is used by hajri-ocr to match subject names during attendance extraction

-- Add abbreviation column
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS abbreviation TEXT;

-- Add comment explaining the column purpose
COMMENT ON COLUMN subjects.abbreviation IS 'Short name for OCR matching (e.g., "EM-I" for "Engineering Mathematics I")';

-- Update existing subjects with auto-generated abbreviations based on common patterns
-- This is a best-effort migration - admins should review and update these values

-- Pattern: Take first letter of each word (up to 4 words), uppercase
-- For now, just set NULL - admins will fill in manually or via admin panel

-- Create index for faster OCR lookups
CREATE INDEX IF NOT EXISTS idx_subjects_abbreviation ON subjects(abbreviation) WHERE abbreviation IS NOT NULL;

-- Update RLS policy to include the new column (already covered by existing policies)

-- ============================================
-- USAGE NOTES:
-- ============================================
-- After running this migration:
-- 1. Go to Admin Panel → Subjects
-- 2. Edit each subject to add abbreviation (e.g., "CCP", "EM-I", "DAA")
-- 3. The OCR system will automatically sync from database
-- 
-- Example abbreviations:
-- | Code     | Name                                    | Abbreviation |
-- |----------|----------------------------------------|--------------|
-- | MSUD101  | Engineering Mathematics I               | EM-I         |
-- | CEUC101  | Computer Concepts and Programming       | CCP          |
-- | ITUE204  | Design and Analysis of Algorithms       | DAA          |
