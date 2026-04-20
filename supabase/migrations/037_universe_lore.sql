-- Add universe_lore to studio_settings
-- Stores the evolving lore of Academia Vespana (the host VN universe)
-- Editable from the studio settings UI without redeployment

INSERT INTO studio_settings (key, value, updated_at)
VALUES (
  'universe_lore',
  '',
  NOW()
)
ON CONFLICT (key) DO NOTHING;
