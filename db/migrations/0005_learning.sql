-- =====================================================================
-- One DSD vNext — Migration 0005 — Learning Paths, Modules, Progress
-- The Learning surface: curated, IDC-calibrated paths built from approved
-- assets. Enrollment + progress are per-user. Recommendations (Layer 11)
-- write into learning_recommendations with explicit consent + non-HR rule.
-- =====================================================================
BEGIN;

-- ---- Learning paths (sequenced journeys, IDC/track calibrated) -------
CREATE TABLE IF NOT EXISTS learning_paths (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  summary       text,
  primary_track text REFERENCES delivery_tracks(key),
  idc_stage     text REFERENCES idc_stages(key),
  proficiency_band text CHECK (proficiency_band IN ('emerging','applied','advanced')),
  estimated_minutes int,
  visibility    text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('staff','consultant','internal')),
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','pending_review','approved','archived')),
  sort_order    int DEFAULT 100,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_paths_track ON learning_paths(primary_track);
CREATE INDEX IF NOT EXISTS idx_paths_state_vis ON learning_paths(approval_state, visibility);

-- ---- Modules (ordered steps; each anchored to an approved asset) ------
CREATE TABLE IF NOT EXISTS learning_modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id       uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  ordinal       int NOT NULL,
  title         text NOT NULL,
  asset_id      uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  kind          text NOT NULL DEFAULT 'read' CHECK (kind IN ('read','watch','listen','reflect','practice','assess')),
  body          text,                                 -- inline framing / instructions
  estimated_minutes int,
  required      boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_id, ordinal)
);
CREATE INDEX IF NOT EXISTS idx_modules_path ON learning_modules(path_id);

-- ---- Enrollment + progress (per user) --------------------------------
CREATE TABLE IF NOT EXISTS learning_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id       uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state         text NOT NULL DEFAULT 'active' CHECK (state IN ('active','completed','paused','dropped')),
  source        text NOT NULL DEFAULT 'self' CHECK (source IN ('self','recommended','assigned')),
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  UNIQUE (path_id, user_id)
);

CREATE TABLE IF NOT EXISTS module_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES learning_enrollments(id) ON DELETE CASCADE,
  module_id     uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  state         text NOT NULL DEFAULT 'not_started' CHECK (state IN ('not_started','in_progress','completed')),
  reflection    text,                                 -- learner's own note (private)
  started_at    timestamptz,
  completed_at  timestamptz,
  UNIQUE (enrollment_id, module_id)
);

-- ---- Recommendations (Layer 11 writes here; consent-gated, non-HR) ----
-- A recommendation is a SUGGESTION only. It never assigns, never reports
-- to HR/supervisors, and requires the user's opt-in (consent_granted).
CREATE TABLE IF NOT EXISTS learning_recommendations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id       uuid REFERENCES learning_paths(id) ON DELETE SET NULL,
  rationale     text,                                 -- why suggested (transparent to the user)
  signal_source text,                                 -- e.g. 'self_reflection','ask_history' (consented only)
  consent_granted boolean NOT NULL DEFAULT false,
  state         text NOT NULL DEFAULT 'suggested' CHECK (state IN ('suggested','accepted','dismissed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE learning_recommendations IS 'Suggestions only. Consent-gated. Never assigns, never feeds HR/supervisory review.';

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  learning_paths, learning_modules, learning_enrollments,
  module_progress, learning_recommendations
TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0005_learning') ON CONFLICT DO NOTHING;
COMMIT;
