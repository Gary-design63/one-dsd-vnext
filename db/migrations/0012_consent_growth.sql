-- =====================================================================
-- One DSD vNext — Migration 0012 — Consent & Personalized Growth
-- Layer 11: personalized, voluntary, self-directed growth. Recommendations
-- are SUGGESTIONS only (never assignments), CONSENT-gated, transparent
-- (rationale shown to the learner), and STRICTLY non-HR / non-surveillance.
-- `learning_recommendations` already exists (0005); this adds explicit,
-- revocable consent and a lightweight self-declared interest profile that
-- the learner controls.
-- =====================================================================
BEGIN;

-- ---- Consent (explicit, revocable, per scope) ------------------------
CREATE TABLE IF NOT EXISTS user_consents (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope      text NOT NULL CHECK (scope IN ('personalized_recommendations','engagement_analytics')),
  granted    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope)
);
COMMENT ON TABLE user_consents IS 'Explicit, revocable consent. Recommendations/analytics require it; default off.';

-- ---- Self-declared interests (the learner owns these) ----------------
CREATE TABLE IF NOT EXISTS user_interests (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_key  text NOT NULL REFERENCES program_themes(key),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, theme_key)
);

-- Recommendation feedback is the learner's own (accept/dismiss already on
-- learning_recommendations.state); add a private reason for transparency.
ALTER TABLE learning_recommendations ADD COLUMN IF NOT EXISTS dismissed_reason text;

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON user_consents, user_interests TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0012_consent_growth') ON CONFLICT DO NOTHING;
COMMIT;
