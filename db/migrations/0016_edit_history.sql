-- =====================================================================
-- One DSD vNext — Migration 0016 — Generic edit history (in-place editing)
-- Snapshots prior values for non-asset content edits (learning paths/modules,
-- calendar entries, collections). Assets keep their richer knowledge_versions
-- (0002); page copy keeps site_copy_versions (0015). Append-only history.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS edit_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_kind text NOT NULL,                 -- 'learning_path' | 'learning_module' | 'calendar_event' | 'collection'
  entity_id   text NOT NULL,
  field       text NOT NULL,
  old_value   text,                          -- value BEFORE the edit
  edited_by   uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_edit_history_entity ON edit_history(entity_kind, entity_id);

GRANT SELECT, INSERT ON edit_history TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0016_edit_history') ON CONFLICT DO NOTHING;
COMMIT;
