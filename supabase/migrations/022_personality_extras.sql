-- Migration 022: Add personality_extras column and refresh personality check constraints
-- Adds 2 extra personality traits per agent (stored as comma-separated string)
-- Also drops and recreates personality constraints to match the new trait catalogue

-- Add extras column
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS personality_extras TEXT DEFAULT NULL;

-- Drop old check constraints (trait names have changed)
ALTER TABLE agents
  DROP CONSTRAINT IF EXISTS chk_personality_primary_format,
  DROP CONSTRAINT IF EXISTS chk_personality_nuance_format;

-- Recreate format constraints (max 50 chars, no special chars)
ALTER TABLE agents
  ADD CONSTRAINT chk_personality_primary_format CHECK (
    char_length(personality_primary) <= 50
    AND personality_primary NOT LIKE '%—%'
    AND personality_primary NOT LIKE '%…%'
    AND personality_primary NOT LIKE '%--%'
  ),
  ADD CONSTRAINT chk_personality_nuance_format CHECK (
    char_length(personality_nuance) <= 50
    AND personality_nuance NOT LIKE '%—%'
    AND personality_nuance NOT LIKE '%…%'
    AND personality_nuance NOT LIKE '%--%'
  );
