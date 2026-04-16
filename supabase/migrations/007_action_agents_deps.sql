-- Add assigned agent and action dependencies to project_actions

-- Link each action to a recruited agent
ALTER TABLE project_actions
  ADD COLUMN IF NOT EXISTS assigned_agent_slug TEXT REFERENCES agents(slug) ON DELETE SET NULL;

-- DAG dependencies: list of action UUIDs that must be "done" before this action becomes "ready"
ALTER TABLE project_actions
  ADD COLUMN IF NOT EXISTS depends_on UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_project_actions_agent ON project_actions(assigned_agent_slug);
