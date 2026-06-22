// =====================================================================
// One DSD vNext — synthesis types (Synthesis layer).
// A synthesis brief is the governed product of reconciling MULTIPLE approved
// sources: what they agree on, where they conflict, what's missing (gaps),
// and a merged citation set. It is the deep corpus-integration step that
// runs BEFORE any external research is considered.
// =====================================================================
export interface SourcePassage {
  chunkId: string;
  assetId: string;
  title: string;
  content: string;
  themes?: string[];
  score?: number; // retrieval relevance 0..1 (optional)
}

export interface SynthClusterPoint {
  point: string;            // representative snippet for the cluster
  assetIds: string[];       // distinct assets supporting it
  corroborated: boolean;    // >= 2 distinct assets
}

export interface SynthConflict {
  topic: string;            // shared snippet/topic
  a: { assetId: string; excerpt: string };
  b: { assetId: string; excerpt: string };
  reason: "negation_polarity" | "numeric_mismatch";
  note: string;             // human, "needs review" framing
}

export interface SynthCitation { assetId: string; title: string; }

export interface SynthesisBrief {
  query: string;
  keyPoints: SynthClusterPoint[];   // agreements first, then singletons
  conflicts: SynthConflict[];       // potential contradictions to reconcile
  coveredThemes: string[];
  missingThemes: string[];          // gaps -> what external research would target
  citations: SynthCitation[];
  confidence: number;               // 0..1 (corroboration + coverage - conflict penalty)
  sourceCount: number;
  narrative: string | null;         // generative summary (provider seam); null until model+key
}
