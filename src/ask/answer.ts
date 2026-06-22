// =====================================================================
// One DSD vNext — Ask orchestrator (Layer 9), DB-backed + governed.
// Pipeline: retrieve (visibility-gated) -> confidence gate -> answer
// (extractive floor, or provider rephrase of ONLY approved passages) OR
// refuse/escalate. Records the turn, retrievals, citations, an observability
// run event, and (on escalate) a governed approval_item. Never fabricates.
// =====================================================================
import type { Db } from "../db.js";
import { audit, newTraceId } from "../audit/audit.js";
import { retrieve } from "./retrieval.js";
import { decideDisposition, framingFor } from "./confidence.js";
import { getProvider } from "./provider.js";
import type { AskRequest, AskResult, Candidate, Citation } from "./types.js";

const MAX_CITED = 3;

function topPassages(cands: Candidate[]): Candidate[] {
  return [...cands].sort((a, b) => b.hybrid - a.hybrid).slice(0, MAX_CITED);
}

function distinctCitations(cands: Candidate[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of cands) {
    if (!seen.has(c.assetId)) {
      seen.add(c.assetId);
      out.push({ assetId: c.assetId, title: c.title });
    }
  }
  return out;
}

function extractiveAnswer(passages: Candidate[]): string {
  // Honest floor: present the approved passages verbatim, attributed.
  return passages.map((p) => `From "${p.title}":\n${p.content.trim()}`).join("\n\n");
}

export async function ask(db: Db, req: AskRequest): Promise<AskResult> {
  const trace = newTraceId();
  const candidates = await retrieve(db, req.viewer, req.question);
  const gate = decideDisposition(candidates);
  const provider = getProvider();

  await audit(db, {
    actorId: req.viewer.userId,
    action: "ask.query",
    detail: { disposition: gate.disposition, confidence: gate.confidence, hits: candidates.length },
    traceId: trace,
  });
  // Observability for the Brain framework (Insight/Chief-of-Staff can read aggregate).
  await db.query(
    `INSERT INTO agent_run_events (persona_key, action, tool, input_summary, output_summary, status, trace_id)
     VALUES ('chief_of_staff', 'retrieve', 'kb_fts', $1, $2, $3, $4)`,
    [truncate(req.question), `${candidates.length} hits`, gate.disposition, trace],
  );

  if (gate.disposition === "answered") {
    const passages = topPassages(candidates);
    const citations = distinctCitations(passages);
    let answer = extractiveAnswer(passages);
    let usedProvider = false;
    if (provider.available()) {
      try {
        answer = await provider.synthesize(req.question, passages.map((p) => p.content));
        usedProvider = true;
      } catch {
        /* fall back to extractive — never fail to a fabricated answer */
      }
    }
    return {
      disposition: "answered",
      confidence: gate.confidence,
      answer,
      citations,
      message: framingFor("answered"),
      usedProvider,
    };
  }

  // Not in the approved corpus: say so honestly. Content is consultant-vetted
  // at ingestion, so there is NO confidence-routing to the consultant here —
  // that bottleneck is removed by decision. This is a log line, not a queue.
  await audit(db, { actorId: req.viewer.userId, action: "ask.no_match", traceId: trace });
  return {
    disposition: "insufficient_source",
    confidence: gate.confidence,
    answer: null,
    citations: [],
    message: framingFor("insufficient_source"),
    usedProvider: false,
  };
}

function truncate(s: string, n = 200): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
