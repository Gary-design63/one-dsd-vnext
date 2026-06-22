// =====================================================================
// One DSD vNext — in-place edit API (authority-only, versioned, audited).
// POST /api/edit/:kind/:id  { fields:{...} }   (kind ∈ registry allowlist)
// POST /api/edit/copy/:key   { value }
// Tables/columns come only from the registry (never user input). Each save
// snapshots the prior value (knowledge_versions for assets, edit_history for
// others, site_copy_versions for page copy) then updates + audits.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db.js";
import { requireRole } from "../auth/middleware.js";
import { readJsonBody, sendJson } from "../http/http.js";
import { audit, newTraceId } from "../audit/audit.js";
import { getEntity, validateEntityPatch } from "../editing/registry.js";
import { validateCopy } from "../editing/edit.js";

const AUTHORITY = ["consultant", "admin"];
const HAS_UPDATED_AT = new Set(["knowledge_assets", "learning_paths"]);

export async function handleEditEntity(
  db: Db, req: IncomingMessage, res: ServerResponse, kind: string, id: string,
): Promise<void> {
  const viewer = await requireRole(db, req, res, AUTHORITY);
  if (!viewer) return;
  const spec = getEntity(kind);
  if (!spec) return sendJson(res, 404, { error: "unknown_entity" });

  let body: { fields?: unknown } | null;
  try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { error: "invalid_request" }); }
  const v = validateEntityPatch(kind, body?.fields);
  if (!v.ok) return sendJson(res, 400, { error: v.reason });

  const keys = Object.keys(v.fields);
  const trace = newTraceId();
  const result = await db.tx(async (tx) => {
    const cur = await tx.query<Record<string, string | null>>(
      `SELECT ${keys.join(", ")} FROM ${spec.table} WHERE ${spec.idCol} = $1`, [id],
    );
    if (cur.rows.length === 0) return { ok: false as const };
    const old = cur.rows[0]!;

    // snapshot prior values
    if (spec.versionTable === "knowledge_versions") {
      await tx.query(
        `INSERT INTO knowledge_versions (asset_id, body, note, created_by)
         VALUES ($1, $2, 'in-place edit snapshot', $3)`,
        [id, old["body"] ?? null, viewer.userId],
      );
    } else {
      for (const k of keys) {
        await tx.query(
          `INSERT INTO edit_history (entity_kind, entity_id, field, old_value, edited_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [kind, id, k, old[k] ?? null, viewer.userId],
        );
      }
    }

    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    if (HAS_UPDATED_AT.has(spec.table)) sets.push("updated_at = now()");
    await tx.query(
      `UPDATE ${spec.table} SET ${sets.join(", ")} WHERE ${spec.idCol} = $1`,
      [id, ...keys.map((k) => v.fields[k]!)],
    );
    await audit(tx, { actorId: viewer.userId, action: "content.edit", target: `${kind}:${id}`, detail: { fields: keys }, traceId: trace });
    return { ok: true as const };
  });
  if (!result.ok) return sendJson(res, 404, { error: "not_found" });
  sendJson(res, 200, { ok: true });
}

export async function handleEditCopy(
  db: Db, req: IncomingMessage, res: ServerResponse, key: string,
): Promise<void> {
  const viewer = await requireRole(db, req, res, AUTHORITY);
  if (!viewer) return;
  let body: { value?: unknown } | null;
  try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { error: "invalid_request" }); }
  const v = validateCopy(body?.value);
  if (!v.ok) return sendJson(res, 400, { error: v.reason });

  const trace = newTraceId();
  await db.tx(async (tx) => {
    const cur = await tx.query<{ value: string }>(`SELECT value FROM site_copy WHERE key = $1`, [key]);
    if (cur.rows[0]) {
      await tx.query(`INSERT INTO site_copy_versions (key, value, edited_by) VALUES ($1,$2,$3)`,
        [key, cur.rows[0].value, viewer.userId]);
    }
    await tx.query(
      `INSERT INTO site_copy (key, value, updated_by, updated_at) VALUES ($1,$2,$3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, v.fields.value, viewer.userId],
    );
    await audit(tx, { actorId: viewer.userId, action: "copy.edit", target: `copy:${key}`, traceId: trace });
  });
  sendJson(res, 200, { ok: true });
}
