-- Nudge (relance) tracking per conversation
-- nudge_count : consecutive nudges sent without user reply (reset on user message, max 3)
-- nudge_scheduled_at : epoch ms when next nudge is allowed (set by agent after each message)

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS nudge_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nudge_scheduled_at BIGINT;
