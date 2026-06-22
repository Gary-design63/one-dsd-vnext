// =====================================================================
// One DSD vNext — revision history + rollback (authority).
// Reads the version stores written by in-place editing and lets the
// consultant inspect, annotate, and ROLL BACK. Rollback is itself
// reversible (it snapshots the current value before restoring) and audited.
// Stores: asset -> knowledge_versions(body) ; copy -> site_copy_versions ;
// other content -> edit_history(field, old_value).
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { audit, newTraceId } from "../audit/audit.js";
import { getEntity } from "./registry.js";

const AUTHORITY = new Set(["consultant", "admin"]);
export function isAuthority(v: Viewer): boolean { return v.roles.some((r) => AUTHORITY.has(r)); }

export interface HistoryRow {
  store: "asset" | "copy" | "entity";
  versionId: string;     // id used to roll back to this snapshot
  field: string;         // 'body' | copy key | entity field
  preview: string;       // the snapshotted (prior) value, trimmed
  by: string | null;
  at: Date;
}

function trim(s: string | null, n = 240): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/** Unified change log for one item (most recent first). */
export async function listHistory(db: Db, store: string, id: string): Promise<HistoryRow[]> {
  if (store === "asset") {
    const { rows } = await db.query<{ id: string; body: string | null; created_by: string | null; created_at: Date }>(
      `SELECT id::text, body, created_by::text, created_at FROM knowledge_versions
        WHERE asset_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]);
    return rows.map((r) => ({ store: "asset", versionId: r.id, field: "body", preview: trim(r.body), by: r.created_by, at: r.created_at }));
  }
  if (store === "copy") {
    const { rows } = await db.query<{ id: string; value: string; edited_by: string | null; created_at: Date }>(
      `SELECT id::text, value, edited_by::text, created_at FROM site_copy_versions
        WHERE key = $1 ORDER BY created_at DESC LIMIT 100`, [id]);
    return rows.map((r) => ({ store: "copy", versionId: r.id, field: id, preview: trim(r.value), by: r.edited_by, at: r.created_at }));
  }
  // entity (learning_path/module, calendar_event, collection) — id is "kind:entityId"
  const [kind, entityId] = id.split(":");
  const { rows } = await db.query<{ id: string; field: string; old_value: string | null; edited_by: string | null; created_at: Date }>(
    `SELECT id::text, field, old_value, edited_by::text, created_at FROM edit_history
      WHERE entity_kind = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 100`, [kind, entityId]);
  return rows.map((r) => ({ store: "entity", versionId: r.id, field: r.field, preview: trim(r.old_value), by: r.edited_by, at: r.created_at }));
}

/** Restore a prior snapshot. Snapshots the current value first (reversible). */
export async function rollback(
  db: Db, viewer: Viewer, store: string, versionId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isAuthority(viewer)) return { ok: false, reason: "not authorized" };
  const trace = newTraceId();
  return db.tx(async (tx) => {
    if (store === "asset") {
      const v = await tx.query<{ asset_id: string; body: string | null }>(
        `SELECT asset_id::text, body FROM knowledge_versions WHERE id = $1`, [versionId]);
      const row = v.rows[0]; if (!row) return { ok: false, reason: "version not found" };
      const cur = await tx.query<{ body: string | null }>(`SELECT body FROM knowledge_assets WHERE id = $1`, [row.asset_id]);
      await tx.query(`INSERT INTO knowledge_versions (asset_id, body, note, created_by) VALUES ($1,$2,'pre-rollback snapshot',$3)`,
        [row.asset_id, cur.rows[0]?.body ?? null, viewer.userId]);
      await tx.query(`UPDATE knowledge_assets SET body = $2, updated_at = now() WHERE id = $1`, [row.asset_id, row.body]);
      await audit(tx, { actorId: viewer.userId, action: "content.rollback", target: `asset:${row.asset_id}`, traceId: trace });
      return { ok: true };
    }
    if (store === "copy") {
      const v = await tx.query<{ key: string; value: string }>(`SELECT key, value FROM site_copy_versions WHERE id = $1`, [versionId]);
      const row = v.rows[0]; if (!row) return { ok: false, reason: "version not found" };
      const cur = await tx.query<{ value: string }>(`SELECT value FROM site_copy WHERE key = $1`, [row.key]);
      if (cur.rows[0]) await tx.query(`INSERT INTO site_copy_versions (key, value, edited_by) VALUES ($1,$2,$3)`, [row.key, cur.rows[0].value, viewer.userId]);
      await tx.query(`UPDATE site_copy SET value = $2, updated_by = $3, updated_at = now() WHERE key = $1`, [row.key, row.value, viewer.userId]);
      await audit(tx, { actorId: viewer.userId, action: "copy.rollback", target: `copy:${row.key}`, traceId: trace });
      return { ok: true };
    }
    // entity
    const v = await tx.query<{ entity_kind: string; entity_id: string; field: string; old_value: string | null }>(
      `SELECT entity_kind, entity_id, field, old_value FROM edit_history WHERE id = $1`, [versionId]);
    const row = v.rows[0]; if (!row) return { ok: false, reason: "version not found" };
    const spec = getEntity(row.entity_kind);
    if (!spec || !(row.field in spec.fields)) return { ok: false, reason: "field not editable" };
    const cur = await tx.query<Record<string, string | null>>(`SELECT ${row.field} FROM ${spec.table} WHERE ${spec.idCol} = $1`, [row.entity_id]);
    await tx.query(`INSERT INTO edit_history (entity_kind, entity_id, field, old_value, edited_by) VALUES ($1,$2,$3,$4,$5)`,
      [row.entity_kind, row.entity_id, row.field, cur.rows[0]?.[row.field] ?? null, viewer.userId]);
    await tx.query(`UPDATE ${spec.table} SET ${row.field} = $2 WHERE ${spec.idCol} = $1`, [row.entity_id, row.old_value]);
    await audit(tx, { actorId: viewer.userId, action: "content.rollback", target: `${row.entity_kind}:${row.entity_id}`, traceId: trace });
    return { ok: true };
  });
}

/** Add a consultant note to an item's audit trail (no content change). */
export async function addNote(db: Db, viewer: Viewer, target: string, note: string): Promise<boolean> {
  if (!isAuthority(viewer) || !note.trim()) return false;
  await audit(db, { actorId: viewer.userId, action: "content.note", target, detail: { note: note.trim() }, traceId: newTraceId() });
  return true;
}

/** Current live value + a human heading for the history surface. */
export async function describeItem(
  db: Db, store: string, id: string,
): Promise<{ heading: string; currentPreview: string | null }> {
  if (store === "asset") {
    const { rows } = await db.query<{ title: string; body: string | null }>(
      `SELECT title, body FROM knowledge_assets WHERE id = $1`, [id]);
    const r = rows[0];
    return { heading: r?.title ?? id, currentPreview: trim(r?.body ?? null) };
  }
  if (store === "copy") {
    const { rows } = await db.query<{ value: string }>(`SELECT value FROM site_copy WHERE key = $1`, [id]);
    return { heading: id, currentPreview: trim(rows[0]?.value ?? null) };
  }
  return { heading: id, currentPreview: null };
}
