// =====================================================================
// One DSD vNext — generation provider (Layer 9)
// Optional enhancement ONLY. With no provider configured, Ask answers
// extractively from approved passages (the honest floor). A provider, when
// present, may rephrase — but it is given ONLY approved passages and is
// never allowed to introduce facts. No provider => available() is false.
// =====================================================================

/** Adaptive identity for the system prompt (multi-client: from program_config). */
export interface PromptContext {
  programName?: string;
  audience?: string;
}

/** Pure: build the governed system prompt for the active client/instance.
 *  Defaults to DSD when no context is supplied. The no-fabrication rule is
 *  constant across all clients — only the identity adapts. */
export function buildSystemPrompt(ctx?: PromptContext): string {
  const program = ctx?.programName && ctx.programName.length > 0 ? ctx.programName : "One DSD";
  const audience =
    ctx?.audience && ctx.audience.length > 0 ? ctx.audience : "Minnesota DHS Disability Services staff";
  return (
    `You are a careful assistant for ${program} (${audience}). ` +
    "Answer the question USING ONLY the approved passages provided below. Do not introduce " +
    "any facts, names, figures, dates, citations, or claims that are not explicitly present " +
    "in those passages. If the passages do not contain the answer, say so plainly. Keep the " +
    "answer concise and in plain language."
  );
}

export interface GenerationProvider {
  available(): boolean;
  /** Rephrase an answer strictly from the supplied approved passages. */
  synthesize(question: string, passages: string[], ctx?: PromptContext): Promise<string>;
}

class NullProvider implements GenerationProvider {
  available(): boolean {
    return false;
  }
  async synthesize(): Promise<string> {
    throw new Error("no generation provider configured");
  }
}

/**
 * OpenRouter-backed provider. Rephrases ONLY the approved passages it is
 * given; the system prompt forbids introducing any fact not in the passages,
 * and answer.ts still falls back to the extractive floor on any error — so a
 * model can never produce a fabricated or uncited answer.
 * Activated by env: OPENROUTER_API_KEY (required), OPENROUTER_MODEL (optional).
 */
class OpenRouterProvider implements GenerationProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  available(): boolean {
    return this.apiKey.length > 0;
  }

  async synthesize(question: string, passages: string[], ctx?: PromptContext): Promise<string> {
    const system = buildSystemPrompt(ctx);
    const user =
      `Question: ${question}\n\nApproved passages (the ONLY allowed source):\n` +
      passages.map((p, i) => `[${i + 1}] ${p}`).join("\n\n");

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://one-dsd-vnext.azurecontainerapps.io",
        "X-Title": "One DSD",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`openrouter ${resp.status}`);
    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const out = data?.choices?.[0]?.message?.content;
    if (!out || typeof out !== "string") throw new Error("openrouter empty response");
    return out.trim();
  }
}

let cached: GenerationProvider | null = null;

/** Returns the configured provider. When OPENROUTER_API_KEY is set, the
 *  OpenRouter provider rephrases ONLY approved passages; otherwise the
 *  extractive floor runs. Governance is identical either way. */
export function getProvider(): GenerationProvider {
  if (cached) return cached;
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (key.length > 0) {
    cached = new OpenRouterProvider(key, process.env.OPENROUTER_MODEL ?? "openrouter/auto");
  } else {
    cached = new NullProvider();
  }
  return cached;
}

export function setProvider(p: GenerationProvider): void {
  cached = p;
}
