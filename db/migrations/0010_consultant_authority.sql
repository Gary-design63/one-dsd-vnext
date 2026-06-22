-- =====================================================================
-- One DSD vNext — Migration 0010 — Consultant Authority & Auditability
-- Per consultant decisions:
--  - the consultant has UNCONDITIONAL authority and may override/pause any
--    agentic workflow or automation at any time (kill switch + per-target);
--  - the consultant can INSPECT and EDIT audit logs. We implement "edit" as
--    an attributed amendment/redaction/annotation layer so originals are
--    never silently destroyed (forensic integrity for a DHS program) while
--    the consultant has full control of what the log shows.
-- Additive + governed. Override/inspect UI is wired in L10/console.
-- =====================================================================
BEGIN;

-- ---- Program controls (global switches; consultant-owned) ------------
CREATE TABLE IF NOT EXISTS program_controls (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO program_controls(key,value,description) VALUES
  ('automation_state','active','Global automation switch: active | paused. Consultant can pause ALL agents instantly.'),
  ('ask_provider','none','Generation provider for Ask: none (extractive) until a model+key is set.'),
  ('default_autonomy_ceiling','propose_only','Upper bound applied to all agents unless dialed up per persona.')
ON CONFLICT (key) DO NOTHING;

-- ---- Override log (unconditional authority, every use recorded) -------
CREATE TABLE IF NOT EXISTS agent_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind text NOT NULL CHECK (target_kind IN ('global','persona','delegation','action')),
  target_key  text,                                  -- persona key / delegation id / action kind
  action      text NOT NULL CHECK (action IN ('pause','resume','cancel','override','force')),
  reason      text,
  actor_id    uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_overrides_target ON agent_overrides(target_kind, target_key);

-- ---- Audit amendments (consultant inspect + EDIT, attributed) --------
-- The consultant's edit surface over audit_events. Originals stay intact;
-- a redaction hides fields in the UI; a correction supersedes; an
-- annotation adds context. Every amendment is itself attributed + dated.
CREATE TABLE IF NOT EXISTS audit_amendments (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_event_id bigint NOT NULL REFERENCES audit_events(id),
  amendment_kind text NOT NULL CHECK (amendment_kind IN ('annotation','redaction','correction')),
  note           text,
  redacted_fields text[] DEFAULT '{}',               -- which fields the UI should hide
  superseding_detail jsonb,                          -- corrected value (for 'correction')
  actor_id       uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amendments_event ON audit_amendments(audit_event_id);

-- Effective audit view: original event + latest amendment status, for the
-- consultant's inspect console (redactions/corrections applied at read time).
CREATE OR REPLACE VIEW audit_effective AS
  SELECT e.id, e.actor_id, e.action, e.target, e.detail, e.trace_id, e.created_at,
         a.amendment_kind, a.note AS amendment_note, a.redacted_fields,
         a.superseding_detail, a.actor_id AS amended_by, a.created_at AS amended_at
  FROM audit_events e
  LEFT JOIN LATERAL (
    SELECT * FROM audit_amendments am
     WHERE am.audit_event_id = e.id
     ORDER BY am.created_at DESC LIMIT 1
  ) a ON true;

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, UPDATE ON program_controls TO one_dsd_app;        -- consultant flips switches
GRANT SELECT, INSERT ON agent_overrides TO one_dsd_app;          -- append-only override log
GRANT SELECT, INSERT ON audit_amendments TO one_dsd_app;         -- attributed edits (append)
GRANT SELECT ON audit_effective TO one_dsd_app;
-- audit_events remains append-only for the app role (integrity preserved):
-- the consultant edits via audit_amendments, not by mutating originals.

INSERT INTO schema_migrations(version) VALUES ('0010_consultant_authority') ON CONFLICT DO NOTHING;
COMMIT;
