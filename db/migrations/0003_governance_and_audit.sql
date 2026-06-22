-- =====================================================================
-- One DSD vNext — Migration 0003 — Governance, Approval, Audit, Consultation
-- Ports the proven governance model (gates, policies, protected surfaces)
-- from the brain; adds append-only audit and the sanctioned PII zone.
-- =====================================================================
BEGIN;

-- ---- Gate categories & protected surfaces ----------------------------
CREATE TABLE IF NOT EXISTS gate_categories (key text PRIMARY KEY, label text NOT NULL, description text);
INSERT INTO gate_categories(key,label) VALUES
  ('cultural_validity','Cultural / community validity'),('high_stakes','High-stakes division decision'),
  ('legal','Legal obligation'),('low_confidence','Low confidence / reframing'),
  ('named_individual','Named individual'),('publication','Publication / external release')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS protected_surfaces (key text PRIMARY KEY, label text NOT NULL, description text);
INSERT INTO protected_surfaces(key,label) VALUES
  ('autonomy_ceiling','Autonomy ceiling'),('cascade_traceability_rule','Cascade traceability rule'),
  ('hard_gates','Hard gates'),('idi_calibration_rule','IDI calibration rule'),('program_standards','Program standards')
ON CONFLICT (key) DO NOTHING;

-- ---- Agent action policies (the enforcement model) -------------------
CREATE TABLE IF NOT EXISTS agent_action_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_kind     text NOT NULL UNIQUE,
  autonomy_level  text NOT NULL CHECK (autonomy_level IN ('act_then_report','propose_only','blocked')),
  gate_category_key text REFERENCES gate_categories(key),
  release_requires_role text REFERENCES roles(key),
  rationale       text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO agent_action_policies(action_kind,autonomy_level,gate_category_key,release_requires_role) VALUES
  ('answer_staff_guidance','act_then_report',NULL,NULL),
  ('curate_knowledge_library','act_then_report',NULL,NULL),
  ('draft_equity_lens_review','act_then_report',NULL,NULL),
  ('plain_language_rewrite','act_then_report',NULL,NULL),
  ('cultural_brief_glossary','act_then_report',NULL,NULL),
  ('build_coaching_scaffold','act_then_report',NULL,NULL),
  ('operational_kpi_report','act_then_report',NULL,NULL),
  ('backlog_clearance','act_then_report',NULL,NULL),
  ('self_improvement_craft','act_then_report',NULL,NULL),
  ('cultural_community_claim','propose_only','cultural_validity','consultant'),
  ('legal_compliance_artifact','propose_only','legal','consultant'),
  ('low_confidence_or_reframe','propose_only','low_confidence','consultant'),
  ('program_design_or_brief_director','propose_only','high_stakes','consultant'),
  ('publish_or_release','propose_only','publication','consultant'),
  ('assess_named_individual','blocked','named_individual',NULL)
ON CONFLICT (action_kind) DO NOTHING;

-- ---- Approval workflow ----------------------------------------------
CREATE TABLE IF NOT EXISTS approval_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  kind          text NOT NULL DEFAULT 'content',  -- content | audio | answer | packet
  state         text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','in_review','approved','rejected','changes_requested')),
  submitted_by  uuid REFERENCES users(id),
  gate_category_key text REFERENCES gate_categories(key),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS approval_decisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_item_id uuid NOT NULL REFERENCES approval_items(id) ON DELETE CASCADE,
  decision      text NOT NULL CHECK (decision IN ('approved','rejected','changes_requested')),
  decided_by    uuid NOT NULL REFERENCES users(id),
  note          text,
  decided_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_release_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  action      text NOT NULL,                      -- published | unpublished | archived
  actor_id    uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Consultation intake (SANCTIONED PII ZONE) -----------------------
-- requester_name/email are consultant-only and must never enter aggregates,
-- the assistant corpus, or developmental memory.
CREATE TABLE IF NOT EXISTS consultation_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no    text UNIQUE,
  requester_name  text,
  requester_email text,
  topic         text,
  body          text,
  state         text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','triaged','in_progress','closed')),
  assigned_to   uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE consultation_requests IS 'Sanctioned PII zone: consultant-only; never feeds aggregates, corpus, or memory.';
CREATE TABLE IF NOT EXISTS consultation_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES consultation_requests(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES users(id),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---- Append-only audit ----------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target      text,
  detail      jsonb,
  trace_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  approval_items, approval_decisions, content_release_events,
  consultation_requests, consultation_notes
TO one_dsd_app;
GRANT SELECT ON gate_categories, protected_surfaces, agent_action_policies TO one_dsd_app;

-- Append-only: app may INSERT and read audit, but never modify/delete it.
GRANT SELECT, INSERT ON audit_events TO one_dsd_app;
REVOKE UPDATE, DELETE ON audit_events FROM one_dsd_app;
REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;

INSERT INTO schema_migrations(version) VALUES ('0003_governance_and_audit') ON CONFLICT DO NOTHING;
COMMIT;
