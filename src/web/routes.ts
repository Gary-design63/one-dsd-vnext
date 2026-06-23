// =====================================================================
// One DSD vNext — web routes (Layer 7)
// Maps page requests to gated data + render functions. Unauthenticated
// page requests redirect to /sign-in (internal staff surface). The HTML
// routes share the Layer-6 session/gate; they never bypass it.
// =====================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Db } from "../db.js";
import { loadConfig } from "../config.js";
import { currentViewer } from "../auth/middleware.js";
import { login } from "../auth/login.js";
import { createSession, revokeSession } from "../auth/session.js";
import {
  readFormBody,
  readFormMulti,
  sendHtml,
  redirect,
  parseCookies,
  setCookie,
  clearCookie,
  clientIp,
} from "../http/http.js";
import type { Viewer } from "../access/visibility.js";
import { canEdit } from "../editing/edit.js";
import { loadCopy } from "./copy.js";
import { signMediaUrl } from "../media/sign.js";
import { renderHome } from "./pages/home.js";
import { renderSignIn } from "./pages/signin.js";
import { renderLibrary } from "./pages/library.js";
import { renderAsset } from "./pages/asset.js";
import { renderLearningIndex, renderLearningPath } from "./pages/learning.js";
import { renderCalendar } from "./pages/calendar.js";
import { renderAudio } from "./pages/audio.js";
import { renderSurveys } from "./pages/surveys.js";
import {
  fetchLibrary,
  fetchAsset,
  fetchFacets,
  fetchCalendar,
  fetchLearningIndex,
  fetchLearningPath,
  fetchPodcastEpisodes,
  fetchEpisodeMedia,
  fetchEpisodeAudioBytes,
  fetchSurveys,
  journeyDoors,
} from "./data.js";

function multi(url: URL, key: string): string[] {
  return url.searchParams.getAll(key).filter((s) => s.length > 0);
}

export async function handleSignInGet(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const viewer = await currentViewer(db, req);
  if (viewer) return redirect(res, "/");
  sendHtml(res, 200, renderSignIn({ returnTo: url.searchParams.get("returnTo") }));
}

export async function handleSignInPost(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const cfg = loadConfig();
  const form = await readFormBody(req);
  const identifier = (form["identifier"] ?? "").trim();
  const password = form["password"] ?? "";
  const returnTo = sanitizeReturnTo(form["returnTo"]);
  if (!identifier || !password) {
    sendHtml(res, 400, renderSignIn({ error: "Enter your username and password.", returnTo }));
    return;
  }
  const result = await login(db, {
    identifier,
    password,
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] ?? null,
  });
  if (!result.ok) {
    const msg =
      result.reason === "locked_out"
        ? "Too many attempts. Please wait a few minutes and try again."
        : "Those credentials did not match. Please try again.";
    sendHtml(res, result.reason === "locked_out" ? 429 : 401, renderSignIn({ error: msg, returnTo }));
    return;
  }
  setCookie(res, cfg.cookieName, result.token, {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: "Lax",
    maxAgeSeconds: cfg.sessionAbsoluteMinutes * 60,
  });
  redirect(res, returnTo ?? "/");
}

export async function handleSignOut(
  db: Db,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const cfg = loadConfig();
  const token = parseCookies(req)[cfg.cookieName];
  if (token) await revokeSession(db, token);
  clearCookie(res, cfg.cookieName);
  redirect(res, "/sign-in");
}

export async function handleHome(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  edit = false,
): Promise<void> {
  const editMode = edit && canEdit(viewer);
  const { items } = await fetchLibrary(db, viewer, { limit: 6, offset: 0 });
  const copyRows = await db.query<{ key: string; value: string }>(
    `SELECT key, value FROM site_copy WHERE key LIKE 'home.hero.%'`,
  );
  const copy = new Map(copyRows.rows.map((r) => [r.key, r.value]));
  sendHtml(res, 200, renderHome({
    nav: { viewer, active: "home" },
    editMode,
    heroEyebrow: copy.get("home.hero.eyebrow"),
    heroTitle: copy.get("home.hero.title"),
    heroLede: copy.get("home.hero.lede"),
    doors: journeyDoors(),
    featured: items,
  }));
}

export async function handleLibrary(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  url: URL,
  edit = false,
): Promise<void> {
  const editMode = edit && canEdit(viewer);
  const q = url.searchParams.get("q") ?? undefined;
  const clusters = multi(url, "cluster");
  const formats = multi(url, "format");
  const proficiencies = multi(url, "proficiency");
  const limit = 25;
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const [{ items, total }, facetsRaw, copy] = await Promise.all([
    fetchLibrary(db, viewer, { q, clusters, formats, proficiencies, limit, offset }),
    fetchFacets(db, viewer),
    loadCopy(db, "library.intro."),
  ]);
  const mark = (opts: { key: string; label: string; count?: number }[], sel: string[]) =>
    opts.map((o) => ({ ...o, selected: sel.includes(o.key) }));

  sendHtml(res, 200, renderLibrary({
    nav: { viewer, active: "library" },
    editMode,
    copy,
    items,
    total,
    limit,
    offset,
    query: q,
    facets: {
      cluster: mark(facetsRaw.cluster, clusters),
      format: mark(facetsRaw.format, formats),
      proficiency: mark(facetsRaw.proficiency, proficiencies),
    },
  }));
}

export async function handleAsset(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  id: string,
  editRequested = false,
): Promise<void> {
  const asset = await fetchAsset(db, viewer, id);
  if (!asset) {
    sendHtml(res, 404, renderSignIn({ error: "That item was not found." }));
    return;
  }
  const editable = editRequested && canEdit(viewer);
  sendHtml(res, 200, renderAsset({ nav: { viewer, active: "library" }, asset, editable }));
}

export async function handleLearningIndex(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  edit = false,
): Promise<void> {
  const [paths, copy] = await Promise.all([fetchLearningIndex(db, viewer), loadCopy(db, "learning.intro.")]);
  sendHtml(res, 200, renderLearningIndex({ nav: { viewer, active: "learning" }, editMode: edit && canEdit(viewer), copy, paths }));
}

export async function handleLearningPath(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  id: string,
  edit = false,
): Promise<void> {
  const data = await fetchLearningPath(db, viewer, id, viewer.userId);
  if (!data) {
    sendHtml(res, 404, renderLearningIndex({ nav: { viewer, active: "learning" }, paths: [] }));
    return;
  }
  sendHtml(res, 200, renderLearningPath({ nav: { viewer, active: "learning" }, editMode: edit && canEdit(viewer), ...data }));
}

export async function handleCalendar(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  edit = false,
  url?: URL,
): Promise<void> {
  const limit = 50;
  const offset = Math.max(0, Number.parseInt(url?.searchParams.get("offset") ?? "0", 10) || 0);
  const [{ entries, total }, copy] = await Promise.all([
    fetchCalendar(db, viewer, { limit, offset }),
    loadCopy(db, "calendar.intro."),
  ]);
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  sendHtml(res, 200, renderCalendar({ nav: { viewer, active: "calendar" }, editMode: edit && canEdit(viewer), copy, entries, monthLabel, total, limit, offset }));
}

export async function handleAudio(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  edit = false,
): Promise<void> {
  const [episodes, copy] = await Promise.all([fetchPodcastEpisodes(db, viewer), loadCopy(db, "audio.intro.")]);
  sendHtml(res, 200, renderAudio({ nav: { viewer, active: "audio" }, editMode: edit && canEdit(viewer), copy, episodes }));
}

export async function handleSurveys(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  edit = false,
): Promise<void> {
  const [items, copy] = await Promise.all([fetchSurveys(db, viewer), loadCopy(db, "surveys.intro.")]);
  sendHtml(res, 200, renderSurveys({ nav: { viewer, active: "surveys" }, editMode: edit && canEdit(viewer), copy, items }));
}

export async function handleAudioMedia(
  db: Db,
  viewer: Viewer,
  res: ServerResponse,
  episodeId: string,
): Promise<void> {
  // Prefer streaming in-database audio bytes (imported episodes) when present.
  const stored = await fetchEpisodeAudioBytes(db, viewer, episodeId);
  if (stored) {
    res.statusCode = 200;
    res.setHeader("Content-Type", stored.mime);
    res.setHeader("Content-Length", String(stored.bytes.length));
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("Cache-Control", "private, no-store");
    res.end(stored.bytes);
    return;
  }
  const url = await fetchEpisodeMedia(db, viewer, episodeId);
  if (!url) { res.statusCode = 404; res.end("Not found"); return; }
  // No token in the page; the deliverable URL is minted here, short-lived.
  res.statusCode = 302;
  res.setHeader("Location", signMediaUrl(url, 300));
  res.setHeader("Cache-Control", "private, no-store");
  res.end();
}

function sanitizeReturnTo(v: string | undefined): string | null {
  // Only allow same-origin absolute paths; never an external URL.
  if (!v) return null;
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

// --- Ask (Professional Support) ------------------------------------
import { renderAsk, renderAskResult } from "./pages/ask.js";
import { ask } from "../ask/answer.js";

export async function handleAskGet(db: Db, viewer: Viewer, res: ServerResponse, edit = false): Promise<void> {
  const editMode = edit && canEdit(viewer);
  const copy = await loadCopy(db, "ask.intro.");
  sendHtml(res, 200, renderAsk({ viewer, active: "ask" }, { editMode, copy }));
}

export async function handleAskPost(
  db: Db,
  viewer: Viewer,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const form = await readFormBody(req);
  const question = (form["question"] ?? "").trim();
  if (!question) return redirect(res, "/ask");
  const result = await ask(db, { viewer, question: question.slice(0, 2000) });
  sendHtml(res, 200, renderAskResult({ viewer, active: "ask" }, question, result));
}

// --- Growth (Layer 11): personalized, consent-gated -----------------
import { renderGrowth, type ThemeOption } from "./pages/growth.js";
import {
  hasConsent, setConsent, getInterests, setInterests,
  generate, fetchActiveRecommendations, setRecommendationState,
} from "../reco/engine.js";

async function themeOptions(db: Db, userId: string): Promise<ThemeOption[]> {
  const [{ rows }, mine] = await Promise.all([
    db.query<{ key: string; label: string }>(`SELECT key, label FROM program_themes ORDER BY sort_order`),
    getInterests(db, userId),
  ]);
  const sel = new Set(mine);
  return rows.map((r) => ({ key: r.key, label: r.label, selected: sel.has(r.key) }));
}

export async function handleGrowthGet(db: Db, viewer: Viewer, res: ServerResponse, edit = false): Promise<void> {
  const editMode = edit && canEdit(viewer);
  const copy = await loadCopy(db, "growth.intro.");
  const consented = await hasConsent(db, viewer.userId);
  if (!consented) {
    sendHtml(res, 200, renderGrowth({ nav: { viewer }, consented: false, recommendations: [], themes: [], editMode, copy }));
    return;
  }
  await generate(db, viewer); // refresh suggestions (consent already checked)
  const [recommendations, themes] = await Promise.all([
    fetchActiveRecommendations(db, viewer.userId),
    themeOptions(db, viewer.userId),
  ]);
  sendHtml(res, 200, renderGrowth({ nav: { viewer }, consented: true, recommendations, themes, editMode, copy }));
}

export async function handleGrowthConsent(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const form = await readFormBody(req);
  await setConsent(db, viewer, form["granted"] === "true");
  redirect(res, "/growth");
}

export async function handleGrowthInterests(db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const form = await readFormMulti(req);
  await setInterests(db, viewer, form["theme"] ?? []);
  redirect(res, "/growth");
}

export async function handleRecoAction(
  db: Db, viewer: Viewer, req: IncomingMessage, res: ServerResponse, recoId: string, action: "accept" | "dismiss",
): Promise<void> {
  await setRecommendationState(db, viewer, recoId, action === "accept" ? "accepted" : "dismissed");
  redirect(res, "/growth");
}
