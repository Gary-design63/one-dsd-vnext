-- =====================================================================
-- One DSD vNext — Migration 0019 — Content ingestion source map
-- Idempotent, resumable bulk ingestion. Each source item (from the legacy
-- program / a manifest) is tracked by a stable source_id, so re-runs UPDATE
-- rather than duplicate. content_hash lets the loader skip unchanged rows.
-- The map never stores content itself, only the link source_id -> entity.
-- Ingestion stages content as DRAFT; approval remains the consultant's
-- governed switch (0003). No client PII is ever ingested (validated upstream).
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS content_source_map (
  source_id    text PRIMARY KEY,                 -- stable id from the manifest
  entity_kind  text NOT NULL,                    -- 'asset' | 'learning_path' | ... (registry kinds)
  entity_id    text NOT NULL,                    -- the row id in the target table
  content_hash text,                             -- sha256 of normalized payload (skip-if-unchanged)
  decision     text NOT NULL DEFAULT 'keep'
               CHECK (decision IN ('keep','revise','retire')),
  ingested_by  uuid REFERENCES users(id),
  ingested_at  timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csm_entity ON content_source_map(entity_kind, entity_id);

GRANT SELECT, INSERT, UPDATE ON content_source_map TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0019_content_ingestion') ON CONFLICT DO NOTHING;
COMMIT;
