-- Add metadata JSONB field to conversations for storing scenario history and other data
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for better performance when querying metadata
CREATE INDEX IF NOT EXISTS conversations_metadata_idx ON conversations USING gin (metadata);

-- Comment explaining the metadata structure
COMMENT ON COLUMN conversations.metadata IS 'Stores conversation metadata including used scenario IDs for topic reservoir rotation. Expected structure: {"usedScenarioIds": [1, 2, 3], "lastScenarioAt": 1745260800000}';