-- =====================================================================
-- One DSD vNext — Migration 0021 — Program Configuration Layer
-- Makes the program an ADAPTIVE, MULTI-CLIENT platform instead of a
-- DSD-only app. The reusable engine (auth, library, learning, calendar,
-- console, governance, agents, Ask) stays in code; everything that is
-- client- or engagement-specific moves into data here:
--   identity, naming, themes spine, autonomy model, boundary lanes,
--   model route, measurement targets, lifecycle.
-- A second client becomes a new row set under a new instance_id — NOT a
-- rebuild. DSD is seeded as instance one.
--
-- Owner supremacy: every value here is owner-editable at runtime; nothing
-- in this layer is a restriction Claude imposed — the boundary lanes are
-- recorded as the consultant's own settings, revisable anytime.
-- Additive + reversible. The running pilot is not disturbed by adding this.
-- =====================================================================
BEGIN;

-- ---- Instances: each client/engagement the platform serves ----------
CREATE TABLE IF NOT EXISTS program_instances (
  instance_id text PRIMARY KEY,
  label       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Config: instance-scoped key -> JSON value ----------------------
-- key/value + jsonb keeps the layer schema-stable as new config needs
-- appear; no migration churn per client.
CREATE TABLE IF NOT EXISTS program_config (
  instance_id text NOT NULL REFERENCES program_instances(instance_id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, key)
);

CREATE INDEX IF NOT EXISTS idx_program_config_instance ON program_config(instance_id);

-- ---- Seed: DSD as instance one --------------------------------------
INSERT INTO program_instances(instance_id, label, is_active) VALUES
  ('dsd', 'Minnesota DHS — Disability Services Division (anchor client)', true)
ON CONFLICT (instance_id) DO NOTHING;

-- identity: this is the consultant's tool, instanced for a client
INSERT INTO program_config(instance_id, key, value) VALUES
  ('dsd', 'identity', '{
    "program_name": "One DSD People, Access and Culture Program",
    "owner": "consultant",
    "anchor_client": "Minnesota DHS — Disability Services Division",
    "tool_of": "Equity & Inclusion Operations consultant practice"
  }'::jsonb),

  -- naming: official terms (latest owner decision governs)
  ('dsd', 'naming', '{
    "communities_section": "Minnesota Communities",
    "community_brief_term": "Community Briefs",
    "cultural_intelligence": "reserved for the broader program intelligence layer (not renamed)",
    "assistant": "Ask One DSD / Professional Support",
    "audio": "Audio",
    "podcast": "Podcast",
    "no_ai_language_to_staff": true,
    "brand_short": "One DSD",
    "brand_sub": "People, Access & Culture",
    "brand_footer": "One DSD — Disability Services Division. Internal program surface."
  }'::jsonb),

  -- thematic spine (the ten program themes live in program_themes; mirrored here as the active set)
  ('dsd', 'themes', '{
    "source_table": "program_themes",
    "is_organizing_spine": true
  }'::jsonb),

  -- autonomy model: per-class dials; safety is AFTER-action, not approval queues
  ('dsd', 'autonomy', '{
    "model": "per_class_dial",
    "levels": ["none", "draft_and_hold", "execute_task", "fully_autonomous"],
    "safety_posture": "after_action",
    "after_action_safeguards": ["activity_ledger", "versioning", "instant_rollback", "management_by_exception"],
    "owner_override": "unconditional",
    "no_babysitting": true
  }'::jsonb),

  -- boundary lanes: the CONSULTANT''S own settings (owner-revisable), not Claude-imposed caution
  ('dsd', 'boundary_lanes', '{
    "owner_revisable": true,
    "lanes": [
      "no client-identifying information enters the program",
      "Tribal / sovereignty matters are signpost-only (refer to the ADSA-led Tribal Consultation path)",
      "legal / HR / clinical determinations route to human channels",
      "guidance is advisory and educational; it never issues determinations",
      "the program does not assess or profile a named individual; analysis is aggregate-only"
    ]
  }'::jsonb),

  -- model route: provider is config; the KEY itself stays in the environment, never here
  ('dsd', 'model_route', '{
    "provider": "openrouter",
    "default_model": "openrouter/auto",
    "key_env_var": "OPENROUTER_API_KEY",
    "embeddings": "separate provider (OpenRouter is generation-first)"
  }'::jsonb),

  -- measurement targets
  ('dsd', 'measurement', '{
    "survey_participation_target": 0.70,
    "agent_driven_operations_target": 0.70,
    "aggregate_only": true
  }'::jsonb),

  -- lifecycle: pilot, continuously improved with the team
  ('dsd', 'lifecycle', '{
    "stage": "pilot",
    "target_launch": "2026-12",
    "continuous_improvement": true,
    "feedback_sources": ["leadership", "IT", "staff", "One DSD Equity Team"],
    "is_end_state": false
  }'::jsonb)
ON CONFLICT (instance_id, key) DO NOTHING;

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON program_config TO one_dsd_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON program_instances TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0021_program_config') ON CONFLICT DO NOTHING;
COMMIT;
