// =====================================================================
// One DSD vNext — relevance gate (Layer 9, revised) — PURE.
// Per consultant decision: ALL ingested content is consultant-vetted at
// ingestion, so Ask does not need a confidence rating that withholds and
// routes to the consultant. There is NO consultant-routing bottleneck.
// The gate now only separates "we have relevant approved material" from
// "we don't (say so honestly)". A relevance floor filters noise.
// =====================================================================
import type { Candidate, Disposition } from "./types.js";

export interface GateThresholds {
  relevanceFloor: number; // top hybrid >= this -> answer from approved material
  minSupport: number;     // at least this many hits at/above the floor
}

export const DEFAULT_THRESHOLDS: GateThresholds = {
  relevanceFloor: 0.30,
  minSupport: 1,
};

export interface GateDecision {
  disposition: Disposition; // "answered" | "insufficient_source"
  confidence: number;       // informational only (metrics/observability); never routes
}

export function decideDisposition(
  candidates: readonly Candidate[],
  t: GateThresholds = DEFAULT_THRESHOLDS,
): GateDecision {
  if (candidates.length === 0) {
    return { disposition: "insufficient_source", confidence: 0 };
  }
  const sorted = [...candidates].sort((a, b) => b.hybrid - a.hybrid);
  const top = sorted[0]!.hybrid;
  const support = sorted.filter((c) => c.hybrid >= t.relevanceFloor).length;

  if (top >= t.relevanceFloor && support >= t.minSupport) {
    // vetted content is safe to surface; confidence is just a quality signal.
    return { disposition: "answered", confidence: Math.max(0, Math.min(1, top)) };
  }
  return { disposition: "insufficient_source", confidence: Math.min(0.2, top) };
}

/** Plain-language framing (no system jargon, no "AI"). No routing copy. */
export function framingFor(d: Disposition): string {
  switch (d) {
    case "answered":
      return "Here is what the approved One DSD library says, with sources.";
    case "escalated": // retained for type-completeness; not produced at runtime
    case "insufficient_source":
      return "The approved library does not yet cover this. Nothing has been made up.";
  }
}
