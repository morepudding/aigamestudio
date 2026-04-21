-- Remove legacy Cryptographie 101 references from persisted studio/chat context.
-- Safe to run multiple times.

UPDATE projects
SET active = false
WHERE title ILIKE '%Cryptographie 101%'
   OR title ILIKE '%cryptographie%'
   OR description ILIKE '%cryptographie%'
   OR description ILIKE '%crypto%';

DELETE FROM agent_memory
WHERE content ILIKE '%Cryptographie 101%'
   OR content ILIKE '%cryptographie%'
   OR content ILIKE '%crypto%';

DELETE FROM messages
WHERE content ILIKE '%Cryptographie 101%'
   OR content ILIKE '%cryptographie%'
   OR content ILIKE '%crypto%';