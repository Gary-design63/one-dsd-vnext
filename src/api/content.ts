// =====================================================================
// One DSD vNext — content delivery API (Layer 6)
// Library list + single-asset read. EVERY query is constrained by the
// fail-closed visibility gate (access/visibility.ts); handlers never write
// their own visibility WHERE clause. Reads are audited at the asset level
// so access is always traceable.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { sendJson } from "../http/http.js";
import { audit, newTraceId } from "../audit/audit.js";
import {
  visibilitySqlClause,
  canRead,
  type Viewer,
} from "../access/visibility.js";

interface AssetRow {
  id: string;
  title: string;
  summary: string | null;
  format: string | null;
  proficiency_band: string | null;
  primary_track: string | null;
  discipline_cluster: string | null;
  visibility: string;
  approval_state: string;
  updated_at: Date;
}

const MAX_LIMIT = 100;

/** GET /api/library?limit=&offset=&cluster= */
export async function listLibrary(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const viewer = await requireAuth(db, req, res);
  if (!viewer) return;

  const limit = clampInt(url.searchParams.get("limit"), 25, 1, MAX_LIMIT);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 100_000);
  const cluster = url.searchParams.get("cluster");

  const gate = visibilitySqlClause(viewer, 1);
  const params: unknown[] = [...gate.params];
  let where = gate.clause;
  let p = gate.nextParam;
  if (cluster) {
    where += ` AND a.discipline_cluster = $${p}`;
    params.push(cluster);
    p += 1;
  }
  params.push(limit, offset);

  const sql = `
    SELECT a.id, a.title, a.summary, a.format, a.proficiency_band,
           a.primary_track, a.discipline_cluster, a.visibility,
           a.approval_state, a.updated_at
      FROM knowledge_assets a
     WHERE ${where}
     ORDER BY a.updated_at DESC
     LIMIT $${p} OFFSET $${p + 1}`;
  const { rows } = await db.query<AssetRow>(sql, params);

  sendJson(res, 200, { items: rows.map(toListItem), limit, offset });
}

/** GET /api/library/:id */
export async function getAsset(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
): Promise<void> {
  const viewer = await requireAuth(db, req, res);
  if (!viewer) return;

  const { rows } = await db.query<AssetRow & { body: string | null }>(
    `SELECT a.id, a.title, a.summary, a.body, a.format, a.proficiency_band,
            a.primary_track, a.discipline_cluster, a.visibility,
            a.approval_state, a.updated_at
       FROM knowledge_assets a WHERE a.id = $1`,
    [id],
  );
  const row = rows[0];

  // Fail-closed second check in code, even though we could filter in SQL:
  // defense in depth. A 404 (not 403) avoids leaking existence.
  if (!row || !canRead(viewer, { visibility: row.visibility, approvalState: row.approval_state })) {
    await auditDenied(db, viewer, id);
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  await audit(db, {
    actorId: viewer.userId,
    action: "content.read",
    target: `asset:${id}`,
    traceId: newTraceId(),
  });
  sendJson(res, 200, { item: { ...toListItem(row), body: row.body } });
}

async function auditDenied(db: Db, viewer: Viewer, id: string): Promise<void> {
  await audit(db, {
    actorId: viewer.userId,
    action: "gate.denied",
    target: `asset:${id}`,
    traceId: newTraceId(),
  });
}

function toListItem(r: AssetRow): Record<string, unknown> {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    format: r.format,
    proficiencyBand: r.proficiency_band,
    primaryTrack: r.primary_track,
    disciplineCluster: r.discipline_cluster,
    visibility: r.visibility,
    approvalState: r.approval_state,
    updatedAt: r.updated_at,
  };
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
