// =====================================================================
// One DSD vNext — generation provider (Layer 9)
// Optional enhancement ONLY. With no provider configured, Ask answers
// extractively from approved passages (the honest floor). A provider, when
// present, may rephrase — but it is given ONLY approved passages and is
// never allowed to introduce facts. No provider => available() is false.
// =====================================================================
export interface GenerationProvider {
  available(): boolean;
  /** Rephrase an answer strictly from the supplied approved passages. */
  synthesize(question: string, passages: string[]): Promise<string>;
}

class NullProvider implements GenerationProvider {
  available(): boolean {
    return false;
  }
  async synthesize(): Promise<string> {
    throw new Error("no generation provider configured");
  }
}

let cached: GenerationProvider | null = null;

/** Returns the configured provider, or a NullProvider when none is set.
 *  Wiring a real provider (model + key) is a Gary decision; until then the
 *  extractive floor runs and the governance path is fully exercised. */
export function getProvider(): GenerationProvider {
  if (cached) return cached;
  // A real provider would be selected here from env (ASK_PROVIDER + key).
  cached = new NullProvider();
  return cached;
}

export function setProvider(p: GenerationProvider): void {
  cached = p;
}
