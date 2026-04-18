-- Migration 028: Align Eve's personality traits with canonical PersonalityTrait IDs
-- Old nuance: 'humour noir, solaire, testante, affectueusement moqueur' (free-form, hors nomenclature)
-- New nuance: canonical IDs matching the wizard + agent.ts type system

UPDATE agents
SET
  personality_primary = 'chaleureuse, directe',
  personality_nuance  = 'sarcastique, solaire, testante, taquine'
WHERE slug = 'eve';
