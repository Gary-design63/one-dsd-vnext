// =====================================================================
// One DSD vNext — recommendation scoring (Layer 11) — PURE.
// Suggests learning paths from a learner's OWN signals (their progress,
// their declared interests). Transparent: every suggestion carries a plain
// rationale. Suggestions only — never assignments. No cross-person data,
// no cross-person or evaluative inputs. Deterministic + testable.
// =====================================================================
export type Band = "emerging" | "applied" | "advanced";

export interface LearnerProfile {
  interests: string[];            // theme keys the learner chose
  completedThemes: string[];      // themes they've completed paths in (own progress)
  enrolledPathIds: string[];      // already enrolled — don't re-suggest
  level: Band;                    // self-paced current band
}

export interface PathCandidate {
  pathId: string;
  title: string;
  themes: string[];
  band: Band;
  moduleCount: number;
}

export interface Recommendation {
  pathId: string;
  title: string;
  score: number;       // 0..1
  rationale: string;   // shown to the learner
}

const BAND_RANK: Record<Band, number> = { emerging: 0, applied: 1, advanced: 2 };

export function scoreRecommendations(
  profile: LearnerProfile,
  candidates: readonly PathCandidate[],
  limit = 5,
): Recommendation[] {
  const interests = new Set(profile.interests);
  const done = new Set(profile.completedThemes);
  const enrolled = new Set(profile.enrolledPathIds);

  const recs: Recommendation[] = [];
  for (const c of candidates) {
    if (enrolled.has(c.pathId)) continue;

    const reasons: string[] = [];
    let score = 0;

    const matchedInterests = c.themes.filter((t) => interests.has(t));
    if (matchedInterests.length > 0) {
      score += 0.5;
      reasons.push(`matches your interest in ${matchedInterests.join(", ")}`);
    }

    // proficiency fit: same band best; one step up is a stretch goal.
    const diff = BAND_RANK[c.band] - BAND_RANK[profile.level];
    if (diff === 0) { score += 0.3; reasons.push(`fits your current level (${c.band})`); }
    else if (diff === 1) { score += 0.2; reasons.push(`a next step up to ${c.band}`); }
    else if (diff < 0) { score += 0.05; reasons.push(`a refresher at ${c.band}`); }

    // coverage gap: a theme the learner hasn't completed yet.
    const newThemes = c.themes.filter((t) => !done.has(t));
    if (newThemes.length > 0) { score += 0.15; reasons.push(`broadens into ${newThemes.length} new area${newThemes.length === 1 ? "" : "s"}`); }

    if (score <= 0) continue;
    recs.push({
      pathId: c.pathId,
      title: c.title,
      score: Math.min(1, score),
      rationale: reasons.join("; ") + ".",
    });
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, limit);
}
