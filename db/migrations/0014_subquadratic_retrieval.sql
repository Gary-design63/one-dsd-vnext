-- =====================================================================
-- One DSD vNext — Migration 0014 — Sub-quadratic retrieval (HNSW + hybrid)
-- Makes KB search sub-quadratic and adds a GOVERNED hybrid function so the
-- agent harness never needs raw SQL:
--   - HNSW index on knowledge_embeddings (approx nearest neighbour, sub-linear)
--   - kb_hybrid_search(): RRF of full-text (keyword) + vector (semantic),
--     APPROVED + visibility-gated, exposed as ONE named function (allowlist).
-- Embedding dimension stays pinned at 384 (S0 decision); confirm against the
-- chosen embedding model when the key lands. Vector arm is inert until
-- embeddings exist; keyword arm works today.
-- =====================================================================
BEGIN;

-- Sub-quadratic ANN index. cosine distance matches our retrieval math.
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
  ON knowledge_embeddings USING hnsw (embedding vector_cosine_ops);

-- Governed hybrid search: keyword (FTS) + semantic (vector) fused by RRF.
-- q_embedding may be NULL (no embedder yet) -> degrades to keyword-only.
-- allowed_visibilities is passed by the Node tier from the visibility gate.
CREATE OR REPLACE FUNCTION kb_hybrid_search(
  q_text text,
  q_embedding vector(384),
  allowed_visibilities text[],
  k int DEFAULT 8
)
RETURNS TABLE (chunk_id uuid, asset_id uuid, title text, content text, score double precision)
LANGUAGE sql STABLE AS $$
  WITH kw AS (
    SELECT c.id AS chunk_id,
           row_number() OVER (
             ORDER BY ts_rank(to_tsvector('english', c.content),
                              websearch_to_tsquery('english', q_text)) DESC
           ) AS rnk
    FROM knowledge_chunks c
    JOIN knowledge_assets a ON a.id = c.asset_id
    WHERE a.approval_state = 'approved' AND a.archived_at IS NULL
      AND a.visibility = ANY(allowed_visibilities)
      AND to_tsvector('english', c.content) @@ websearch_to_tsquery('english', q_text)
    LIMIT (k * 4)
  ),
  sem AS (
    SELECT c.id AS chunk_id,
           row_number() OVER (ORDER BY e.embedding <=> q_embedding) AS rnk
    FROM knowledge_chunks c
    JOIN knowledge_embeddings e ON e.chunk_id = c.id
    JOIN knowledge_assets a ON a.id = c.asset_id
    WHERE q_embedding IS NOT NULL
      AND a.approval_state = 'approved' AND a.archived_at IS NULL
      AND a.visibility = ANY(allowed_visibilities)
    ORDER BY e.embedding <=> q_embedding
    LIMIT (k * 4)
  ),
  fused AS (
    SELECT COALESCE(kw.chunk_id, sem.chunk_id) AS chunk_id,
           COALESCE(1.0 / (60 + kw.rnk), 0) + COALESCE(1.0 / (60 + sem.rnk), 0) AS score
    FROM kw FULL OUTER JOIN sem ON kw.chunk_id = sem.chunk_id
  )
  SELECT c.id, c.asset_id, a.title, c.content, f.score
  FROM fused f
  JOIN knowledge_chunks c ON c.id = f.chunk_id
  JOIN knowledge_assets a ON a.id = c.asset_id
  ORDER BY f.score DESC
  LIMIT k;
$$;

-- Allowlist: app may execute the named function; never arbitrary SQL.
GRANT EXECUTE ON FUNCTION kb_hybrid_search(text, vector, text[], int) TO one_dsd_app;

INSERT INTO schema_migrations(version) VALUES ('0014_subquadratic_retrieval') ON CONFLICT DO NOTHING;
COMMIT;
