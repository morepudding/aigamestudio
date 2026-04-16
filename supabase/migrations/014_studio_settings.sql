-- Migration 014: Studio settings key/value store
-- Used for editable studio context blocks (conventions, etc.)

CREATE TABLE studio_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the conventions key so the page has something to edit
INSERT INTO studio_settings (key, value) VALUES
  ('conventions', '');
