-- Migration 047: Persist backlog planning runs for CrewAI/native orchestration

CREATE TABLE IF NOT EXISTS pipeline_planning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  input_hash TEXT NOT NULL,
  raw_output TEXT,
  normalized_output JSONB,
  warnings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  token_usage INTEGER,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_planning_runs_project
  ON pipeline_planning_runs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_planning_runs_status
  ON pipeline_planning_runs(status);

CREATE OR REPLACE FUNCTION update_pipeline_planning_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pipeline_planning_runs_updated_at ON pipeline_planning_runs;
CREATE TRIGGER pipeline_planning_runs_updated_at
  BEFORE UPDATE ON pipeline_planning_runs
  FOR EACH ROW EXECUTE FUNCTION update_pipeline_planning_runs_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pipeline_planning_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_planning_runs;
  END IF;
END;
$$;