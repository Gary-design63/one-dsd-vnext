-- 0020 — episode_audio: stream in-database audio bytes for imported podcast episodes.
BEGIN;
CREATE TABLE IF NOT EXISTS episode_audio (
  episode_id uuid PRIMARY KEY REFERENCES podcast_episodes(id) ON DELETE CASCADE,
  mime_type  text NOT NULL DEFAULT 'audio/mpeg',
  audio      bytea NOT NULL,
  byte_size  bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES ('0020_episode_audio') ON CONFLICT DO NOTHING;
COMMIT;
