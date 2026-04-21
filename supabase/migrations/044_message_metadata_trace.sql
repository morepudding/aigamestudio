-- Add metadata JSONB field to messages for generation tracing and audit
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN messages.metadata IS 'Stores message generation trace such as kind(reply/discovery/nudge), source, and scenarioId.';

CREATE INDEX IF NOT EXISTS messages_metadata_idx ON messages USING gin (metadata);