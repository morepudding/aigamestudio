-- Add importance score (1-5) to agent_memory entries
-- Only memories with importance >= 3 will be saved (filtered at extraction time)
ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS importance integer NOT NULL DEFAULT 3;

-- Add a CHECK constraint to keep values in range
ALTER TABLE agent_memory
  ADD CONSTRAINT agent_memory_importance_range CHECK (importance BETWEEN 1 AND 5);
