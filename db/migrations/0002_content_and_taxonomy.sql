-- =====================================================================
-- One DSD vNext — Migration 0002 — Content, Taxonomy, Retrieval
-- Realizes the Layer-4 IA faceting spine. Brain schema used as reference only.
-- =====================================================================
BEGIN;

-- ---- Reference vocabularies (the program model) ----------------------
CREATE TABLE IF NOT EXISTS discipline_clusters (
  code text PRIMARY KEY, label text NOT NULL, sort_order int DEFAULT 100
);
INSERT INTO discipline_clusters(code,label,sort_order) VALUES
  ('SBS','Social & Behavioral Sciences',1),('CIS','Critical & Identity Studies',2),
  ('HUM','Humanities',3),('EDU','Education & Learning Sciences',4),
  ('COM','Communication & Media',5),('LAW','Law, Policy & Governance',6),
  ('HRC','Health, Rehabilitation & Clinical Sciences',7),
  ('ORG','Organizational, Workforce & Community Practice',8),
  ('DTD','Design, Technology, Data & Environment',9)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS disciplines (
  code text PRIMARY KEY, cluster_code text REFERENCES discipline_clusters(code),
  label text NOT NULL, sort_order int DEFAULT 100
);  -- full 81 rows migrated from the brain in the content-migration step

CREATE TABLE IF NOT EXISTS idc_stages (
  key text PRIMARY KEY, label text NOT NULL, orientation_group text, sort_order int DEFAULT 100
);
INSERT INTO idc_stages(key,label,orientation_group,sort_order) VALUES
  ('denial','Denial','monocultural',1),('polarization','Polarization (Defense/Reversal)','transitional',2),
  ('minimization','Minimization','transitional',3),('acceptance','Acceptance','intercultural',4),
  ('adaptation','Adaptation','intercultural',5)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS delivery_tracks (
  key text PRIMARY KEY, label text NOT NULL, idc_anchor text, sort_order int DEFAULT 100
);
INSERT INTO delivery_tracks(key,label,idc_anchor,sort_order) VALUES
  ('all_staff','Universal — All staff',NULL,0),
  ('denial_onramp','Track 0 — Denial on-ramp','denial',1),
  ('polarization_threat_reduction','Track A — Polarization threat-reduction','polarization',2),
  ('minimization_main','Track B — Minimization main effort','minimization',3),
  ('acceptance_bench','Track C — Acceptance bench','acceptance',4),
  ('adaptation_vanguard','Track D — Adaptation vanguard','adaptation',5)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS personas (
  key text PRIMARY KEY, label text NOT NULL, sort_order int DEFAULT 100
);
INSERT INTO personas(key,label,sort_order) VALUES
  ('leadership','Division leadership (director / deputy)',1),('program_administrator','Program administrator',2),
  ('manager','Manager',3),('supervisor','Supervisor',4),('frontline_worker','Frontline worker',5),
  ('fiscal_analyst','Fiscal analyst',6),('data_analyst','Data / analytics analyst',7),
  ('policy_analyst','Policy / legislative analyst',8),('engagement_lead','Engagement / community lead',9),
  ('trainer_facilitator','Trainer / facilitator',10),('all_staff','All staff',11),
  ('certified_assessor','MnCHOICES certified assessor',12),('case_manager','Case manager / care coordinator',13),
  ('waiver_policy_specialist','Waiver / policy specialist',14),('lead_agency_liaison','Lead-agency liaison (county / Tribal)',15),
  ('administrative_support','Administrative support',16),('student_worker','Student worker / intern',17)
ON CONFLICT (key) DO NOTHING;

-- ---- Knowledge assets (faceted) --------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  summary           text,
  body              text,
  -- facets (Layer-4 spine)
  format            text CHECK (format IN ('resource','brief','scenario','guide','tool','reference')),
  proficiency_band  text CHECK (proficiency_band IN ('emerging','applied','advanced')),
  primary_track     text REFERENCES delivery_tracks(key),
  discipline_cluster text REFERENCES discipline_clusters(code),
  discipline_primary text REFERENCES disciplines(code),
  eaae_phase        text,
  modalities        text[] DEFAULT '{}',
  tags              text[] DEFAULT '{}',
  -- governance
  visibility        text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('staff','consultant','internal')),
  approval_state    text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','pending_review','approved','archived')),
  current_version_id uuid,
  approved_by       uuid REFERENCES users(id),
  approved_at       timestamptz,
  archived_at       timestamptz,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_state_vis ON knowledge_assets(approval_state, visibility);
CREATE INDEX IF NOT EXISTS idx_assets_title_trgm ON knowledge_assets USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_assets_cluster ON knowledge_assets(discipline_cluster);

CREATE TABLE IF NOT EXISTS asset_personas (
  asset_id   uuid NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  persona_key text NOT NULL REFERENCES personas(key),
  PRIMARY KEY (asset_id, persona_key)
);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   uuid NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  body       text,
  note       text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   uuid NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  ordinal    int NOT NULL,
  content    text NOT NULL,
  token_count int
);
CREATE INDEX IF NOT EXISTS idx_chunks_asset ON knowledge_chunks(asset_id);
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON knowledge_chunks USING gin (to_tsvector('english', content));

-- Embedding dimension is pinned by the S0 model decision; default 384 (gte-small class).
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  chunk_id   uuid PRIMARY KEY REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  model      text NOT NULL,
  dimensions int NOT NULL,
  embedding  vector(384) NOT NULL
);

-- ---- Collections / journeys (curated doors) --------------------------
CREATE TABLE IF NOT EXISTS collections (
  key            text PRIMARY KEY, label text NOT NULL, description text,
  is_journey_door boolean NOT NULL DEFAULT false, sort_order int DEFAULT 100
);
INSERT INTO collections(key,label,is_journey_door,sort_order) VALUES
  ('general','General Library',false,0),('cultural_briefs','Cultural Briefs',false,1),
  ('equity_toolkits','Equity Toolkits',false,2),('orientation','New Staff Orientation',true,3),
  ('leadership_learning','Leadership Learning',true,4)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS collection_members (
  collection_key text NOT NULL REFERENCES collections(key),
  asset_id       uuid NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  sort_order     int DEFAULT 100, featured boolean DEFAULT false,
  PRIMARY KEY (collection_key, asset_id)
);

-- ---- Provenance ------------------------------------------------------
CREATE TABLE IF NOT EXISTS provenance_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid NOT NULL REFERENCES knowledge_assets(id) ON DELETE CASCADE,
  source      text, source_ref text, method text, note text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Retrieval read surface (approved + non-archived) ----------------
CREATE OR REPLACE VIEW retrievable_chunks AS
  SELECT c.id AS chunk_id, c.asset_id, c.content, a.title, a.visibility
  FROM knowledge_chunks c JOIN knowledge_assets a ON a.id = c.asset_id
  WHERE a.approval_state = 'approved' AND a.archived_at IS NULL;

-- ---- Grants ----------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  knowledge_assets, asset_personas, knowledge_versions, knowledge_chunks,
  knowledge_embeddings, collections, collection_members, provenance_records
TO one_dsd_app;
GRANT SELECT ON discipline_clusters, disciplines, idc_stages, delivery_tracks, personas, retrievable_chunks TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0002_content_and_taxonomy') ON CONFLICT DO NOTHING;
COMMIT;
