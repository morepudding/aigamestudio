-- Migration 025: GDD Original + GDD Vivant
--
-- Ajoute deux colonnes JSONB sur projects :
--   gdd_original  — snapshot immuable du GDD V2 finalisé (écrit une seule fois)
--   gdd_vivant    — état évolutif du design, mis à jour par la pipeline
--
-- Voir lib/types/contracts.ts pour le schéma TypeScript correspondant.

-- ============================================================
-- 1. Ajouter les colonnes sur projects
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS gdd_original JSONB,
  ADD COLUMN IF NOT EXISTS gdd_vivant   JSONB;

COMMENT ON COLUMN projects.gdd_original IS
  'Snapshot immuable du GDD V2 finalisé (schéma : GDDOriginal). Ne jamais mettre à jour après finalisation.';

COMMENT ON COLUMN projects.gdd_vivant IS
  'État courant du game design après décisions pipeline (schéma : GDDVivant). Mis à jour à chaque tâche pipeline complétée.';

-- ============================================================
-- 2. Index GIN pour interroger les features / divergences
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_gdd_vivant_features
  ON projects USING GIN ((gdd_vivant->'features'));

CREATE INDEX IF NOT EXISTS idx_projects_gdd_original_meta
  ON projects USING GIN ((gdd_original->'meta'));

-- ============================================================
-- 3. Fonction utilitaire : ajouter une divergence au GDD vivant
--    Usage depuis la pipeline sans lire/réécrire l'objet entier.
-- ============================================================
CREATE OR REPLACE FUNCTION append_design_divergence(
  p_project_id  TEXT,
  p_divergence  JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET
    gdd_vivant = jsonb_set(
      gdd_vivant,
      '{designDivergences}',
      COALESCE(gdd_vivant->'designDivergences', '[]'::jsonb) || p_divergence
    ),
    gdd_vivant = jsonb_set(
      gdd_vivant,
      '{lastUpdatedAt}',
      to_jsonb(now()::text)
    )
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Fonction utilitaire : mettre à jour le statut d'une feature
--    dans le GDD vivant.
-- ============================================================
CREATE OR REPLACE FUNCTION update_gdd_vivant_feature_status(
  p_project_id  TEXT,
  p_feature_id  TEXT,
  p_status      TEXT
)
RETURNS VOID AS $$
DECLARE
  v_features JSONB;
  v_idx      INT;
BEGIN
  v_features := gdd_vivant->'features'
    FROM projects WHERE id = p_project_id;

  -- Trouver l'index de la feature dans le tableau JSON
  SELECT idx - 1 INTO v_idx
  FROM jsonb_array_elements(v_features) WITH ORDINALITY AS e(elem, idx)
  WHERE e.elem->>'id' = p_feature_id
  LIMIT 1;

  IF v_idx IS NULL THEN
    RETURN; -- feature absente, rien à faire
  END IF;

  UPDATE projects
  SET gdd_vivant = jsonb_set(
    jsonb_set(
      gdd_vivant,
      ARRAY['features', v_idx::text, 'status'],
      to_jsonb(p_status)
    ),
    '{lastUpdatedAt}',
    to_jsonb(now()::text)
  )
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;
