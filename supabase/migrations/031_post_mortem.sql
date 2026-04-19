-- Migration 031: Post-Mortem — évaluation des tâches et prompts compétence par Eve
--
-- Deux tables distinctes et séparées :
--   task_reviews        : notation d'une tâche pipeline après projet terminé
--   agent_skill_prompts : prompt compétence généré par Eve (≠ prompt personnalité)
--
-- Le prompt compétence est injecté dans l'exécution des tâches pipeline uniquement.
-- Il ne touche jamais au system prompt de chat (personnalité, mémoires, relation).

-- ============================================================
-- 1. Colonnes position / specialization sur agents
-- ============================================================

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS position TEXT
    CHECK (position IN ('junior', 'confirmé', 'lead')) DEFAULT NULL;

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS specialization TEXT
    CHECK (specialization IN ('gameplay', 'engine', 'backend', 'ui-tech', 'devops')) DEFAULT NULL;

COMMENT ON COLUMN agents.position IS
  'Hiérarchie de l''agent : junior | confirmé | lead';

COMMENT ON COLUMN agents.specialization IS
  'Spécialisation programmeur uniquement : gameplay | engine | backend | ui-tech | devops';

-- ============================================================
-- 2. Table task_reviews — évaluation d'une tâche par projet
-- ============================================================

CREATE TABLE IF NOT EXISTS task_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES pipeline_tasks(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_slug  TEXT NOT NULL REFERENCES agents(slug) ON DELETE CASCADE,

  -- Évaluation
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,                            -- Commentaire libre du post-mortem

  -- Timestamps
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  -- Une seule review par tâche
  UNIQUE (task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_reviews_project   ON task_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_agent     ON task_reviews(agent_slug);
CREATE INDEX IF NOT EXISTS idx_task_reviews_task      ON task_reviews(task_id);

CREATE OR REPLACE FUNCTION update_task_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_reviews_updated_at ON task_reviews;
CREATE TRIGGER task_reviews_updated_at
  BEFORE UPDATE ON task_reviews
  FOR EACH ROW EXECUTE FUNCTION update_task_reviews_updated_at();

-- ============================================================
-- 3. Table agent_skill_prompts — prompt compétence versionnés
--    DISTINCT du prompt personnalité / chat
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_skill_prompts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug   TEXT NOT NULL REFERENCES agents(slug) ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, -- projet source du post-mortem
  version      INTEGER NOT NULL DEFAULT 1,

  -- Contenu LEAN généré par Eve
  content      TEXT NOT NULL,

  -- Cycle de vie : draft → active (un seul actif par agent) → archived
  status       TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),

  -- Timestamps
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),

  -- Un seul prompt actif par agent à la fois (partial unique index)
  UNIQUE (agent_slug, project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_skill_prompts_agent   ON agent_skill_prompts(agent_slug);
CREATE INDEX IF NOT EXISTS idx_skill_prompts_status  ON agent_skill_prompts(agent_slug, status);
CREATE INDEX IF NOT EXISTS idx_skill_prompts_project ON agent_skill_prompts(project_id);

CREATE OR REPLACE FUNCTION update_agent_skill_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_skill_prompts_updated_at ON agent_skill_prompts;
CREATE TRIGGER agent_skill_prompts_updated_at
  BEFORE UPDATE ON agent_skill_prompts
  FOR EACH ROW EXECUTE FUNCTION update_agent_skill_prompts_updated_at();

-- Quand on active un prompt, archiver automatiquement l'ancien actif du même agent
CREATE OR REPLACE FUNCTION archive_previous_active_skill_prompt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    UPDATE agent_skill_prompts
    SET status = 'archived'
    WHERE agent_slug = NEW.agent_slug
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS archive_old_skill_prompt ON agent_skill_prompts;
CREATE TRIGGER archive_old_skill_prompt
  BEFORE UPDATE ON agent_skill_prompts
  FOR EACH ROW EXECUTE FUNCTION archive_previous_active_skill_prompt();

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'task_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_reviews;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agent_skill_prompts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_skill_prompts;
  END IF;
END;
$$;
