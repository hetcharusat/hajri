-- Migration 15a: Populate abbreviations from existing course_config.json data
-- Run this AFTER migration 15 to bulk-update existing subjects

-- First ensure the column exists
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS abbreviation TEXT;

-- Update abbreviations based on subject codes
UPDATE subjects SET abbreviation = 'CCP' WHERE code = 'CEUC101' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'FSE' WHERE code = 'CEUC201' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'COA' WHERE code = 'CEUC202' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'SGP' WHERE code = 'CEUP201' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'HVE' WHERE code = 'HSUV202' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'PES' WHERE code = 'CUUV102' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'BEEE' WHERE code = 'EEUD101' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'CE' WHERE code = 'HSUA101' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'ICT' WHERE code = 'ITUS101' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'FDMS' WHERE code = 'ITUC202' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'DAA' WHERE code = 'ITUE204' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'FIS' WHERE code = 'ITUE205' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'EM-I' WHERE code = 'MSUD101' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'EP-I' WHERE code = 'PSUD101' AND abbreviation IS NULL;
UPDATE subjects SET abbreviation = 'FDSA' WHERE code = 'CEUC203' AND abbreviation IS NULL;

-- Verify the update
SELECT code, name, abbreviation FROM subjects WHERE abbreviation IS NOT NULL ORDER BY code;
