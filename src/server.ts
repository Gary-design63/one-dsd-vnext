// =====================================================================
// One DSD vNext — HTTP server (Layers 6 + 7 + 8)
// Framework-free router. Security headers on every response.
// API (JSON, L6): /api/auth/*, /api/library[/:id]
// Web (HTML, L7): /, /sign-in, /library[/:id], /learning[/:id], /calendar
// Console (HTML, L8): /console, /console/review/:id[/decide|/release],
//                     /console/consultations[/:id[/triage|/note]]
// Staff/console pages require a session; the console is authority-guarded
// inside its handlers. All content reads route through the L6 gate.
// =====================================================================
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadConfig } from "./config.js";
import { getDb, closeDb } from "./db.js";
import { randomUUID } from "node:crypto";
import { applySecurityHeaders } from "./security/headers.js";
import { log, captureError } from "./obs/log.js";
import { sendJson, redirect, clientIp } from "./http/http.js";
import { rateLimit, LIMITS } from "./security/ratelimit.js";
import { handleLogin, handleLogout, handleMe } from "./api/auth_routes.js";
import { listLibrary, getAsset } from "./api/content.js";
import { handleAsk } from "./api/ask_routes.js";
import { handleEditEntity, handleEditCopy } from "./api/edit_routes.js";
import { currentViewer } from "./auth/middleware.js";
import { serveStatic } from "./web/staticFiles.js";
import {
  handleSignInGet,
  handleSignInPost,
  handleSignOut,
  handleHome,
  handleLibrary,
  handleAsset,
  handleLearningIndex,
  handleLearningPath,
  handleCalendar,
  handleAudio,
  handleAudioMedia,
  handleSurveys,
  handleAskGet,
  handleAskPost,
  handleGrowthGet,
  handleGrowthConsent,
  handleGrowthInterests,
  handleRecoAction,
} from "./web/routes.js";
import {
  consoleHome,
  reviewDetail,
  reviewDecide,
  reviewRelease,
  consultationsIndex,
  consultationDetail,
  consultationTriage,
  consultationNote,
  controlsPage,
  controlsSetAutomation,
  controlsOverride,
  historyPage,
  historyRollback,
  historyNote,
} from "./web/console_routes.js";

const UUID = "[0-9a-fA-F-]{36}";
const API_LIBRARY_ITEM = new RegExp(`^/api/library/(${UUID})$`);
const WEB_LIBRARY_ITEM = new RegExp(`^/library/(${UUID})$`);
const WEB_LEARNING_ITEM = new RegExp(`^/learning/(${UUID})$`);
const C_REVIEW = new RegExp(`^/console/review/(${UUID})$`);
const C_REVIEW_DECIDE = new RegExp(`^/console/review/(${UUID})/decide$`);
const C_REVIEW_RELEASE = new RegExp(`^/console/review/(${UUID})/release$`);
const C_CONSULT = new RegExp(`^/console/consultations/(${UUID})$`);
const C_CONSULT_TRIAGE = new RegExp(`^/console/consultations/(${UUID})/triage$`);
const C_CONSULT_NOTE = new RegExp(`^/console/consultations/(${UUID})/note$`);
const GROWTH_RECO = new RegExp(`^/growth/reco/(${UUID})/(accept|dismiss)$`);
const MEDIA_AUDIO = new RegExp(`^/media/audio/(${UUID})$`);
const API_EDIT_COPY = /^\/api\/edit\/copy\/([a-zA-Z0-9._-]+)$/;
const API_EDIT_ENTITY = /^\/api\/edit\/([a-z_]+)\/([^/]+)$/;

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = getDb();
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";
  const ip = clientIp(req) ?? "?";
  const limited = (key: string, pol: { limit: number; windowMs: number }): boolean => {
    const r = rateLimit(key, pol.limit, pol.windowMs);
    if (!r.ok) { res.setHeader("Retry-After", String(r.retryAfterSec)); sendJson(res, 429, { error: "rate_limited", retryAfterSec: r.retryAfterSec }); return true; }
    return false;
  };

  // --- unauthenticated ----------------------------------------------
  if (method === "GET" && path === "/healthz") return sendJson(res, 200, { status: "ok" });
  if (path.startsWith("/static/") && method === "GET") return serveStatic(res, path, url.searchParams.has("v"));
  if (path === "/sign-in" && method === "GET") return handleSignInGet(db, req, res, url);
  if (path === "/sign-in" && method === "POST") { if (limited(`signin:${ip}`, LIMITS.signIn)) return; return handleSignInPost(db, req, res); }
  if (path === "/sign-out" && method === "POST") return handleSignOut(db, req, res);

  // --- API (JSON; guards inside handlers) ---------------------------
  if (path === "/api/auth/login" && method === "POST") return handleLogin(db, req, res);
  if (path === "/api/auth/logout" && method === "POST") return handleLogout(db, req, res);
  if (path === "/api/auth/me" && method === "GET") return handleMe(db, req, res);
  if (path === "/api/ask" && method === "POST") { if (limited(`ask:${ip}`, LIMITS.ask)) return; return handleAsk(db, req, res); }
  { const e = API_EDIT_COPY.exec(path); if (e && method === "POST") return handleEditCopy(db, req, res, e[1]!); }
  { const e = API_EDIT_ENTITY.exec(path); if (e && method === "POST") return handleEditEntity(db, req, res, e[1]!, e[2]!); }
  if (path === "/api/library" && method === "GET") return listLibrary(db, req, res, url);
  {
    const m = API_LIBRARY_ITEM.exec(path);
    if (m && method === "GET") return getAsset(db, req, res, m[1]!);
  }

  // --- authenticated HTML (staff + console) -------------------------
  if (isAppPage(path, method)) {
    const viewer = await currentViewer(db, req);
    if (!viewer) {
      return redirect(res, `/sign-in?returnTo=${encodeURIComponent(req.url ?? "/")}`);
    }

    // staff surface (GET)
    if (method === "GET") {
      const editFlag = url.searchParams.get("edit") === "1";
      if (path === "/") return handleHome(db, viewer, res, editFlag);
      if (path === "/library") return handleLibrary(db, viewer, res, url, editFlag);
      if (path === "/learning") return handleLearningIndex(db, viewer, res, editFlag);
      if (path === "/calendar") return handleCalendar(db, viewer, res, editFlag, url);
      if (path === "/audio") return handleAudio(db, viewer, res, editFlag);
      if (path === "/surveys") return handleSurveys(db, viewer, res, editFlag);
      { const ma = MEDIA_AUDIO.exec(path); if (ma) return handleAudioMedia(db, viewer, res, ma[1]!); }
      if (path === "/ask") return handleAskGet(db, viewer, res, editFlag);
      if (path === "/growth") return handleGrowthGet(db, viewer, res, editFlag);
      const li = WEB_LIBRARY_ITEM.exec(path);
      if (li) return handleAsset(db, viewer, res, li[1]!, url.searchParams.get("edit") === "1");
      const pi = WEB_LEARNING_ITEM.exec(path);
      if (pi) return handleLearningPath(db, viewer, res, pi[1]!, editFlag);

      // console (GET)
      if (path === "/console") return consoleHome(db, viewer, res);
      if (path === "/console/consultations") return consultationsIndex(db, viewer, res);
      if (path === "/console/controls") return controlsPage(db, viewer, res);
      if (path === "/console/history") return historyPage(db, viewer, res, url);
      const rv = C_REVIEW.exec(path);
      if (rv) return reviewDetail(db, viewer, res, rv[1]!);
      const cd = C_CONSULT.exec(path);
      if (cd) return consultationDetail(db, viewer, res, cd[1]!);
    }

    // ask + console actions (POST)
    if (method === "POST") {
      if (path === "/ask") { if (limited(`ask:${ip}`, LIMITS.ask)) return; return handleAskPost(db, viewer, req, res); }
      if (path === "/growth/consent") return handleGrowthConsent(db, viewer, req, res);
      if (path === "/growth/interests") return handleGrowthInterests(db, viewer, req, res);
      { const g = GROWTH_RECO.exec(path); if (g) return handleRecoAction(db, viewer, req, res, g[1]!, g[2] as "accept" | "dismiss"); }
      if (path === "/console/controls/automation") return controlsSetAutomation(db, viewer, req, res);
      if (path === "/console/controls/override") return controlsOverride(db, viewer, req, res);
      if (path === "/console/history/rollback") return historyRollback(db, viewer, req, res);
      if (path === "/console/history/note") return historyNote(db, viewer, req, res);
      const dec = C_REVIEW_DECIDE.exec(path);
      if (dec) return reviewDecide(db, viewer, req, res, dec[1]!);
      const rel = C_REVIEW_RELEASE.exec(path);
      if (rel) return reviewRelease(db, viewer, req, res, rel[1]!);
      const tri = C_CONSULT_TRIAGE.exec(path);
      if (tri) return consultationTriage(db, viewer, req, res, tri[1]!);
      const nt = C_CONSULT_NOTE.exec(path);
      if (nt) return consultationNote(db, viewer, req, res, nt[1]!);
    }
  }

  sendJson(res, 404, { error: "not_found" });
}

function isAppPage(path: string, method: string): boolean {
  if (method === "GET") {
    if (path === "/" || path === "/library" || path === "/learning" || path === "/calendar" || path === "/ask" || path === "/growth" || path === "/audio" || path === "/surveys") return true;
    if (path === "/console" || path === "/console/consultations" || path === "/console/controls" || path === "/console/history") return true;
    if (WEB_LIBRARY_ITEM.test(path) || WEB_LEARNING_ITEM.test(path)) return true;
    if (MEDIA_AUDIO.test(path)) return true;
    if (C_REVIEW.test(path) || C_CONSULT.test(path)) return true;
    return false;
  }
  if (method === "POST") {
    return (
      path === "/ask" ||
      path === "/growth/consent" ||
      path === "/growth/interests" ||
      GROWTH_RECO.test(path) ||
      path === "/console/controls/automation" ||
      path === "/console/controls/override" ||
      path === "/console/history/rollback" ||
      path === "/console/history/note" ||
      C_REVIEW_DECIDE.test(path) ||
      C_REVIEW_RELEASE.test(path) ||
      C_CONSULT_TRIAGE.test(path) ||
      C_CONSULT_NOTE.test(path)
    );
  }
  return false;
}

function handler(req: IncomingMessage, res: ServerResponse): void {
  applySecurityHeaders(res);
  const start = Date.now();
  const reqId = randomUUID();
  res.setHeader("X-Request-Id", reqId);
  const pathname = (() => { try { return new URL(req.url ?? "/", "http://localhost").pathname; } catch { return req.url ?? "/"; } })();
  res.on("finish", () => {
    log("info", "request", { id: reqId, method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - start });
  });
  route(req, res).catch((err: unknown) => {
    if (!res.headersSent) sendJson(res, 500, { error: "internal_error" });
    else res.end();
    captureError(err, { id: reqId, method: req.method, path: pathname });
  });
}

export function createApp() {
  return createServer(handler);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const cfg = loadConfig();
  const server = createApp();
  server.listen(cfg.port, () => {
    console.log(`One DSD vNext listening on :${cfg.port} (${cfg.env})`);
  });
  const shutdown = async (): Promise<void> => {
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
