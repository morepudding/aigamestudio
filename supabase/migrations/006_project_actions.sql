-- ─── Project Actions table ───────────────────────────────────────────────────
-- Each action is a task that can be executed by a CrewAI agent.
-- Actions depend on the project's current stage (status).
CREATE TABLE IF NOT EXISTS project_actions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'in-progress', 'done', 'locked')),
  sort_order     INT NOT NULL DEFAULT 0,
  time_estimate  TEXT NOT NULL DEFAULT '',
  project_phase  TEXT NOT NULL DEFAULT 'concept' CHECK (project_phase IN ('concept', 'in-dev', 'released')),

  -- CrewAI metadata
  crewai_agent_role      TEXT NOT NULL DEFAULT '',
  crewai_agent_goal      TEXT NOT NULL DEFAULT '',
  crewai_agent_backstory TEXT NOT NULL DEFAULT '',
  crewai_tools           TEXT[] NOT NULL DEFAULT '{}',
  crewai_expected_output TEXT NOT NULL DEFAULT '',

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_actions_project ON project_actions(project_id);
CREATE INDEX idx_project_actions_phase ON project_actions(project_id, project_phase);

-- Enable RLS
ALTER TABLE project_actions ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-player studio, no auth needed)
CREATE POLICY "Allow all on project_actions" ON project_actions
  FOR ALL USING (true) WITH CHECK (true);
