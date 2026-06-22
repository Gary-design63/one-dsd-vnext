-- =====================================================================
-- One DSD vNext — Migration 0017 — Editable page copy (heading + intro)
-- Seeds site_copy keys for the framing text on each staff surface so the
-- consultant can edit page headings/intros in place (versioned via
-- site_copy_versions from 0015, audited, and roll-back-able). Idempotent.
-- =====================================================================
BEGIN;

INSERT INTO site_copy(key, value) VALUES
  ('library.intro.title','Library'),
  ('library.intro.lede','Browse by discipline, format, and proficiency. Use the filters to narrow to what fits where you are.'),
  ('learning.intro.title','Learning paths'),
  ('learning.intro.lede','Sequenced journeys that build from foundations to practice. Choose a path that fits where you are.'),
  ('calendar.intro.lede','Observances and program dates. Shared to inform, never to perform.'),
  ('ask.intro.title','Professional Support'),
  ('ask.intro.lede','Ask a question and get guidance drawn from the approved One DSD library, with sources. If the library does not cover it, you will be told plainly — nothing is made up.'),
  ('growth.intro.title','Your growth'),
  ('growth.intro.lede','Personalized, voluntary, and private. Suggestions are yours to take or leave — never assignments, never shared with anyone else.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('0017_page_copy') ON CONFLICT DO NOTHING;
COMMIT;
