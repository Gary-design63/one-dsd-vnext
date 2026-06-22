-- =====================================================================
-- One DSD vNext — Migration 0018 — Audio + Surveys page copy
-- Seeds editable framing text (heading + intro) for the new staff surfaces
-- so the consultant can edit them in place (versioned, audited, roll-back).
-- Idempotent.
-- =====================================================================
BEGIN;

INSERT INTO site_copy(key, value) VALUES
  ('audio.intro.title','Audio & Podcast'),
  ('audio.intro.lede','Listen on your own time. Episodes and narrated pieces drawn from the approved library — the same content through the ear as well as the eye.'),
  ('surveys.intro.title','Surveys & Reflections'),
  ('surveys.intro.lede','When something is shared with you here, your voice shapes the program. Responses are confidential and reported only in aggregate — never tied to your name.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('0018_audio_survey_copy') ON CONFLICT DO NOTHING;
COMMIT;
