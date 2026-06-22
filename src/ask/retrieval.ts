// =====================================================================
// One DSD vNext — retrieval (Layer 9), DB-backed.
// KB-first hybrid retrieval over APPROVED, viewer-visible chunks. Uses
// Postgres full-text (keyword) now; the vector arm activates automatically
// when embeddings exist (0002 knowledge_embeddings). Always visibility-gated.
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { allowedVisibilities } from "../access/visibility.js";
import { normalize } from "./fusion.js";
import type { Candidate } from "./types.js";

const TOP_N = 8;

interface Row {
  chunk_id: string;
  asset_id: string;
  title: string;
  visibility: string;
  content: string;
  fts: number;
}

/** Keyword retrieval over approved + visible chunks. Returns Candidates with
 *  normalized fts as hybrid (vector arm contributes 0 until embeddings land). */
export async function retrieve(
  db: Db,
  viewer: Viewer,
  question: string,
): Promise<Candidate[]> {
  const vis = allowedVisibilities(viewer);
  if (vis.length === 0 || question.trim().length === 0) return [];

  const { rows } = await db.query<Row>(
    `SELECT c.id AS chunk_id, c.asset_id, a.title, a.visibility, c.content,
            ts_rank(to_tsvector('english', c.content),
                    plainto_tsquery('english', $1)) AS fts
       FROM knowledge_chunks c
       JOIN knowledge_assets a ON a.id = c.asset_id
      WHERE a.approval_state = 'approved'
        AND a.archived_at IS NULL
        AND a.visibility = ANY($2)
        AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
      ORDER BY fts DESC
      LIMIT $3`,
    [question, vis, TOP_N],
  );

  const norm = normalize(rows.map((r) => Number(r.fts)));
  return rows.map((r, i) => ({
    chunkId: r.chunk_id,
    assetId: r.asset_id,
    title: r.title,
    visibility: r.visibility,
    content: r.content,
    ftsScore: norm[i] ?? 0,
    vectorScore: 0,
    hybrid: norm[i] ?? 0,
  }));
}
