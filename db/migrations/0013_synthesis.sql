-- =====================================================================
-- One DSD vNext — Migration 0013 — Synthesis Briefs (Synthesis layer)
-- Persists the governed product of corpus reconciliation: corroborated
-- points, flagged conflicts, theme gaps, merged citations, confidence.
-- Briefs are observable + auditable; conflicts/gaps drive whether external
-- research is even warranted. Drafts/analysis only — never published content.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS synthesis_briefs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query         text NOT NULL,
  confidence    numeric(4,3) NOT NULL DEFAULT 0,
  source_count  int NOT NULL DEFAULT 0,
  covered_themes text[] DEFAULT '{}',
  missing_themes text[] DEFAULT '{}',
  needs_external boolean NOT NULL DEFAULT false,
  narrative     text,                                  -- generative summary; null until model+key
  created_by    uuid REFERENCES users(id),
  trace_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_briefs_created ON synthesis_briefs(created_at);

CREATE TABLE IF NOT EXISTS synthesis_brief_citations (
  brief_id  uuid NOT NULL REFERENCES synthesis_briefs(id) ON DELETE CASCADE,
  asset_id  uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  PRIMARY KEY (brief_id, asset_id)
);

CREATE TABLE IF NOT EXISTS synthesis_brief_conflicts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id   uuid NOT NULL REFERENCES synthesis_briefs(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  topic      text,
  a_asset    uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  b_asset    uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  note       text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  synthesis_briefs, synthesis_brief_citations, synthesis_brief_conflicts
TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0013_synthesis') ON CONFLICT DO NOTHING;
COMMIT;
