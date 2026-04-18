-- Migration 026: Université d'Espions — course_info
--
-- Ajoute une colonne JSONB course_info sur projects.
-- Chaque projet représente un cours de l'Université d'Espions
-- qui deviendra un mini-jeu web intégré dans le visual novel.
--
-- Schéma TypeScript correspondant : lib/types/project.ts > CourseInfo

-- ============================================================
-- 1. Ajouter la colonne course_info
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS course_info JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.course_info IS
  'Informations du cours dans l''Université d''Espions : nom du cours, module VN, mécaniques, engine web, URL d''intégration.';

-- ============================================================
-- 2. Index GIN pour recherche dans course_info
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_course_info
  ON projects USING GIN (course_info);

-- ============================================================
-- 3. Mettre à jour le projet existant si présent
--    (uniquement si "project-first-light" existe encore)
-- ============================================================

UPDATE projects
SET course_info = NULL
WHERE course_info IS NULL;
