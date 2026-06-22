// =====================================================================
// One DSD vNext — score fusion (Layer 9) — PURE.
// Combines keyword (FTS) and semantic (vector) retrieval via Reciprocal
// Rank Fusion + a normalized blend, so the system works today on FTS alone
// (vector weight 0) and improves automatically when embeddings exist.
// =====================================================================
export interface Ranked {
  id: string;
  ftsRank?: number;    // 1-based position in FTS results (lower better)
  vectorRank?: number; // 1-based position in vector results
  ftsScore?: number;   // raw, optional
  vectorScore?: number;
}

const RRF_K = 60;

/** Reciprocal Rank Fusion: robust, scale-free combination of two rankings. */
export function reciprocalRankFusion(
  items: readonly Ranked[],
  weights: { fts: number; vector: number } = { fts: 1, vector: 1 },
): { id: string; score: number }[] {
  return items
    .map((it) => {
      const f = it.ftsRank ? weights.fts / (RRF_K + it.ftsRank) : 0;
      const v = it.vectorRank ? weights.vector / (RRF_K + it.vectorRank) : 0;
      return { id: it.id, score: f + v };
    })
    .sort((a, b) => b.score - a.score);
}

/** Min-max normalize a list of raw scores to 0..1 (stable on empty/equal). */
export function normalize(scores: readonly number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max - min < 1e-9) return scores.map(() => (max > 0 ? 1 : 0));
  return scores.map((s) => (s - min) / (max - min));
}
