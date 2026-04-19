-- Migration 030: Wave Reviews — checkpoint visuel entre chaque wave de développement
--
-- Chaque wave complétée génère un rapport avec screenshot avant de débloquer la suivante.
-- L'utilisateur peut approuver ou rejeter avec un prompt correctionnel.

-- ============================================================
-- 1. Table wave_reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS wave_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wave_number INTEGER NOT NULL,

  -- Screenshot
  screenshot_url TEXT,                        -- URL Supabase Storage du screenshot
  screenshot_taken_at TIMESTAMPTZ,

  -- Pages deployment
  pages_url TEXT,                             -- URL GitHub Pages du mini-jeu

  -- Rapport LLM
  report_markdown TEXT,                       -- Rapport généré par l'agent
  report_generated_at TIMESTAMPTZ,

  -- Décision utilisateur
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_prompt TEXT,                      -- Prompt de correction si rejeté
  reviewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Une seule review par wave et par projet
  UNIQUE (project_id, wave_number)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_wave_reviews_project ON wave_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_wave_reviews_status ON wave_reviews(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_wave_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wave_reviews_updated_at ON wave_reviews;
CREATE TRIGGER wave_reviews_updated_at
  BEFORE UPDATE ON wave_reviews
  FOR EACH ROW EXECUTE FUNCTION update_wave_reviews_updated_at();

-- ============================================================
-- 2. Ajouter deployment_url sur projects pour l'URL Pages
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deployment_url TEXT DEFAULT NULL;

COMMENT ON COLUMN projects.deployment_url IS
  'URL GitHub Pages du mini-jeu déployé (ex: https://morepudding.github.io/eden-mon-jeu/)';

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wave_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE wave_reviews;
  END IF;
END;
$$;
