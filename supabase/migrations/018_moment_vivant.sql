-- Migration 018: Moments Vivants
-- Mini-scènes interactives générées nuit par cron, jouées dans un chat séparé

-- 1. Ajouter message_type 'moment_vivant' aux messages existants
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('normal', 'discovery', 'moment_vivant'));

-- 2. Table des scénarios pending générés par le cron
CREATE TABLE IF NOT EXISTS pending_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL REFERENCES agents(slug) ON DELETE CASCADE,

  -- Type de moment
  moment_type TEXT NOT NULL CHECK (moment_type IN ('pause-café', 'drague', 'complicité', 'petite-friction', 'confidence')),

  -- Message d'ouverture envoyé dans le chat normal
  message_ouverture TEXT NOT NULL,

  -- Scénario complet : tableau JSON de ScèneExchange
  -- Format: [{ replique: string, choix: [string, string, string], suite_par_choix: { [choix]: string } }]
  scene JSONB NOT NULL DEFAULT '[]',

  -- Statut du moment
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'completed', 'expired')),

  -- Message ID dans la conversation principale (rempli quand envoyé)
  chat_message_id TEXT NULL,

  -- Quand envoyer le message dans la journée
  scheduled_at TIMESTAMPTZ NOT NULL,

  -- Quand le joueur a ouvert/complété
  opened_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_moments_agent ON pending_moments(agent_slug);
CREATE INDEX idx_pending_moments_status ON pending_moments(status);
CREATE INDEX idx_pending_moments_scheduled ON pending_moments(scheduled_at);

-- Un seul moment pending ou sent par agent à la fois
CREATE UNIQUE INDEX idx_pending_moments_agent_active
  ON pending_moments(agent_slug)
  WHERE status IN ('pending', 'sent', 'opened');
