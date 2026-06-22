-- =====================================================================
-- One DSD vNext — Migration 0006 — Audio: Voices, Renders, Captions, Podcast
-- The read-aloud + podcast surfaces. Voices are the curated voice library
-- (the "Gary voices" + others). Renders are generated TTS artifacts tied
-- to an asset; captions ride alongside for accessibility. Podcast episodes
-- are DRAFTS until approved (0003 governance applies to publication).
-- =====================================================================
BEGIN;

-- ---- Voice library ---------------------------------------------------
CREATE TABLE IF NOT EXISTS voices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  provider      text NOT NULL DEFAULT 'elevenlabs',   -- provider key (no secrets stored here)
  provider_voice_id text,                             -- external id at the provider
  description   text,
  language      text DEFAULT 'en',
  is_default    boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---- Audio renders (generated narration artifacts) -------------------
-- Binary lives in Blob storage; we store the pointer + integrity metadata.
CREATE TABLE IF NOT EXISTS audio_renders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  voice_id      uuid REFERENCES voices(id) ON DELETE SET NULL,
  source_text_hash text,                              -- sha256 of narrated text (cache key / drift check)
  storage_url   text,                                 -- Blob URL / key
  mime_type     text DEFAULT 'audio/mpeg',
  duration_ms   int,
  byte_size     bigint,
  state         text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','rendering','ready','failed','stale')),
  error_detail  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_renders_asset ON audio_renders(asset_id);
CREATE INDEX IF NOT EXISTS idx_renders_state ON audio_renders(state);

-- ---- Captions / transcripts (accessibility companion) ----------------
CREATE TABLE IF NOT EXISTS audio_captions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  render_id     uuid NOT NULL REFERENCES audio_renders(id) ON DELETE CASCADE,
  format        text NOT NULL DEFAULT 'vtt' CHECK (format IN ('vtt','srt','plain')),
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---- Podcast (curated episodes + segments) ---------------------------
CREATE TABLE IF NOT EXISTS podcast_episodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  summary       text,
  episode_no    int,
  season_no     int DEFAULT 1,
  render_id     uuid REFERENCES audio_renders(id) ON DELETE SET NULL,  -- primary audio
  cover_url     text,
  visibility    text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('staff','consultant','internal')),
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','pending_review','approved','archived')),
  published_at  timestamptz,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_podcast_state_vis ON podcast_episodes(approval_state, visibility);

CREATE TABLE IF NOT EXISTS podcast_segments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id    uuid NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
  ordinal       int NOT NULL,
  title         text,
  asset_id      uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,  -- segment ties to source
  notes         text,
  UNIQUE (episode_id, ordinal)
);

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  voices, audio_renders, audio_captions, podcast_episodes, podcast_segments
TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0006_audio') ON CONFLICT DO NOTHING;
COMMIT;
