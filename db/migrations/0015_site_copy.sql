-- =====================================================================
-- One DSD vNext — Migration 0015 — Editable page copy (in-place editing)
-- Stores page text (hero, labels, section intros) so the consultant can
-- edit it in place, the same way content is edited. Content assets already
-- version via knowledge_versions (0002); this adds versioned page copy.
-- Authority-only writes; every change audited (enforced in code).
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS site_copy (
  key        text PRIMARY KEY,          -- e.g. 'home.hero.title'
  value      text NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO site_copy(key, value) VALUES
  ('home.hero.eyebrow','One DSD'),
  ('home.hero.title','People, Access & Culture'),
  ('home.hero.lede','Find what you need, and grow where you choose. Start with a path that fits where you are today.')
ON CONFLICT (key) DO NOTHING;

-- History of page-copy edits (parallel to knowledge_versions for assets).
CREATE TABLE IF NOT EXISTS site_copy_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL,
  value      text NOT NULL,             -- the value BEFORE this edit (snapshot)
  edited_by  uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_copy_versions_key ON site_copy_versions(key);

GRANT SELECT, INSERT, UPDATE ON site_copy TO one_dsd_app;
GRANT SELECT, INSERT ON site_copy_versions TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0015_site_copy') ON CONFLICT DO NOTHING;
COMMIT;
