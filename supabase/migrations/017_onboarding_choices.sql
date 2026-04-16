-- Migration 017: Create onboarding_choices table for dating-sim style onboarding
-- Each row = one dialogue choice during the 5-step onboarding process

CREATE TABLE IF NOT EXISTS onboarding_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL REFERENCES agents(slug) ON DELETE CASCADE,
  step INTEGER NOT NULL CHECK (step BETWEEN 1 AND 5),
  theme TEXT NOT NULL,
  player_choice TEXT NOT NULL,
  agent_reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by agent
CREATE INDEX idx_onboarding_choices_agent ON onboarding_choices(agent_slug);

-- Unique constraint: one choice per step per agent
CREATE UNIQUE INDEX idx_onboarding_choices_agent_step ON onboarding_choices(agent_slug, step);
