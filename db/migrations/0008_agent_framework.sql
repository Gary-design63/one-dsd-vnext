-- =====================================================================
-- One DSD vNext — Migration 0008 — Agent Framework + DEIA Pillars
-- Encodes the DEIA Practitioner Operating Model (ANCHOR doc 11) as data:
-- the four pillars, the six functional roles as governed subagent personas
-- under a Chief-of-Staff orchestrator, their capabilities/domains/memory,
-- delegation, append-only observability, and the tension-guardrails.
-- Additive + governed. Behavior activates in L9 (Ask) / L10 (Brain).
-- =====================================================================
BEGIN;

-- ---- DEIA pillars (the classification dimension) ---------------------
CREATE TABLE IF NOT EXISTS deia_pillars (
  key text PRIMARY KEY, label text NOT NULL, tagline text, sort_order int DEFAULT 100
);
INSERT INTO deia_pillars(key,label,tagline,sort_order) VALUES
  ('diversity','Diversity','The "what": representation across identities',1),
  ('equity','Equity','The "how": opportunity calibrated to systemic disadvantage',2),
  ('inclusion','Inclusion','The "feeling": respected, valued, psychologically safe',3),
  ('accessibility','Accessibility','The foundation: usable by people with disabilities',4)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS asset_deia_pillars (
  asset_id   uuid NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  pillar_key text NOT NULL REFERENCES deia_pillars(key),
  PRIMARY KEY (asset_id, pillar_key)
);

-- ---- Agent personas (the six hats + Chief of Staff) ------------------
CREATE TABLE IF NOT EXISTS agent_personas (
  key             text PRIMARY KEY,
  label           text NOT NULL,                      -- human label, no system jargon
  role_source     text,                               -- the DEIA functional role it embodies
  scope           text,                               -- what it does
  default_autonomy text NOT NULL DEFAULT 'propose_only'
                   CHECK (default_autonomy IN ('act_then_report','propose_only','blocked')),
  gate_category_key text REFERENCES gate_categories(key),
  is_orchestrator boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  sort_order      int DEFAULT 100
);
INSERT INTO agent_personas(key,label,role_source,scope,default_autonomy,gate_category_key,is_orchestrator,sort_order) VALUES
  ('chief_of_staff','Chief of Staff','Orchestrator','Plans, delegates, synthesizes, reports; the consultant''s digital representative','act_then_report',NULL,true,0),
  ('strategy','Strategy','Strategist','DEIA roadmap tied to mission and risk; prioritization','propose_only','high_stakes',false,1),
  ('insight','Insight','Data Analyst','Representation/flow, equity gaps, sentiment — aggregate only','propose_only','low_confidence',false,2),
  ('learning_architect','Learning Architect','Learning Architect','Builds self-directed learning paths; measures behavior change','act_then_report','publication',false,3),
  ('change_adoption','Change & Adoption','Change Manager','Stakeholder/influence maps; adoption; unstick middle management','propose_only','high_stakes',false,4),
  ('ombuds_care','Ombuds & Care','Ombuds / Mediator','Confidential, trauma-informed navigation of exclusion/microaggressions','propose_only','named_individual',false,5),
  ('compliance_risk','Compliance & Risk','Compliance Officer','EEOC/ADA/Olmstead/Section 508; legal boundaries; reporting','propose_only','legal',false,6)
ON CONFLICT (key) DO NOTHING;

-- ---- Capabilities (core competencies) + mapping ---------------------
CREATE TABLE IF NOT EXISTS agent_capabilities (
  key text PRIMARY KEY, label text NOT NULL, description text
);
INSERT INTO agent_capabilities(key,label,description) VALUES
  ('business_acumen','Business / mission acumen','Frame initiatives in mission and operational terms, not only values'),
  ('data_fluency','Data-science fluency','Cohort/regression/significance methods — aggregate/division level only'),
  ('trauma_informed','Trauma-informed practice','Handle disclosures without re-traumatizing; protect boundaries'),
  ('conflict_navigation','Conflict navigation / radical candor','Coach resistance with data + Socratic method, without shaming')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS agent_persona_capabilities (
  persona_key    text NOT NULL REFERENCES agent_personas(key) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES agent_capabilities(key),
  PRIMARY KEY (persona_key, capability_key)
);
INSERT INTO agent_persona_capabilities(persona_key,capability_key) VALUES
  ('strategy','business_acumen'),('strategy','conflict_navigation'),
  ('insight','data_fluency'),('insight','business_acumen'),
  ('change_adoption','conflict_navigation'),('change_adoption','business_acumen'),
  ('ombuds_care','trauma_informed'),('ombuds_care','conflict_navigation'),
  ('chief_of_staff','business_acumen')
ON CONFLICT DO NOTHING;

-- ---- Domain knowledge scope (per persona) ---------------------------
CREATE TABLE IF NOT EXISTS agent_domains (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_key  text NOT NULL REFERENCES agent_personas(key) ON DELETE CASCADE,
  discipline_cluster text REFERENCES discipline_clusters(code),
  deia_pillar  text REFERENCES deia_pillars(key),
  note         text
);

-- ---- Agent memory (durable; sealed for the Ombuds/PII lane) ---------
CREATE TABLE IF NOT EXISTS agent_memory (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_key  text NOT NULL REFERENCES agent_personas(key) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('semantic','episodic','working','sealed')),
  content      text NOT NULL,
  -- sealed memory (Ombuds/consultation) never feeds analytics/corpus.
  sealed       boolean NOT NULL DEFAULT false,
  consent_scope text,                                 -- when memory derives from a person
  importance   int DEFAULT 0,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_memory_persona ON agent_memory(persona_key, kind);
COMMENT ON COLUMN agent_memory.sealed IS 'Sealed memory (Ombuds/consultation) must never feed aggregates, corpus, or other agents.';

-- ---- Delegation (Chief of Staff -> subagents) ----------------------
CREATE TABLE IF NOT EXISTS agent_delegations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_persona text REFERENCES agent_personas(key),
  child_persona  text NOT NULL REFERENCES agent_personas(key),
  task          text NOT NULL,
  autonomy_applied text NOT NULL CHECK (autonomy_applied IN ('act_then_report','propose_only','blocked')),
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','needs_approval','completed','blocked','failed')),
  approval_item_id uuid REFERENCES approval_items(id) ON DELETE SET NULL,
  trace_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_delegations_child ON agent_delegations(child_persona, status);

-- ---- Observability (append-only run log) ---------------------------
CREATE TABLE IF NOT EXISTS agent_run_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  persona_key  text REFERENCES agent_personas(key),
  delegation_id uuid REFERENCES agent_delegations(id) ON DELETE SET NULL,
  action       text NOT NULL,                          -- plan | tool_call | retrieve | research | synthesize | refuse | escalate
  tool         text,
  input_summary text,
  output_summary text,
  status       text,
  trace_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_run_events_trace ON agent_run_events(trace_id);

-- ---- Guardrails (the ethical tensions, as enforced rules) ----------
CREATE TABLE IF NOT EXISTS agent_guardrails (
  key   text PRIMARY KEY,
  label text NOT NULL,
  rule  text NOT NULL,
  hard  boolean NOT NULL DEFAULT true,                 -- hard = never overridable by autonomy dial
  active boolean NOT NULL DEFAULT true
);
INSERT INTO agent_guardrails(key,label,rule,hard) VALUES
  ('no_institutional_complicity','Surface, never bury','Equity/representation findings are logged and queued to the consultant; automation may not discard or soften them.',true),
  ('protect_from_emotional_tax','Route care, seal memory','Trauma/grief content routes to the Ombuds lane with sealed memory; it is never mined for analytics or shared across agents.',true),
  ('no_fabricated_business_case','No invented ROI','The system may present a mission/operational case but must never fabricate ROI or metrics; synthetic data must be labeled and validated.',true),
  ('stay_in_scope','Not the Chief Apology Officer','The system does not produce reactive public statements on societal events or claim authority it lacks; out-of-scope requests are refused and escalated.',true),
  ('aggregate_only','No surveillance','Insight/analytics operate at aggregate/division level only; never individual HR, discipline, or surveillance use.',true)
ON CONFLICT (key) DO NOTHING;

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  asset_deia_pillars, agent_domains, agent_memory, agent_delegations
TO one_dsd_app;
GRANT SELECT ON
  deia_pillars, agent_personas, agent_capabilities, agent_persona_capabilities, agent_guardrails
TO one_dsd_app;
-- Observability is append-only for the app role (integrity, like audit_events).
GRANT SELECT, INSERT ON agent_run_events TO one_dsd_app;
REVOKE UPDATE, DELETE ON agent_run_events FROM one_dsd_app;
REVOKE UPDATE, DELETE ON agent_run_events FROM PUBLIC;

INSERT INTO schema_migrations(version) VALUES ('0008_agent_framework') ON CONFLICT DO NOTHING;
COMMIT;
