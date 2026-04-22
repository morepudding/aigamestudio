CREATE TABLE IF NOT EXISTS office_asset_reviews (
  asset_type TEXT NOT NULL,
  variant SMALLINT NOT NULL CHECK (variant BETWEEN 1 AND 4),
  attempt SMALLINT NOT NULL CHECK (attempt BETWEEN 1 AND 8),
  module_key TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('raw', 'approved', 'rejected')),
  raw_url TEXT NOT NULL,
  approved_url TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_type, variant, attempt)
);

DELETE FROM studio_settings WHERE key = 'office_default_asset_urls_v1';