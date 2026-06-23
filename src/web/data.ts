// =====================================================================
// One DSD vNext — page data layer (Layer 7)
// Gated reads for the server-rendered pages. EVERY content query routes
// through the Layer-6 fail-closed visibility gate (visibilitySqlClause /
// canRead). Pages never query the DB directly. Returns view-model shapes.
// =====================================================================
import type { Db } from "../db.js";
import {
  visibilitySqlClause,
  canRead,
  type Viewer,
} from "../access/visibility.js";
import type {
  AssetCard,
  AssetView,
  LibraryView,
  CalendarEntry,
  LearningIndexView,
  LearningPathView,
  JourneyDoor,
  AudioEpisodeVM,
  SurveyItemVM,
} from "./viewModels.js";

export interface LibraryQuery {
  q?: string;
  clusters?: string[];
  formats?: string[];
  proficiencies?: string[];
  limit: number;
  offset: number;
}

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
}

function toCard(r: AssetRow): AssetCard {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    format: r.format,
    proficiencyBand: r.proficiency_band,
    primaryTrack: r.primary_track,
    disciplineCluster: r.discipline_cluster,
  };
}

export async function fetchLibrary(
  db: Db,
  viewer: Viewer,
  q: LibraryQuery,
): Promise<{ items: AssetCard[]; total: number }> {
  const gate = visibilitySqlClause(viewer, 1);
  const params: unknown[] = [...gate.params];
  let where = gate.clause;
  let p = gate.nextParam;
  if (q.q) {
    where += ` AND a.title ILIKE $${p}`;
    params.push(`%${q.q}%`);
    p += 1;
  }
  if (q.clusters && q.clusters.length > 0) {
    where += ` AND a.discipline_cluster = ANY($${p})`;
    params.push(q.clusters);
    p += 1;
  }
  if (q.formats && q.formats.length > 0) {
    where += ` AND a.format = ANY($${p})`;
    params.push(q.formats);
    p += 1;
  }
  if (q.proficiencies && q.proficiencies.length > 0) {
    where += ` AND a.proficiency_band = ANY($${p})`;
    params.push(q.proficiencies);
    p += 1;
  }

  const countRes = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM knowledge_assets a WHERE ${where}`,
    params,
  );
  const total = Number.parseInt(countRes.rows[0]?.n ?? "0", 10);

  const listParams = [...params, q.limit, q.offset];
  const rows = await db.query<AssetRow>(
    `SELECT a.id, a.title, a.summary, a.format, a.proficiency_band,
            a.primary_track, a.discipline_cluster, a.visibility, a.approval_state
       FROM knowledge_assets a WHERE ${where}
      ORDER BY a.updated_at DESC LIMIT $${p} OFFSET $${p + 1}`,
    listParams,
  );
  return { items: rows.rows.map(toCard), total };
}

export async function fetchAsset(
  db: Db,
  viewer: Viewer,
  id: string,
): Promise<(AssetView["asset"]) | null> {
  const { rows } = await db.query<AssetRow & { body: string | null }>(
    `SELECT a.id, a.title, a.summary, a.body, a.format, a.proficiency_band,
            a.primary_track, a.discipline_cluster, a.visibility, a.approval_state
       FROM knowledge_assets a WHERE a.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  if (!canRead(viewer, { visibility: r.visibility, approvalState: r.approval_state })) {
    return null;
  }
  return { ...toCard(r), body: r.body };
}

export async function fetchFacets(
  db: Db,
  viewer: Viewer,
): Promise<LibraryView["facets"]> {
  const gate = visibilitySqlClause(viewer, 1);
  const clusterRows = await db.query<{ code: string; label: string; n: string }>(
    `SELECT dc.code, dc.label, count(a.id)::text AS n
       FROM discipline_clusters dc
       LEFT JOIN knowledge_assets a
         ON a.discipline_cluster = dc.code AND ${gate.clause}
      GROUP BY dc.code, dc.label ORDER BY dc.sort_order`,
    gate.params,
  );
  const cluster = clusterRows.rows.map((r) => ({
    key: r.code,
    label: r.label,
    count: Number.parseInt(r.n, 10),
  }));
  const format = ["resource", "brief", "scenario", "guide", "tool", "reference"].map((k) => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
  }));
  const proficiency = [
    { key: "emerging", label: "Emerging" },
    { key: "applied", label: "Applied" },
    { key: "advanced", label: "Advanced" },
  ];
  return { cluster, format, proficiency };
}

export async function fetchCalendar(
  db: Db,
  _viewer: Viewer,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ entries: CalendarEntry[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const countRes = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM calendar_events WHERE visibility = 'staff'`,
  );
  const total = Number.parseInt(countRes.rows[0]?.n ?? "0", 10);
  const { rows } = await db.query<{
    id: string;
    title: string;
    starts_on: string;
    kind: string;
    sensitivity: string | null;
    humility_note: string | null;
  }>(
    `SELECT ce.id, ce.title, to_char(ce.starts_on,'YYYY-MM-DD') AS starts_on,
            ce.kind, o.sensitivity, o.humility_note
       FROM calendar_events ce
       LEFT JOIN observances o ON o.id = ce.observance_id
      WHERE ce.visibility = 'staff'
      ORDER BY ce.starts_on ASC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const entries = rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsOn: r.starts_on,
    kind: r.kind,
    sensitivity: r.sensitivity ?? "standard",
    humilityNote: r.humility_note,
  }));
  return { entries, total };
}

export async function fetchLearningIndex(
  db: Db,
  _viewer: Viewer,
): Promise<LearningIndexView["paths"]> {
  const { rows } = await db.query<{
    id: string;
    title: string;
    summary: string | null;
    proficiency_band: string | null;
    n: string;
  }>(
    `SELECT lp.id, lp.title, lp.summary, lp.proficiency_band,
            count(lm.id)::text AS n
       FROM learning_paths lp
       LEFT JOIN learning_modules lm ON lm.path_id = lp.id
      WHERE lp.approval_state = 'approved' AND lp.visibility = 'staff'
      GROUP BY lp.id ORDER BY lp.sort_order, lp.title`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    proficiencyBand: r.proficiency_band,
    moduleCount: Number.parseInt(r.n, 10),
  }));
}

export async function fetchLearningPath(
  db: Db,
  _viewer: Viewer,
  pathId: string,
  userId: string,
): Promise<Omit<LearningPathView, "nav"> | null> {
  const head = await db.query<{
    id: string;
    title: string;
    summary: string | null;
    proficiency_band: string | null;
    idc_stage: string | null;
  }>(
    `SELECT id, title, summary, proficiency_band, idc_stage
       FROM learning_paths
      WHERE id = $1 AND approval_state = 'approved' AND visibility = 'staff'`,
    [pathId],
  );
  const path = head.rows[0];
  if (!path) return null;

  const mods = await db.query<{
    id: string;
    ordinal: number;
    title: string;
    kind: string;
    estimated_minutes: number | null;
    state: string | null;
  }>(
    `SELECT lm.id, lm.ordinal, lm.title, lm.kind, lm.estimated_minutes,
            mp.state
       FROM learning_modules lm
       LEFT JOIN learning_enrollments le
         ON le.path_id = lm.path_id AND le.user_id = $2
       LEFT JOIN module_progress mp
         ON mp.module_id = lm.id AND mp.enrollment_id = le.id
      WHERE lm.path_id = $1
      ORDER BY lm.ordinal ASC`,
    [pathId, userId],
  );

  const modules = mods.rows.map((m) => ({
    id: m.id,
    ordinal: m.ordinal,
    title: m.title,
    kind: (m.kind as LearningPathView["modules"][number]["kind"]) ?? "read",
    estimatedMinutes: m.estimated_minutes,
    state: (m.state as LearningPathView["modules"][number]["state"]) ?? "not_started",
  }));
  const completedCount = modules.filter((m) => m.state === "completed").length;

  return {
    path: {
      id: path.id,
      title: path.title,
      summary: path.summary,
      proficiencyBand: path.proficiency_band,
      idcStage: path.idc_stage,
    },
    modules,
    completedCount,
  };
}

/** Journey doors are curated program config (IDC-calibrated), not DB rows. */
export function journeyDoors(): JourneyDoor[] {
  return [
    {
      key: "orientation",
      label: "New here? Start with Orientation",
      description: "What this program is, how to use it, and where to begin.",
      href: "/learning",
    },
    {
      key: "everyday",
      label: "Everyday practice",
      description: "Plain-language guides and tools for day-to-day work.",
      href: "/library?proficiency=emerging",
      idcStage: "Minimization",
    },
    {
      key: "cultural",
      label: "Cultural intelligence",
      description: "Briefs and context to work respectfully across difference.",
      href: "/library?cluster=CIS",
      idcStage: "Acceptance",
    },
    {
      key: "leadership",
      label: "Leadership depth",
      description: "Advanced material for those building the bench.",
      href: "/library?proficiency=advanced",
      idcStage: "Adaptation",
    },
  ];
}

/** Approved, staff-visible podcast/audio episodes (newest first). */
export async function fetchPodcastEpisodes(
  db: Db,
  _viewer: Viewer,
): Promise<AudioEpisodeVM[]> {
  const { rows } = await db.query<{
    id: string; title: string; summary: string | null;
    episode_no: number | null; season_no: number | null;
    storage_url: string | null; duration_ms: number | null;
    has_audio: boolean;
  }>(
    `SELECT pe.id, pe.title, pe.summary, pe.episode_no, pe.season_no,
            ar.storage_url, ar.duration_ms,
            (ea.episode_id IS NOT NULL) AS has_audio
       FROM podcast_episodes pe
       LEFT JOIN audio_renders ar ON ar.id = pe.render_id AND ar.state = 'ready'
       LEFT JOIN episode_audio ea ON ea.episode_id = pe.id
      WHERE pe.approval_state = 'approved' AND pe.visibility = 'staff'
      ORDER BY pe.season_no DESC NULLS LAST, pe.episode_no DESC NULLS LAST, pe.created_at DESC
      LIMIT 200`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    episodeNo: r.episode_no,
    seasonNo: r.season_no,
    // Player shows when either a rendered storage URL exists or we have stored bytes.
    audioUrl: r.storage_url ?? (r.has_audio ? `/media/audio/${r.id}` : null),
    durationMin: r.duration_ms ? Math.round(r.duration_ms / 60000) : null,
  }));
}

/**
 * Surveys/reflections currently AVAILABLE to this staff member: only what the
 * consultant has distributed (state='open') and that targets all staff or has
 * invited this user. Respects "consultant distributes only" — staff never see
 * undistributed instruments. Response content is never read here.
 */
export async function fetchSurveys(
  db: Db,
  viewer: Viewer,
): Promise<SurveyItemVM[]> {
  const { rows } = await db.query<{
    id: string; title: string; description: string | null; kind: string;
    closes_at: string | null;
  }>(
    `SELECT i.id, i.title, i.description, i.kind,
            to_char(d.closes_at,'YYYY-MM-DD') AS closes_at
       FROM instrument_distributions d
       JOIN instruments i ON i.id = d.instrument_id
       LEFT JOIN instrument_invitations inv
         ON inv.distribution_id = d.id AND inv.user_id = $1
      WHERE d.state = 'open'
        AND (d.audience = 'all_staff' OR inv.user_id IS NOT NULL)
      ORDER BY d.opens_at DESC
      LIMIT 100`,
    [viewer.userId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    closesOn: r.closes_at,
  }));
}

/** Stored audio URL for one approved, staff-visible episode (or null). */
export async function fetchEpisodeMedia(
  db: Db,
  _viewer: Viewer,
  episodeId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ storage_url: string | null }>(
    `SELECT ar.storage_url
       FROM podcast_episodes pe
       JOIN audio_renders ar ON ar.id = pe.render_id AND ar.state = 'ready'
      WHERE pe.id = $1 AND pe.approval_state = 'approved' AND pe.visibility = 'staff'`,
    [episodeId],
  );
  return rows[0]?.storage_url ?? null;
}

/** In-database audio bytes for one approved, staff-visible episode (or null). */
export async function fetchEpisodeAudioBytes(
  db: Db,
  _viewer: Viewer,
  episodeId: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const { rows } = await db.query<{ audio: Buffer; mime_type: string | null }>(
    `SELECT ea.audio, ea.mime_type
       FROM podcast_episodes pe
       JOIN episode_audio ea ON ea.episode_id = pe.id
      WHERE pe.id = $1 AND pe.approval_state = 'approved' AND pe.visibility = 'staff'`,
    [episodeId],
  );
  const r = rows[0];
  if (!r) return null;
  return { bytes: r.audio, mime: r.mime_type ?? "audio/mpeg" };
}
