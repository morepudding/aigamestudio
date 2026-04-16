-- Extend memory types to support personal life dimensions for richer agent personalities.
-- New types: family, hobbies, dreams, social, fears, personal_event, topic_tracker
-- Also adds boss_profile which was used in code but missing from the DB constraint.

ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_memory_type_check;
ALTER TABLE agent_memory ADD CONSTRAINT agent_memory_memory_type_check
  CHECK (memory_type IN (
    -- existing
    'summary', 'decision', 'preference', 'progress',
    'relationship', 'nickname', 'confidence', 'boss_profile',
    -- personal life (agent's own life, co-constructed in conversation)
    'family',           -- famille, origines, enfance, ville natale
    'hobbies',          -- passions, activités, goûts culturels hors travail
    'dreams',           -- rêves, aspirations, projets de vie
    'social',           -- amis, cercle social, vie hors studio
    'fears',            -- peurs, vulnérabilités, insécurités
    'personal_event',   -- événements de vie récents (week-end, concert, etc.)
    'topic_tracker'     -- sujets abordés récemment (pour anti-répétition)
  ));
