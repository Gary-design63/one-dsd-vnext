-- =====================================================================
-- One DSD vNext — Migration 0007 — Assistant (governed RAG): Ask
-- The "Ask One DSD" / Professional Support surface. Models the governed
-- pipeline: KB-first retrieval → confidence/sufficiency gate → answer or
-- refusal/escalation → optional agentic research (Layer 10) → citations.
-- Everything is logged for the eval harness (Layer 9) and audit (0003).
-- NOTE: schema is provider-agnostic; the generation model/key is wired in
-- Layer 9. These tables capture the SHAPE, not an active LLM call.
-- =====================================================================
BEGIN;

-- ---- Ask sessions (a conversation thread) ----------------------------
CREATE TABLE IF NOT EXISTS ask_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  title         text,
  visibility    text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('staff','consultant','internal')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ask_sessions_user ON ask_sessions(user_id);

-- ---- Messages (turns) ------------------------------------------------
CREATE TABLE IF NOT EXISTS ask_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES ask_sessions(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('user','assistant','system')),
  content       text NOT NULL,
  -- governance outcome of an assistant turn
  disposition   text CHECK (disposition IN ('answered','refused','escalated','insufficient_source','research_pending')),
  confidence    numeric(4,3),                          -- 0.000–1.000 sufficiency score
  model         text,                                  -- generation model used (null until Layer 9)
  latency_ms    int,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ask_messages_session ON ask_messages(session_id);

-- ---- Retrieval records (what KB chunks fed an answer) ----------------
-- One row per retrieved chunk per assistant turn → full traceability +
-- the eval harness can score citation accuracy and visibility leaks.
CREATE TABLE IF NOT EXISTS ask_retrievals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES ask_messages(id) ON DELETE CASCADE,
  chunk_id      uuid REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
  asset_id      uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  rank          int,
  vector_score  numeric,
  fts_score     numeric,
  hybrid_score  numeric,
  cited         boolean NOT NULL DEFAULT false,        -- did the answer actually cite it
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ask_retrievals_message ON ask_retrievals(message_id);

-- ---- Citations surfaced to the user (resolved, user-facing) ----------
CREATE TABLE IF NOT EXISTS ask_citations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES ask_messages(id) ON DELETE CASCADE,
  asset_id      uuid REFERENCES knowledge_assets(id) ON DELETE SET NULL,
  label         text,                                  -- display label
  source_kind   text NOT NULL DEFAULT 'corpus' CHECK (source_kind IN ('corpus','external')),
  external_url  text,                                  -- only when source_kind='external' (Layer 10)
  resolved      boolean NOT NULL DEFAULT true,         -- citation-integrity loop flips this
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---- Agentic research requests (Layer 10 hook) -----------------------
-- When KB is insufficient, the Chief-of-Staff may spawn external research.
-- Low-risk proceeds; high-impact routes to the 0003 approval queue.
CREATE TABLE IF NOT EXISTS research_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid REFERENCES ask_messages(id) ON DELETE SET NULL,
  question      text NOT NULL,
  providers     text[] DEFAULT '{}',                   -- e.g. {perplexity,scholar}
  risk_level    text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  state         text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','needs_approval','completed','blocked','failed')),
  uses_synthetic_data boolean NOT NULL DEFAULT false,  -- scenarios/testing only, never factual evidence
  approval_item_id uuid REFERENCES approval_items(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
COMMENT ON COLUMN research_requests.uses_synthetic_data IS 'Synthetic data permitted for scenarios/testing only; never as factual evidence or citation.';

CREATE TABLE IF NOT EXISTS research_findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES research_requests(id) ON DELETE CASCADE,
  provider      text,
  title         text,
  url           text,
  excerpt       text,
  verified      boolean NOT NULL DEFAULT false,        -- citation verified before use
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---- Eval harness (Layer 9): gold set + run scores -------------------
CREATE TABLE IF NOT EXISTS eval_gold_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt        text NOT NULL,
  expected_behavior text,                              -- answer | refuse | escalate
  expected_assets uuid[] DEFAULT '{}',                 -- assets that SHOULD be cited
  notes         text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text,
  git_ref       text,
  citation_accuracy numeric(4,3),
  refusal_quality   numeric(4,3),
  tone_fit          numeric(4,3),
  visibility_leaks  int DEFAULT 0,                      -- must be 0 to pass
  passed        boolean,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  gold_item_id  uuid NOT NULL REFERENCES eval_gold_items(id) ON DELETE CASCADE,
  observed_behavior text,
  citation_match numeric(4,3),
  leaked        boolean NOT NULL DEFAULT false,
  detail        jsonb,
  UNIQUE (run_id, gold_item_id)
);

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  ask_sessions, ask_messages, ask_retrievals, ask_citations,
  research_requests, research_findings,
  eval_gold_items, eval_runs, eval_results
TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0007_assistant') ON CONFLICT DO NOTHING;
COMMIT;
