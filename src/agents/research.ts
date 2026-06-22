// =====================================================================
// One DSD vNext — research provider interface (Layer 10).
// The seam to the Python/FastAPI reasoning service (ADR 15). Null until a
// model+key is wired. Findings RE-ENTER governance in Tier 1 (Node): they
// are drafts/citations to verify, never auto-published. Synthetic data, if
// used, must be labeled+validated (SOT) and is never presented as fact.
// =====================================================================
export interface ResearchFinding {
  title: string;
  url: string;
  excerpt: string;
  verified: boolean; // must be verified in Tier 1 before any use
}

export interface ResearchProvider {
  available(): boolean;
  /** Scoped by the multidisciplinary framework + program themes (Tier 1 passes scope). */
  research(question: string, scope: { themes: string[] }): Promise<ResearchFinding[]>;
}

class NullResearchProvider implements ResearchProvider {
  available(): boolean { return false; }
  async research(): Promise<ResearchFinding[]> {
    throw new Error("research service not configured");
  }
}

let cached: ResearchProvider | null = null;
export function getResearchProvider(): ResearchProvider {
  if (!cached) cached = new NullResearchProvider();
  return cached;
}
export function setResearchProvider(p: ResearchProvider): void { cached = p; }
