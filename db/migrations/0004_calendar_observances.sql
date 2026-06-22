-- =====================================================================
-- One DSD vNext — Migration 0004 — Calendar, Observances, Prep Cards
-- Staff calendar surface + the consultant's observance-prep workflow.
-- Observances are cultural/heritage moments handled with the program's
-- "to inform, never to perform" humility rule. Prep cards are DRAFTS
-- until a human approves (governance from 0003 applies).
-- =====================================================================
BEGIN;

-- ---- Observances (recurring cultural / heritage / awareness moments) --
CREATE TABLE IF NOT EXISTS observances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  category      text CHECK (category IN ('heritage_month','awareness_day','religious','civic','disability','tribal','other')),
  -- recurrence: either a fixed month/day, a month-long span, or free-form note
  month_of_year int CHECK (month_of_year BETWEEN 1 AND 12),
  day_of_month  int CHECK (day_of_month BETWEEN 1 AND 31),
  span_months   int,                                  -- e.g. heritage MONTHS span 1
  recurrence_note text,                               -- e.g. "third Monday of January"
  -- humility / sourcing posture
  sensitivity   text NOT NULL DEFAULT 'standard' CHECK (sensitivity IN ('standard','elevated','tribal_referral')),
  humility_note text DEFAULT 'To inform, never to perform. Defer to community voice.',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN observances.sensitivity IS 'tribal_referral routes to referral, never AI synthesis (see 0003 gate model).';

-- ---- Calendar events (concrete, dated occurrences shown to staff) -----
CREATE TABLE IF NOT EXISTS calendar_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observance_id uuid REFERENCES observances(id) ON DELETE SET NULL,
  title         text NOT NULL,
  description   text,
  kind          text NOT NULL DEFAULT 'observance' CHECK (kind IN ('observance','program','training','consultation','deadline','other')),
  starts_on     date NOT NULL,
  ends_on       date,
  all_day       boolean NOT NULL DEFAULT true,
  starts_at     timestamptz,                          -- when not all_day
  ends_at       timestamptz,
  location      text,
  visibility    text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('staff','consultant','internal')),
  source_asset_id uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_starts ON calendar_events(starts_on);
CREATE INDEX IF NOT EXISTS idx_calendar_kind_vis ON calendar_events(kind, visibility);

-- ---- Observance prep cards (DRAFT artifacts for review) ---------------
-- The observance-prep loop drafts these; they enter the 0003 approval
-- queue and never publish without a human gate.
CREATE TABLE IF NOT EXISTS observance_prep_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observance_id uuid NOT NULL REFERENCES observances(id) ON DELETE CASCADE,
  for_year      int NOT NULL,
  headline      text,
  body          text,
  tone_check    text,                                 -- reviewer's note on tone/humility
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','pending_review','approved','archived')),
  approved_by   uuid REFERENCES users(id),
  approved_at   timestamptz,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observance_id, for_year)
);

-- Card citations: every claim ties back to an approved corpus asset.
CREATE TABLE IF NOT EXISTS prep_card_sources (
  card_id    uuid NOT NULL REFERENCES observance_prep_cards(id) ON DELETE CASCADE,
  asset_id   uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  note       text,
  PRIMARY KEY (card_id, asset_id)
);

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  observances, calendar_events, observance_prep_cards, prep_card_sources
TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0004_calendar_observances') ON CONFLICT DO NOTHING;
COMMIT;
