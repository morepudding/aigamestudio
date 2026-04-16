-- Replace conversation_type system with rhythm-based discovery messages
-- Each agent now has ONE conversation. Every N messages, a "discovery" message is sent.

-- 1. Add message_type to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'normal'
  CHECK (message_type IN ('normal', 'discovery'));

-- 2. Add rhythm tracking to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS discovery_rhythm INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0;

-- 3. Remove old conversation_type system
DROP INDEX IF EXISTS idx_conversations_agent_type;

-- Remove duplicate conversations: keep the one with most recent activity per agent
DELETE FROM conversations c1
  USING conversations c2
  WHERE c1.agent_slug = c2.agent_slug
    AND c1.is_pinned = true
    AND c2.is_pinned = true
    AND c1.last_message_at < c2.last_message_at;

ALTER TABLE conversations
  DROP COLUMN IF EXISTS conversation_type;

-- 4. Ensure one pinned conversation per agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_agent_unique
  ON conversations(agent_slug) WHERE is_pinned = true;
