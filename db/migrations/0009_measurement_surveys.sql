-- =====================================================================
-- One DSD vNext — Migration 0009 — Measurement, Surveys, Companions
-- Implements the consultant's measurement decisions:
--  - every learning module carries 3 companions: survey, reflection,
--    applied-equity-practice resource;
--  - surveys/needs-assessments are distributed IN-SYSTEM by the consultant
--    ONLY, with a 70% participation target;
--  - educational-material access is recorded ONLY as aggregates by
--    course/topic (no per-user material-access tracking — non-surveillance);
--  - program KPIs (incl. 70% agent-driven) are tracked.
-- Additive + governed. Closes the Knowledge/Learning/Trust feedback loops.
-- =====================================================================
BEGIN;

-- ---- Instruments (surveys, reflections, assessments) -----------------
CREATE TABLE IF NOT EXISTS instruments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE,
  title         text NOT NULL,
  kind          text NOT NULL CHECK (kind IN
                 ('module_survey','reflection','engagement','annual_deia','needs_assessment')),
  description   text,
  -- participation goal; annual DEIA + needs assessment default to 0.70
  target_participation numeric(4,3) DEFAULT 0.700,
  active        boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instrument_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  ordinal       int NOT NULL,
  prompt        text NOT NULL,
  response_type text NOT NULL DEFAULT 'scale' CHECK (response_type IN ('scale','text','single','multi','boolean')),
  options       text[] DEFAULT '{}',
  required      boolean NOT NULL DEFAULT false,
  UNIQUE (instrument_id, ordinal)
);

-- ---- Distribution (CONSULTANT-ONLY action) ---------------------------
-- distributed_by must be an authority user; enforced in app + audited.
CREATE TABLE IF NOT EXISTS instrument_distributions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  distributed_by uuid REFERENCES users(id),
  audience      text NOT NULL DEFAULT 'all_staff',   -- delivery_tracks key or 'all_staff'
  opens_at      timestamptz NOT NULL DEFAULT now(),
  closes_at     timestamptz,
  target_participation numeric(4,3) DEFAULT 0.700,
  state         text NOT NULL DEFAULT 'open' CHECK (state IN ('draft','open','closed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE instrument_distributions IS 'Surveys/assessments are distributed in-system by the consultant only (authority-gated, audited).';

-- Invitations = participation denominator.
CREATE TABLE IF NOT EXISTS instrument_invitations (
  distribution_id uuid NOT NULL REFERENCES instrument_distributions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (distribution_id, user_id)
);

-- Responses = numerator. Content is CONFIDENTIAL and reported only in
-- aggregate (min cell size). user_id is kept solely to dedupe + compute
-- participation; it is never surfaced with answer content.
CREATE TABLE IF NOT EXISTS instrument_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES instrument_distributions(id) ON DELETE CASCADE,
  respondent_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribution_id, respondent_id)
);
COMMENT ON TABLE instrument_responses IS 'Confidential. Reported only in aggregate (min cell size); identity never shown with answers.';

CREATE TABLE IF NOT EXISTS instrument_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   uuid NOT NULL REFERENCES instrument_responses(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES instrument_questions(id) ON DELETE CASCADE,
  value_num     numeric,
  value_text    text,
  value_options text[] DEFAULT '{}'
);

-- Participation view (rate vs target) — aggregate, safe to show consultant.
CREATE OR REPLACE VIEW instrument_participation AS
  SELECT d.id AS distribution_id, d.instrument_id, d.target_participation,
         (SELECT count(*) FROM instrument_invitations i WHERE i.distribution_id = d.id) AS invited,
         (SELECT count(*) FROM instrument_responses r WHERE r.distribution_id = d.id) AS responded
  FROM instrument_distributions d;

-- ---- Module companions (survey + reflection + applied practice) ------
-- Every learning module may carry the three companion components.
CREATE TABLE IF NOT EXISTS module_companions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  companion_kind text NOT NULL CHECK (companion_kind IN ('survey','reflection','applied_practice')),
  instrument_id uuid REFERENCES instruments(id) ON DELETE SET NULL,  -- for survey/reflection
  asset_id      uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL, -- for applied_practice resource
  prompt        text,
  sort_order    int DEFAULT 100,
  UNIQUE (module_id, companion_kind)
);

-- ---- Engagement rollups (AGGREGATE by course/topic ONLY) -------------
-- No per-user material-access rows. This is the non-surveillance design:
-- access is counted by course (collection) and topic (discipline cluster).
CREATE TABLE IF NOT EXISTS engagement_rollup (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date   date NOT NULL,
  scope_kind    text NOT NULL CHECK (scope_kind IN ('course','topic','module','asset')),
  scope_key     text NOT NULL,                        -- collection key / cluster code / id
  views         int NOT NULL DEFAULT 0,
  completions   int NOT NULL DEFAULT 0,
  audio_plays   int NOT NULL DEFAULT 0,
  distinct_participants int NOT NULL DEFAULT 0,        -- count only; never identities
  UNIQUE (period_date, scope_kind, scope_key)
);
COMMENT ON TABLE engagement_rollup IS 'Aggregate-only by course/topic; never stores or exposes individual material-access.';

-- ---- Program KPIs (incl. 70% agent-driven, 70% participation) --------
CREATE TABLE IF NOT EXISTS program_metrics (
  key           text PRIMARY KEY,
  label         text NOT NULL,
  target        numeric,
  unit          text,                                  -- 'ratio' | 'count' | 'hours' | 'days'
  min_cell_size int NOT NULL DEFAULT 5,                -- k-anonymity floor for any breakdown
  description   text
);
INSERT INTO program_metrics(key,label,target,unit,description) VALUES
  ('agent_driven_ratio','Program agent-driven share',0.70,'ratio','Operational goal: 70% of work handled by the proactive agent framework'),
  ('survey_participation','Annual DEIA / Needs Assessment participation',0.70,'ratio','Goal: 70% participation'),
  ('consultant_hours_reclaimed','Consultant hours reclaimed / week',NULL,'hours','Capacity-loop outcome; protect the scarce stock'),
  ('retrieval_sufficiency','Ask answered from approved corpus',NULL,'ratio','Knowledge-loop health'),
  ('learning_return_rate','Voluntary self-directed return rate',NULL,'ratio','Learning/Trust-loop health')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key  text NOT NULL REFERENCES program_metrics(key),
  period_date date NOT NULL,
  value       numeric,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_key, period_date)
);

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  instruments, instrument_questions, instrument_distributions, instrument_invitations,
  instrument_responses, instrument_answers, module_companions,
  engagement_rollup, metric_snapshots
TO one_dsd_app;
GRANT SELECT ON program_metrics, instrument_participation TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0009_measurement_surveys') ON CONFLICT DO NOTHING;
COMMIT;
