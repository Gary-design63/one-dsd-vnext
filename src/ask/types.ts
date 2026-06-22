// =====================================================================
// One DSD vNext — Ask types (Layer 9)
// "Professional Support": governed, KB-first retrieval over the approved
// corpus. No "AI" wording reaches staff. The answer FLOOR is extractive
// (cited approved passages); generation is an optional enhancement.
// =====================================================================
import type { Viewer } from "../access/visibility.js";

export interface AskRequest {
  viewer: Viewer;
  question: string;
  sessionId?: string;
}

/** One retrieved approved chunk with its scores. */
export interface Candidate {
  chunkId: string;
  assetId: string;
  title: string;
  visibility: string;
  content: string;
  ftsScore: number;     // 0..1 normalized
  vectorScore: number;  // 0..1 normalized (0 when embeddings absent)
  hybrid: number;       // fused 0..1
}

export type Disposition =
  | "answered"            // sufficient approved sources; extractive (or generative) cited answer
  | "insufficient_source" // nothing relevant enough in approved corpus -> refuse honestly
  | "escalated";          // weak/ambiguous -> offer to route to the consultant / research queue

export interface Citation {
  assetId: string;
  title: string;
}

export interface AskResult {
  disposition: Disposition;
  confidence: number;        // 0..1
  answer: string | null;     // extractive passages or generated prose; null when refused
  citations: Citation[];
  message: string;           // human, plain-language framing (no system jargon)
  usedProvider: boolean;     // true only when a generation provider actually ran
}
