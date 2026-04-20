-- Migration 036: Agent deck cards (user-validated AI proposals)
-- Stores cards proposed by AI and accepted/refused by the user.

CREATE TABLE IF NOT EXISTS agent_deck_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug    TEXT NOT NULL,
  card_type     TEXT NOT NULL CHECK (card_type IN ('anecdote','question','relance','reaction')),
  scope         TEXT NOT NULL DEFAULT 'agent',
  content       TEXT NOT NULL,
  themes        TEXT[] NOT NULL DEFAULT '{}',
  min_confidence INT NOT NULL DEFAULT 0,
  -- NULL = pending, TRUE = accepted, FALSE = refused
  accepted      BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_deck_cards_slug_idx ON agent_deck_cards(agent_slug);
CREATE INDEX IF NOT EXISTS agent_deck_cards_accepted_idx ON agent_deck_cards(agent_slug, accepted);
