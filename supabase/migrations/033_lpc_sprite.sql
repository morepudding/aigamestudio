-- Add LPC pixel sprite URL to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS lpc_sprite_url TEXT DEFAULT NULL;
