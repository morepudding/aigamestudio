-- Migration: Add metadata column to conversations table for Topic Reservoir
-- This allows storing scenario history and other conversation metadata

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add comment explaining the metadata structure
COMMENT ON COLUMN conversations.metadata IS 'Stores conversation metadata including Topic Reservoir scenario history. Expected structure: {"usedScenarioIds": [1, 2, 3], "lastScenarioAt": 1745260800000}';

-- Create an index for efficient querying of metadata
CREATE INDEX IF NOT EXISTS conversations_metadata_idx ON conversations USING GIN (metadata);