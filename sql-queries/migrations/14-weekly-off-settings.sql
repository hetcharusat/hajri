-- ============================================
-- SATURDAY PATTERN ENHANCEMENT
-- Add saturday_pattern column to existing weekly_off_days table
-- ============================================

-- Add saturday_pattern column to weekly_off_days table
-- This allows for "1st and 3rd Saturday off" type patterns
ALTER TABLE weekly_off_days 
ADD COLUMN IF NOT EXISTS saturday_pattern TEXT DEFAULT NULL 
CHECK (saturday_pattern IS NULL OR saturday_pattern IN ('all', '1st_3rd', '2nd_4th', 'none', 'odd', 'even'));

-- Add comment explaining the column
COMMENT ON COLUMN weekly_off_days.saturday_pattern IS 
'Saturday off pattern (only for day_of_week=6):
- NULL: Use is_off value (backwards compatible)
- all: Every Saturday off
- 1st_3rd: 1st and 3rd Saturday of month off (2nd, 4th, 5th working)
- 2nd_4th: 2nd and 4th Saturday of month off (1st, 3rd, 5th working)
- odd: 1st, 3rd, 5th Saturdays off
- even: 2nd, 4th Saturdays off
- none: No Saturdays off (all working)';

-- Update existing Saturday entries to use the new pattern column
-- If is_off=true, set pattern to 'all'; if is_off=false, set pattern to 'none'
UPDATE weekly_off_days 
SET saturday_pattern = CASE 
    WHEN is_off = true THEN 'all'
    WHEN is_off = false THEN 'none'
    ELSE 'all'
END
WHERE day_of_week = 6 AND saturday_pattern IS NULL;

-- ============================================
-- HELPER FUNCTION: Check if a date is a weekly off day
-- ============================================
CREATE OR REPLACE FUNCTION is_weekly_off(
  check_date DATE,
  p_academic_year_id UUID,
  p_batch_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  settings RECORD;
  day_of_week_num INT;
  saturday_num INT;
  first_day_of_month DATE;
  first_saturday DATE;
  sat_pattern TEXT;
BEGIN
  -- Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  day_of_week_num := EXTRACT(DOW FROM check_date)::INT;
  
  -- Look up weekly off setting for this day
  SELECT * INTO settings
  FROM weekly_off_days
  WHERE academic_year_id = p_academic_year_id
    AND day_of_week = day_of_week_num
  LIMIT 1;
  
  -- If no settings found, default: Sunday=off, Saturday=off, weekdays=working
  IF settings IS NULL THEN
    RETURN day_of_week_num IN (0, 6);  -- Sunday=0, Saturday=6
  END IF;
  
  -- For non-Saturday days, just check is_off
  IF day_of_week_num != 6 THEN
    RETURN settings.is_off;
  END IF;
  
  -- For Saturday, check the pattern
  sat_pattern := COALESCE(settings.saturday_pattern, 
    CASE WHEN settings.is_off THEN 'all' ELSE 'none' END);
  
  CASE sat_pattern
    WHEN 'all' THEN RETURN true;
    WHEN 'none' THEN RETURN false;
    WHEN '1st_3rd' THEN
      -- Find which Saturday of the month this is
      first_day_of_month := DATE_TRUNC('month', check_date)::DATE;
      -- Find first Saturday of month
      first_saturday := first_day_of_month + 
        ((6 - EXTRACT(DOW FROM first_day_of_month)::INT + 7) % 7)::INT;
      saturday_num := ((check_date - first_saturday)::INT / 7) + 1;
      RETURN saturday_num IN (1, 3);
    WHEN '2nd_4th' THEN
      first_day_of_month := DATE_TRUNC('month', check_date)::DATE;
      first_saturday := first_day_of_month + 
        ((6 - EXTRACT(DOW FROM first_day_of_month)::INT + 7) % 7)::INT;
      saturday_num := ((check_date - first_saturday)::INT / 7) + 1;
      RETURN saturday_num IN (2, 4);
    WHEN 'odd' THEN
      first_day_of_month := DATE_TRUNC('month', check_date)::DATE;
      first_saturday := first_day_of_month + 
        ((6 - EXTRACT(DOW FROM first_day_of_month)::INT + 7) % 7)::INT;
      saturday_num := ((check_date - first_saturday)::INT / 7) + 1;
      RETURN saturday_num IN (1, 3, 5);
    WHEN 'even' THEN
      first_day_of_month := DATE_TRUNC('month', check_date)::DATE;
      first_saturday := first_day_of_month + 
        ((6 - EXTRACT(DOW FROM first_day_of_month)::INT + 7) % 7)::INT;
      saturday_num := ((check_date - first_saturday)::INT / 7) + 1;
      RETURN saturday_num IN (2, 4);
    ELSE RETURN settings.is_off;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Example: Set 2nd and 4th Saturday off for 2025-26
-- Uncomment to apply
-- ============================================
-- UPDATE weekly_off_days 
-- SET saturday_pattern = '2nd_4th'
-- WHERE academic_year_id = (SELECT id FROM academic_years WHERE name = '2025-26')
--   AND day_of_week = 6;
