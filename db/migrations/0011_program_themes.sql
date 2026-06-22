-- =====================================================================
-- One DSD vNext — Migration 0011 — Program Themes (the thematic spine)
-- The consultant's major program themes become a first-class dimension that
-- tags content, learning paths, journey doors, and agent domains. They sit
-- alongside DEIA pillars (0008) and discipline clusters (0002) — themes are
-- the "what this program is about"; pillars are the "DEIA lens"; clusters
-- are the "academic/practice field".
-- Additive + governed.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS program_themes (
  key           text PRIMARY KEY,
  label         text NOT NULL,
  primary_pillar text REFERENCES deia_pillars(key),
  description   text,
  sort_order    int DEFAULT 100
);
INSERT INTO program_themes(key,label,primary_pillar,sort_order,description) VALUES
  ('service_delivery_equity','External service delivery equity','equity',1,'Equitable, accessible services for the people DSD serves'),
  ('workplace_equity','Workplace equity','equity',2,'Fair processes, pay, and conditions inside the workplace'),
  ('workforce_equity_inclusion','Workforce equity & inclusion','inclusion',3,'Representation, belonging, and inclusive workforce practice'),
  ('leadership_development','Leadership development','inclusion',4,'Building inclusive, capable leaders and the bench'),
  ('cross_team_collaboration','Cross-team collaboration','inclusion',5,'Working effectively and inclusively across teams'),
  ('intercultural_practice','Intercultural development, education & practice','inclusion',6,'Cultural education and intercultural awareness, calibrated to the IDC'),
  ('wellbeing_psych_safety','Employee well-being & psychological safety','inclusion',7,'A safe, healthy environment where staff can contribute fully'),
  ('career_dev_mentorship','Career development & mentorship','equity',8,'Growth, sponsorship, and mentorship pathways')
ON CONFLICT (key) DO NOTHING;

-- Tag content with themes (many-to-many).
CREATE TABLE IF NOT EXISTS asset_themes (
  asset_id  uuid NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  theme_key text NOT NULL REFERENCES program_themes(key),
  PRIMARY KEY (asset_id, theme_key)
);
CREATE INDEX IF NOT EXISTS idx_asset_themes_theme ON asset_themes(theme_key);

-- Tag learning paths with themes.
CREATE TABLE IF NOT EXISTS learning_path_themes (
  path_id   uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  theme_key text NOT NULL REFERENCES program_themes(key),
  PRIMARY KEY (path_id, theme_key)
);

-- Agents reason within themes too (extends 0008 agent_domains).
ALTER TABLE agent_domains ADD COLUMN IF NOT EXISTS program_theme text REFERENCES program_themes(key);

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_themes, learning_path_themes TO one_dsd_app;
GRANT SELECT ON program_themes TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0011_program_themes') ON CONFLICT DO NOTHING;
COMMIT;
