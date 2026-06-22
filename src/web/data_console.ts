// =====================================================================
// One DSD vNext — console data layer (Layer 8)
// Queue + counts for the consultant operating surface. Authority/reviewer
// only (guarded at the route). Reads are plain; all WRITES go through the
// governance workflow (governance/approvals.ts) which audits + enforces.
// =====================================================================
import type { Db } from "../db.js";

export interface QueueRow {
  id: string;
  kind: string;
  state: string;
  asset_id: string | null;
  asset_title: string | null;
  gate_category_key: string | null;
  created_at: Date;
}

export interface ConsoleCounts {
  pending: number;
  inReview: number;
  consultationsOpen: number;
}

export async function fetchQueue(db: Db): Promise<QueueRow[]> {
  const { rows } = await db.query<QueueRow>(
    `SELECT ai.id, ai.kind, ai.state, ai.asset_id, ka.title AS asset_title,
            ai.gate_category_key, ai.created_at
       FROM approval_items ai
       LEFT JOIN knowledge_assets ka ON ka.id = ai.asset_id
      WHERE ai.state IN ('pending','in_review','changes_requested')
      ORDER BY ai.created_at ASC LIMIT 200`,
  );
  return rows;
}

export async function fetchCounts(db: Db): Promise<ConsoleCounts> {
  const { rows } = await db.query<{ pending: string; in_review: string; consults: string }>(
    `SELECT
       (SELECT count(*) FROM approval_items WHERE state IN ('pending','changes_requested'))::text AS pending,
       (SELECT count(*) FROM approval_items WHERE state = 'in_review')::text AS in_review,
       (SELECT count(*) FROM consultation_requests WHERE state <> 'closed')::text AS consults`,
  );
  const r = rows[0];
  return {
    pending: Number.parseInt(r?.pending ?? "0", 10),
    inReview: Number.parseInt(r?.in_review ?? "0", 10),
    consultationsOpen: Number.parseInt(r?.consults ?? "0", 10),
  };
}

export interface ReviewDetailRow {
  id: string;
  kind: string;
  state: string;
  gate_category_key: string | null;
  asset_id: string | null;
  asset_title: string | null;
  asset_summary: string | null;
  asset_body: string | null;
  asset_visibility: string | null;
  asset_state: string | null;
}

export async function fetchReviewDetail(
  db: Db,
  itemId: string,
): Promise<ReviewDetailRow | null> {
  const { rows } = await db.query<ReviewDetailRow>(
    `SELECT ai.id, ai.kind, ai.state, ai.gate_category_key,
            ai.asset_id, ka.title AS asset_title, ka.summary AS asset_summary,
            ka.body AS asset_body, ka.visibility AS asset_visibility,
            ka.approval_state AS asset_state
       FROM approval_items ai
       LEFT JOIN knowledge_assets ka ON ka.id = ai.asset_id
      WHERE ai.id = $1`,
    [itemId],
  );
  return rows[0] ?? null;
}
