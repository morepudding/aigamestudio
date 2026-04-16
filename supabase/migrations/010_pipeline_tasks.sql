-- Migration 010: Pipeline tasks system
-- Replaces project_actions with pipeline_tasks
-- Adds GitHub fields to projects, is_system_agent to agents

-- ============================================================
-- 1. Drop old project_actions table (and dependent objects)
-- ============================================================
DROP TABLE IF EXISTS project_actions CASCADE;

-- ============================================================
-- 2. Alter projects table — add GitHub fields and active flag
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS github_repo_url TEXT,
  ADD COLUMN IF NOT EXISTS github_repo_name TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false;

-- Contrainte : un seul projet actif à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_project
  ON projects (active)
  WHERE active = true;

-- ============================================================
-- 3. Alter agents table — mark system agents (Producer)
-- ============================================================
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS is_system_agent BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 4. Create pipeline_tasks table
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Identification
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  backlog_ref TEXT,                          -- ex: "CORE-001" (null for concept tasks)

  -- Phase & ordering
  project_phase TEXT NOT NULL CHECK (project_phase IN ('concept', 'in-dev', 'released')),
  wave_number INTEGER NOT NULL DEFAULT 0,   -- 0 = sequential concept, 1+ = dev waves
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'ready', 'in-progress', 'review', 'completed', 'failed', 'retrying')),
  requires_review BOOLEAN NOT NULL DEFAULT false,

  -- Agent
  assigned_agent_slug TEXT REFERENCES agents(slug),
  agent_department TEXT,

  -- LLM execution
  llm_model TEXT NOT NULL DEFAULT 'deepseek/deepseek-v3-0324',
  llm_prompt_template TEXT,
  llm_context_files TEXT[] DEFAULT '{}',

  -- Deliverable
  deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('markdown', 'code', 'json', 'config', 'repo-init')),
  deliverable_path TEXT,
  deliverable_content TEXT,

  -- Dependencies (UUIDs of tasks this one depends on)
  depends_on UUID[] DEFAULT '{}',

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_phase ON pipeline_tasks(project_id, project_phase);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON pipeline_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_wave ON pipeline_tasks(project_id, wave_number);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pipeline_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pipeline_tasks_updated_at ON pipeline_tasks;
CREATE TRIGGER pipeline_tasks_updated_at
  BEFORE UPDATE ON pipeline_tasks
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_tasks_updated_at();

-- ============================================================
-- 5. Create task_executions table (execution log)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pipeline_tasks(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'error')),
  llm_input TEXT,
  llm_output TEXT,
  error_message TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executions_task ON task_executions(task_id);

-- Enable Realtime for pipeline_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_tasks;
