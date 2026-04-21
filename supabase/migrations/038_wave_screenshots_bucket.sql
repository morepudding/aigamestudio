-- Migration 038: Wave Screenshots Bucket
--
-- Crée le bucket Supabase Storage pour stocker les screenshots
-- capturés par Playwright entre chaque wave de développement.

-- ============================================================
-- 1. Créer le bucket wave-screenshots
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('wave-screenshots', 'wave-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Politiques d'accès
-- ============================================================

-- Lecture publique (pour afficher les screenshots dans l'UI)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read wave-screenshots'
  ) THEN
    CREATE POLICY "Public read wave-screenshots"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'wave-screenshots');
  END IF;
END
$$;

-- Upload par le service (Next.js API routes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Service upload wave-screenshots'
  ) THEN
    CREATE POLICY "Service upload wave-screenshots"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'wave-screenshots');
  END IF;
END
$$;

-- Mise à jour par le service (upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Service upsert wave-screenshots'
  ) THEN
    CREATE POLICY "Service upsert wave-screenshots"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'wave-screenshots');
  END IF;
END
$$;

-- ============================================================
-- 3. Vérification
-- ============================================================

-- Note: Le bucket est maintenant prêt pour le service screenshotService.ts
-- qui utilise Playwright + @sparticuz/chromium pour capturer des screenshots
-- des pages GitHub Pages déployées.