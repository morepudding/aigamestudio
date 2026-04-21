-- Migration 040: Simplify zone bounds to simple rectangle format
-- Created: 2026-04-21

-- Update existing bounds from complex format to simple rectangle format
UPDATE office_zones 
SET bounds = jsonb_build_object(
  'x1', (bounds->'bounds'->>'x1')::float,
  'y1', (bounds->'bounds'->>'y1')::float,
  'x2', (bounds->'bounds'->>'x2')::float,
  'y2', (bounds->'bounds'->>'y2')::float
)
WHERE bounds->>'type' = 'rectangle';

-- For any remaining zones (shouldn't be any with old polygon format), set default bounds
UPDATE office_zones 
SET bounds = '{"x1": 0.1, "y1": 0.1, "x2": 0.4, "y2": 0.6}'::jsonb
WHERE bounds->>'type' IS NOT NULL;

-- Remove 'custom' from zone_type check constraint
ALTER TABLE office_zones DROP CONSTRAINT IF EXISTS valid_zone_type;
ALTER TABLE office_zones ADD CONSTRAINT valid_zone_type CHECK (zone_type IN ('department', 'restricted', 'common'));

-- Update default zone_type from 'custom' to 'department'
UPDATE office_zones SET zone_type = 'department' WHERE zone_type = 'custom';