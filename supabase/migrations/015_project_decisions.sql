-- Project decisions: stores director's strategic answers before document generation
-- Eve (Producer) asks QCM questions, answers are injected as priority context in doc prompts

CREATE TABLE IF NOT EXISTS project_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  scope VARCHAR NOT NULL CHECK (scope IN ('global', 'gdd', 'tech-spec', 'data-arch', 'asset-list', 'backlog')),
  question_key VARCHAR NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  selected_option TEXT,
  free_text TEXT,
  answered BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, scope, question_key)
);

CREATE INDEX idx_decisions_project ON project_decisions(project_id);
CREATE INDEX idx_decisions_project_scope ON project_decisions(project_id, scope);

-- Track whether the decision interview is complete for a project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS decisions_ready BOOLEAN NOT NULL DEFAULT false;
