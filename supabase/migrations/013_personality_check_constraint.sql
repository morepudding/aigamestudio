-- Migration 013: Guard rails on personality fields
-- Prevents long sentences from being stored in personality_primary / personality_nuance.
-- Rules: max 50 chars, no em-dash (—), no ellipsis (…), no double-dash (--)

ALTER TABLE agents
  ADD CONSTRAINT chk_personality_primary_format CHECK (
    char_length(personality_primary) <= 50
    AND personality_primary NOT LIKE '%—%'
    AND personality_primary NOT LIKE '%…%'
    AND personality_primary NOT LIKE '%--%'
  ),
  ADD CONSTRAINT chk_personality_nuance_format CHECK (
    char_length(personality_nuance) <= 50
    AND personality_nuance NOT LIKE '%—%'
    AND personality_nuance NOT LIKE '%…%'
    AND personality_nuance NOT LIKE '%--%'
  );
