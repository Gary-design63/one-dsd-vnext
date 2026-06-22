// =====================================================================
// One DSD vNext — growth/recommendation engine (Layer 11), DB-backed.
// Consent-gated end to end: with NO consent, nothing is generated or shown.
// Uses only the learner's OWN signals (their completed paths + declared
// interests). Writes suggestions to learning_recommendations (never
// assignments). Non-HR, non-surveillance.
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { audit, newTraceId } from "../audit/audit.js";
import { scoreRecommendations, type LearnerProfile, type PathCandidate, type Band, type Recommendation } from "./score.js";

const RECO_SCOPE = "personalized_recommendations";

export async function hasConsent(db: Db, userId: string, scope = RECO_SCOPE): Promise<boolean> {
  const { rows } = await db.query<{ granted: boolean }>(
    `SELECT granted FROM user_consents WHERE user_id = $1 AND scope = $2`, [userId, scope],
  );
  return rows[0]?.granted ?? false;
}

export async function setConsent(db: Db, viewer: Viewer, granted: boolean, scope = RECO_SCOPE): Promise<void> {
  await db.query(
    `INSERT INTO user_consents (user_id, scope, granted, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, scope) DO UPDATE SET granted = EXCLUDED.granted, updated_at = now()`,
    [viewer.userId, scope, granted],
  );
  await audit(db, { actorId: viewer.userId, action: "consent.set", detail: { scope, granted }, traceId: newTraceId() });
}

export async function getInterests(db: Db, userId: string): Promise<string[]> {
  const { rows } = await db.query<{ theme_key: string }>(
    `SELECT theme_key FROM user_interests WHERE user_id = $1`, [userId],
  );
  return rows.map((r) => r.theme_key);
}

export async function setInterests(db: Db, viewer: Viewer, themeKeys: string[]): Promise<void> {
  await db.tx(async (tx) => {
    await tx.query(`DELETE FROM user_interests WHERE user_id = $1`, [viewer.userId]);
    for (const k of themeKeys) {
      await tx.query(
        `INSERT INTO user_interests (user_id, theme_key) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`, [viewer.userId, k],
      );
    }
  });
}

async function buildProfile(db: Db, userId: string): Promise<LearnerProfile> {
  const interests = await getInterests(db, userId);
  const completed = await db.query<{ theme_key: string }>(
    `SELECT DISTINCT lpt.theme_key
       FROM learning_enrollments le
       JOIN learning_path_themes lpt ON lpt.path_id = le.path_id
      WHERE le.user_id = $1 AND le.state = 'completed'`,
    [userId],
  );
  const enrolled = await db.query<{ path_id: string }>(
    `SELECT path_id FROM learning_enrollments WHERE user_id = $1`, [userId],
  );
  const lvl = await db.query<{ band: string }>(
    `SELECT lp.proficiency_band AS band
       FROM learning_enrollments le JOIN learning_paths lp ON lp.id = le.path_id
      WHERE le.user_id = $1 AND le.state = 'completed' AND lp.proficiency_band IS NOT NULL
      ORDER BY CASE lp.proficiency_band WHEN 'advanced' THEN 3 WHEN 'applied' THEN 2 ELSE 1 END DESC
      LIMIT 1`,
    [userId],
  );
  const level = (lvl.rows[0]?.band as Band) ?? "emerging";
  return {
    interests,
    completedThemes: completed.rows.map((r) => r.theme_key),
    enrolledPathIds: enrolled.rows.map((r) => r.path_id),
    level,
  };
}

async function fetchCandidates(db: Db): Promise<PathCandidate[]> {
  const { rows } = await db.query<{ id: string; title: string; band: string | null; themes: string[] | null; n: string }>(
    `SELECT lp.id, lp.title, lp.proficiency_band AS band,
            array_remove(array_agg(lpt.theme_key), NULL) AS themes,
            count(lm.id)::text AS n
       FROM learning_paths lp
       LEFT JOIN learning_path_themes lpt ON lpt.path_id = lp.id
       LEFT JOIN learning_modules lm ON lm.path_id = lp.id
      WHERE lp.approval_state = 'approved' AND lp.visibility = 'staff'
      GROUP BY lp.id`,
  );
  return rows.map((r) => ({
    pathId: r.id, title: r.title,
    band: (r.band as Band) ?? "emerging",
    themes: r.themes ?? [],
    moduleCount: Number.parseInt(r.n, 10),
  }));
}

/** Generate suggestions IFF consented. Persists them as 'suggested'. */
export async function generate(db: Db, viewer: Viewer): Promise<Recommendation[] | null> {
  if (!(await hasConsent(db, viewer.userId))) return null; // consent gate
  const [profile, candidates] = await Promise.all([buildProfile(db, viewer.userId), fetchCandidates(db)]);
  const recs = scoreRecommendations(profile, candidates);
  for (const r of recs) {
    await db.query(
      `INSERT INTO learning_recommendations (user_id, path_id, rationale, signal_source, consent_granted, state)
       VALUES ($1, $2, $3, 'self_profile', true, 'suggested')
       ON CONFLICT DO NOTHING`,
      [viewer.userId, r.pathId, r.rationale],
    );
  }
  return recs;
}

export async function setRecommendationState(
  db: Db, viewer: Viewer, recoId: string, state: "accepted" | "dismissed", reason?: string | null,
): Promise<boolean> {
  const res = await db.query(
    `UPDATE learning_recommendations SET state = $3, dismissed_reason = $4
      WHERE id = $1 AND user_id = $2`,
    [recoId, viewer.userId, state, state === "dismissed" ? (reason ?? null) : null],
  );
  return res.rowCount > 0;
}

export interface ActiveReco { id: string; pathId: string | null; title: string; rationale: string | null; }

export async function fetchActiveRecommendations(db: Db, userId: string): Promise<ActiveReco[]> {
  const { rows } = await db.query<ActiveReco & { path_id: string | null }>(
    `SELECT lr.id, lr.path_id AS "pathId", COALESCE(lp.title, 'A learning path') AS title, lr.rationale
       FROM learning_recommendations lr
       LEFT JOIN learning_paths lp ON lp.id = lr.path_id
      WHERE lr.user_id = $1 AND lr.state = 'suggested'
      ORDER BY lr.created_at DESC LIMIT 8`,
    [userId],
  );
  return rows;
}
