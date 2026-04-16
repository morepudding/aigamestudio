-- Migration 012: Normalize Eve's personality fields to character traits only
UPDATE agents
SET
  personality_primary = 'directe, chaleureuse',
  personality_nuance  = 'cool, dragueuse, franche, focus'
WHERE slug = 'eve';
