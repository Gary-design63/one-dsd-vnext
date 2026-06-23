// =====================================================================
// One DSD vNext — console routes (Layer 8)
// All guarded: reviewer/consultant/admin may view; only authority roles
// satisfying the policy may decide/release (enforced in governance/*).
// Writes go through the audited workflow; nothing here mutates content
// directly.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { canOperateConsole, mayRelease } from "../governance/policy.js";
import { loadPolicy, decide, release } from "../governance/approvals.js";
import {
  listConsultations,
  getConsultation,
  triage,
  addNote,
} from "../governance/consultation.js";
import { fetchQueue, fetchCounts, fetchReviewDetail } from "./data_console.js";
import { renderConsoleHome } from "./pages/console/index.js";
import { renderReview } from "./pages/console/review.js";
import {
  renderConsultations,
  renderConsultationDetail,
} from "./pages/console/consultations.js";
import { readFormBody, sendHtml, redirect } from "../http/http.js";
import type { Decision } from "../governance/approvalState.js";

const DEFAULT_ACTION = "publish_or_release";

function forbidden(res: ServerResponse): void {
  sendHtml(res, 403, "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Forbidden</title></head><body><h1>Forbidden</h1><p>This area is for the consultant operating team.</p></body></html>");
}

export async function consoleHome(db: Db, viewer: Viewer, res: ServerResponse): Promise<void> {
  if (!canOperateConsole(viewer)) return forbidden(res);
  const [counts, queue] = await Promise.all([fetchCounts(db), fetchQueue(db)]);
  sendHtml(res, 200, renderConsoleHome({ nav: { viewer, active: "console" }, counts, queue }));
}

export async function reviewDetail(db: Db, viewer: Viewer, res: ServerResponse, id: string): Promise<void> {
  if (!canOperateConsole(viewer)) return forbidden(res);
  const item = await fetchReviewDetail(db, id);
  if (!item) {
    sendHtml(res, 404, renderConsoleHome({ nav: { viewer, active: "console" }, counts: { pending: 0, inReview: 0, consultationsOpen: 0 }, queue: [] }));
    return;
  }
  const policy = await loadPolicy(db, DEFAULT_ACTION);
  sendHtml(res, 200, renderReview({
    nav: { viewer, active: "console" },
    item,
    canDecide: mayRelease(viewer, policy),
    actionKind: DEFAULT_ACTION,
  }));
}

export async function reviewDecide(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!canOperateConsole(viewer)) return forbidden(res);
  const form = await readFormBody(req);
  const decision = form["decision"] as Decision | undefined;
  const actionKind = form["actionKind"] || DEFAULT_ACTION;
  const note = form["note"] ?? null;
  if (decision !== "approved" && decision !== "rejected" && decision !== "changes_requested") {
    return redirect(res, `/console/review/${id}`);
  }
  const result = await decide(db, viewer, id, decision, note, actionKind);
  if (!result.ok && result.code === 403) return forbidden(res);
  redirect(res, `/console/review/${id}`);
}

export async function reviewRelease(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!canOperateConsole(viewer)) return forbidden(res);
  const form = await readFormBody(req);
  const actionKind = form["actionKind"] || DEFAULT_ACTION;
  const result = await release(db, viewer, id, actionKind);
  if (!result.ok && result.code === 403) return forbidden(res);
  redirect(res, `/console/review/${id}`);
}

export async function consultationsIndex(db: Db, viewer: Viewer, res: ServerResponse): Promise<void> {
  const items = await listConsultations(db, viewer);
  if (items === null) return forbidden(res);
  sendHtml(res, 200, renderConsultations({ nav: { viewer, active: "console" }, items }));
}

export async function consultationDetail(db: Db, viewer: Viewer, res: ServerResponse, id: string): Promise<void> {
  const item = await getConsultation(db, viewer, id);
  if (item === null) return forbidden(res);
  sendHtml(res, 200, renderConsultationDetail({ nav: { viewer, active: "console" }, item }));
}

export async function consultationTriage(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const form = await readFormBody(req);
  const state = form["state"];
  if (state === "triaged" || state === "in_progress" || state === "closed") {
    const ok = await triage(db, viewer, id, state);
    if (!ok) return forbidden(res);
  }
  redirect(res, `/console/consultations/${id}`);
}

export async function consultationNote(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const form = await readFormBody(req);
  const note = (form["note"] ?? "").trim();
  if (note) {
    const ok = await addNote(db, viewer, id, note);
    if (!ok) return forbidden(res);
  }
  redirect(res, `/console/consultations/${id}`);
}

// --- Controls (Layer 10): consultant authority surface --------------
import { renderControls } from "./pages/console/controls.js";
import {
  getAutomationState, getCeiling, setAutomationState,
  recordOverride, listPersonas, recentOverrides,
  setCeiling, setPersonaAutonomy, activityLedger,
} from "../agents/controls.js";

export async function controlsPage(db: Db, viewer: Viewer, res: ServerResponse): Promise<void> {
  if (!canOperateConsole(viewer)) return forbidden(res);
  const [automationState, ceiling, personas, overrides, ledger] = await Promise.all([
    getAutomationState(db), getCeiling(db), listPersonas(db), recentOverrides(db), activityLedger(db),
  ]);
  sendHtml(res, 200, renderControls({ nav: { viewer, active: "console" }, automationState, ceiling, personas, overrides, ledger }));
}

export async function controlsSetAutomation(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const form = await readFormBody(req);
  const state = form["state"] === "paused" ? "paused" : "active";
  const ok = await setAutomationState(db, viewer, state);
  if (!ok) return forbidden(res);
  redirect(res, "/console/controls");
}

export async function controlsOverride(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const form = await readFormBody(req);
  const action = form["action"] as any;
  const valid = ["pause", "resume", "cancel", "override", "force"];
  if (!valid.includes(action)) return redirect(res, "/console/controls");
  const ok = await recordOverride(db, viewer, {
    targetKind: (form["targetKind"] as any) || "persona",
    targetKey: form["targetKey"] || null,
    action,
    reason: form["reason"] || null,
  });
  if (!ok) return forbidden(res);
  redirect(res, "/console/controls");
}

export async function controlsSetCeiling(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const form = await readFormBody(req);
  const ok = await setCeiling(db, viewer, String(form["value"] ?? ""));
  if (!ok) return forbidden(res);
  redirect(res, "/console/controls");
}

export async function controlsSetPersona(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const form = await readFormBody(req);
  const ok = await setPersonaAutonomy(db, viewer, String(form["key"] ?? ""), String(form["value"] ?? ""));
  if (!ok) return forbidden(res);
  redirect(res, "/console/controls");
}

// --- Revision history + rollback (authority-only) -------------------
import { renderHistory, type HistoryRowVM } from "./pages/console/history.js";
import {
  listHistory, rollback, describeItem, isAuthority,
  addNote as addHistoryNote,
} from "../editing/history.js";

function fmtAt(d: Date): string {
  try { return new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC"; }
  catch { return String(d); }
}
const HIST_STORES = new Set(["asset", "copy", "entity"]);

export async function historyPage(db: Db, viewer: Viewer, res: ServerResponse, url: URL): Promise<void> {
  if (!isAuthority(viewer)) return forbidden(res);
  const store = url.searchParams.get("store") ?? "asset";
  const id = (url.searchParams.get("id") ?? "").trim();
  const notice = url.searchParams.get("done") === "1" ? "Version restored. The change is recorded in the audit trail."
    : url.searchParams.get("noted") === "1" ? "Note added to the audit trail." : null;
  if (!id || !HIST_STORES.has(store)) {
    return sendHtml(res, 200, renderHistory({ nav: { viewer, active: "console" }, store, id: "", heading: "", currentPreview: null, rows: [], notice }));
  }
  const [{ heading, currentPreview }, raw] = await Promise.all([describeItem(db, store, id), listHistory(db, store, id)]);
  const rows: HistoryRowVM[] = raw.map((r) => ({ store: r.store, versionId: r.versionId, field: r.field, preview: r.preview, by: r.by, at: fmtAt(r.at) }));
  sendHtml(res, 200, renderHistory({ nav: { viewer, active: "console" }, store, id, heading, currentPreview, rows, notice }));
}

export async function historyRollback(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthority(viewer)) return forbidden(res);
  const form = await readFormBody(req);
  const store = form["store"] ?? "";
  const versionId = form["versionId"] ?? "";
  const returnStore = form["returnStore"] ?? store;
  const returnId = form["returnId"] ?? "";
  if (!HIST_STORES.has(store) || !versionId) return redirect(res, "/console/history");
  await rollback(db, viewer, store, versionId);
  redirect(res, `/console/history?store=${encodeURIComponent(returnStore)}&id=${encodeURIComponent(returnId)}&done=1`);
}

export async function historyNote(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthority(viewer)) return forbidden(res);
  const form = await readFormBody(req);
  const store = form["store"] ?? "asset";
  const id = (form["id"] ?? "").trim();
  const note = (form["note"] ?? "").trim();
  if (id && note) await addHistoryNote(db, viewer, `${store}:${id}`, note);
  redirect(res, `/console/history?store=${encodeURIComponent(store)}&id=${encodeURIComponent(id)}&noted=1`);
}
