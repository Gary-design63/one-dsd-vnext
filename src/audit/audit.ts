// =====================================================================
// One DSD vNext — append-only audit writer (Layer 6)
// Writes to audit_events (migration 0003), which the app role can only
// INSERT/SELECT — never UPDATE/DELETE (enforced at the grant level).
// Every governed action and every access decision worth tracing goes here.
// =====================================================================
import { randomUUID } from "node:crypto";
import type { Db } from "../db.js";

export interface AuditEntry {
  actorId?: string | null;
  action: string; // e.g. 'login_success', 'content.read', 'gate.denied'
  target?: string | null; // e.g. 'asset:<uuid>'
  detail?: Record<string, unknown> | null;
  traceId?: string | null;
}

export async function audit(db: Db, entry: AuditEntry): Promise<void> {
  await db.query(
    `INSERT INTO audit_events (actor_id, action, target, detail, trace_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      entry.actorId ?? null,
      entry.action,
      entry.target ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null,
      entry.traceId ?? null,
    ],
  );
}

/** A correlation id for one request, threaded into every audit row it makes. */
export function newTraceId(): string {
  return randomUUID();
}
