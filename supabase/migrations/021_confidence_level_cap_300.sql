-- Raise confidence level cap from 100 to 300 to support 5-tier system
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_confidence_level_check;
ALTER TABLE agents ADD CONSTRAINT agents_confidence_level_check
  CHECK (confidence_level >= 0 AND confidence_level <= 300);
