// =====================================================================
// One DSD vNext — synthesizer (Synthesis layer) — PURE + deterministic.
// Clusters near-duplicate passages, surfaces corroborated points, flags
// potential conflicts (negation polarity / numeric mismatch), computes a
// theme coverage gap-map, merges citations, and scores confidence. No model
// required — generative narrative is layered on separately via a provider.
// Conservative by design: conflicts are flagged as "needs review", never
// asserted as fact; nothing here fabricates content.
// =====================================================================
import type { SourcePassage, SynthesisBrief, SynthClusterPoint, SynthConflict } from "./types.js";

const STOP = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","with","is","are",
  "be","as","at","by","that","this","it","from","you","your","we","our","they",
  "their","will","can","may","must","not","no","do","does","if","then","than",
]);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}
function contentSet(text: string): Set<string> {
  return new Set(words(text).filter((w) => w.length > 2 && !STOP.has(w)));
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const NEG = /\b(not|no|never|cannot|can't|don't|doesn't|isn't|aren't|without|ineligible|prohibited|disallow(?:ed)?|deny|denied|exclude[d]?)\b/i;
function negationCount(text: string): number {
  return (text.match(NEG) ? 1 : 0);
}
function numbers(text: string): string[] {
  return (text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []);
}

interface Cluster { sources: SourcePassage[]; tokens: Set<string>; }

export function clusterPassages(sources: readonly SourcePassage[], threshold = 0.4): Cluster[] {
  const clusters: Cluster[] = [];
  for (const s of sources) {
    const t = contentSet(s.content);
    let placed = false;
    for (const c of clusters) {
      if (jaccard(t, c.tokens) >= threshold) {
        c.sources.push(s);
        for (const w of t) c.tokens.add(w);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ sources: [s], tokens: t });
  }
  return clusters;
}

function snippet(text: string, n = 220): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}

function distinctAssets(sources: readonly SourcePassage[]): string[] {
  return [...new Set(sources.map((s) => s.assetId))];
}

export function buildBrief(
  query: string,
  sources: readonly SourcePassage[],
  opts: { requestedThemes?: string[] } = {},
): SynthesisBrief {
  const clusters = clusterPassages(sources);

  // key points: corroborated clusters (>=2 distinct assets) first
  const keyPoints: SynthClusterPoint[] = clusters
    .map((c) => {
      const assetIds = distinctAssets(c.sources);
      return {
        point: snippet(c.sources[0]!.content),
        assetIds,
        corroborated: assetIds.length >= 2,
      };
    })
    .sort((a, b) => Number(b.corroborated) - Number(a.corroborated) || b.assetIds.length - a.assetIds.length);

  // conflicts within a cluster: opposing negation polarity OR numeric mismatch
  const conflicts: SynthConflict[] = [];
  for (const c of clusters) {
    for (let i = 0; i < c.sources.length; i++) {
      for (let j = i + 1; j < c.sources.length; j++) {
        const A = c.sources[i]!, B = c.sources[j]!;
        if (A.assetId === B.assetId) continue;
        const negDiff = negationCount(A.content) !== negationCount(B.content);
        const numsA = numbers(A.content), numsB = numbers(B.content);
        const numMismatch = numsA.length > 0 && numsB.length > 0 &&
          numsA.join() !== numsB.join() &&
          numsA.some((n) => !numsB.includes(n));
        if (negDiff || numMismatch) {
          conflicts.push({
            topic: snippet(A.content, 80),
            a: { assetId: A.assetId, excerpt: snippet(A.content, 140) },
            b: { assetId: B.assetId, excerpt: snippet(B.content, 140) },
            reason: negDiff ? "negation_polarity" : "numeric_mismatch",
            note: "Sources may disagree here — needs human review before relying on it.",
          });
        }
      }
    }
  }

  // coverage gap-map
  const present = new Set<string>();
  for (const s of sources) for (const t of s.themes ?? []) present.add(t);
  const requested = opts.requestedThemes ?? [];
  const coveredThemes = requested.filter((t) => present.has(t));
  const missingThemes = requested.filter((t) => !present.has(t));

  // citations (distinct assets, preserve first-seen title)
  const seen = new Set<string>();
  const citations = sources
    .filter((s) => (seen.has(s.assetId) ? false : (seen.add(s.assetId), true)))
    .map((s) => ({ assetId: s.assetId, title: s.title }));

  // confidence: corroboration share + coverage − conflict penalty
  const corroboratedShare = keyPoints.length ? keyPoints.filter((k) => k.corroborated).length / keyPoints.length : 0;
  const coverageRatio = requested.length ? coveredThemes.length / requested.length : (sources.length > 0 ? 1 : 0);
  const conflictPenalty = Math.min(0.4, conflicts.length * 0.1);
  const confidence = Math.max(0, Math.min(1, 0.5 * corroboratedShare + 0.5 * coverageRatio - conflictPenalty));

  return {
    query,
    keyPoints,
    conflicts,
    coveredThemes,
    missingThemes,
    citations,
    confidence,
    sourceCount: sources.length,
    narrative: null, // generative summary attached separately when a provider exists
  };
}

/** Does the brief justify going to external research? (gaps or thin/low confidence) */
export function needsExternalResearch(brief: SynthesisBrief): boolean {
  return brief.sourceCount === 0 || brief.missingThemes.length > 0 || brief.confidence < 0.34;
}
