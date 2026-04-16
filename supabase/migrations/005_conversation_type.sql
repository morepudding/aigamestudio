-- Add conversation_type column to conversations table
-- Types: 'chat' (free chat, default), 'memory-interview' (discovery questions)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'chat'
  CHECK (conversation_type IN ('chat', 'memory-interview'));

-- Update index to include conversation_type for efficient lookups
CREATE INDEX IF NOT EXISTS idx_conversations_agent_type
  ON conversations(agent_slug, conversation_type);
