// =====================================================================
// One DSD vNext — consultation workflow (Layer 8) — SANCTIONED PII ZONE.
// consultation_requests holds requester name/email (migration 0003 marks
// this the only PII zone). Access is authority-only and every read/triage
// is audited. This data must never flow into aggregates, the assistant
// corpus, or developmental memory — enforced by keeping it in dedicated
// functions that return only what a consultant needs, and never feeding it
// to retrieval/learning code paths.
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { audit, newTraceId } from "../audit/audit.js";

export interface ConsultationSummary {
  id: string;
  request_no: string | null;
  topic: string | null;
  state: string;
  created_at: Date;
}

export interface ConsultationDetail extends ConsultationSummary {
  requester_name: string | null;
  requester_email: string | null;
  body: string | null;
}

const AUTHORITY = new Set(["consultant", "admin"]);
function isAuthority(v: Viewer): boolean {
  return v.roles.some((r) => AUTHORITY.has(r));
}

export async function listConsultations(
  db: Db,
  viewer: Viewer,
): Promise<ConsultationSummary[] | null> {
  if (!isAuthority(viewer)) return null;
  const { rows } = await db.query<ConsultationSummary>(
    `SELECT id, request_no, topic, state, created_at
       FROM consultation_requests ORDER BY created_at DESC LIMIT 200`,
  );
  await audit(db, { actorId: viewer.userId, action: "consultation.list", traceId: newTraceId() });
  return rows;
}

export async function getConsultation(
  db: Db,
  viewer: Viewer,
  id: string,
): Promise<ConsultationDetail | null> {
  if (!isAuthority(viewer)) return null;
  const { rows } = await db.query<ConsultationDetail>(
    `SELECT id, request_no, topic, state, created_at,
            requester_name, requester_email, body
       FROM consultation_requests WHERE id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  // Reading PII is itself an audited event.
  await audit(db, {
    actorId: viewer.userId,
    action: "consultation.read_pii",
    target: `consultation:${id}`,
    traceId: newTraceId(),
  });
  return r;
}

export async function triage(
  db: Db,
  viewer: Viewer,
  id: string,
  state: "triaged" | "in_progress" | "closed",
): Promise<boolean> {
  if (!isAuthority(viewer)) return false;
  const res = await db.query(
    `UPDATE consultation_requests SET state = $2 WHERE id = $1`,
    [id, state],
  );
  await audit(db, {
    actorId: viewer.userId,
    action: "consultation.triage",
    target: `consultation:${id}`,
    detail: { state },
    traceId: newTraceId(),
  });
  return res.rowCount > 0;
}

export async function addNote(
  db: Db,
  viewer: Viewer,
  id: string,
  note: string,
): Promise<boolean> {
  if (!isAuthority(viewer)) return false;
  await db.query(
    `INSERT INTO consultation_notes (request_id, author_id, note) VALUES ($1, $2, $3)`,
    [id, viewer.userId, note],
  );
  await audit(db, {
    actorId: viewer.userId,
    action: "consultation.note",
    target: `consultation:${id}`,
    traceId: newTraceId(),
  });
  return true;
}
