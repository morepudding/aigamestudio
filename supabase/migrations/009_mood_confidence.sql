-- Add mood system and confidence level to agents
-- Mood: current emotional state of the agent (influences conversation tone)
-- Confidence level: relationship depth with the boss (0-100, unlocks behaviors)

ALTER TABLE agents ADD COLUMN IF NOT EXISTS mood TEXT DEFAULT 'neutre'
  CHECK (mood IN ('neutre', 'enthousiaste', 'frustré', 'curieux', 'fier', 'inquiet', 'joueur', 'nostalgique', 'inspiré', 'agacé'));

ALTER TABLE agents ADD COLUMN IF NOT EXISTS mood_cause TEXT DEFAULT NULL;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS mood_updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE agents ADD COLUMN IF NOT EXISTS confidence_level INTEGER DEFAULT 0
  CHECK (confidence_level >= 0 AND confidence_level <= 100);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS recruited_at TIMESTAMPTZ DEFAULT now();

-- Add nickname tracking in memory (new memory type for relationship details)
-- Extend the CHECK constraint on agent_memory to include new types
ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_memory_type_check;
ALTER TABLE agent_memory ADD CONSTRAINT agent_memory_memory_type_check
  CHECK (memory_type IN ('summary', 'decision', 'preference', 'progress', 'relationship', 'nickname', 'confidence'));

-- Enable realtime for agents mood changes
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
