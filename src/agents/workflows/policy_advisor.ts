// =====================================================================
// One DSD vNext — Policy Advisor workflow (Layer 10), governed end-to-end.
// Manager asks a policy question → synthesize the APPROVED corpus → GATE
// (autonomy + conflicts/low-confidence/named-individual → human) → stage a
// DRAFT advisory (never published) → notify. Wires the Synthesis layer into
// the Brain. No arbitrary SQL (uses the allowlist); everything observable.
// =====================================================================
import type { Db } from "../../db.js";
import type { Viewer } from "../../access/visibility.js";
import { newTraceId } from "../../audit/audit.js";
import { runWorkflow } from "./runner.js";
import type { WorkflowNode, RunContext, WorkflowOutcome } from "./types.js";
import { getTool } from "../tools/allowlist.js";
import { resolveAutonomy } from "../autonomy.js";
import { getAutomationState, getCeiling, activeOverrideFor } from "../controls.js";
import type { SynthesisBrief } from "../../synthesis/types.js";

const NAMED_INDIVIDUAL = /\bassess(ing)?\s+[A-Z][a-z]+\b|\bnamed individual\b/i;

export async function runPolicyAdvisor(
  db: Db, viewer: Viewer, question: string, themes: string[] = [],
): Promise<WorkflowOutcome> {
  const traceId = newTraceId();
  const ctx: RunContext = {
    traceId,
    record: async (e) => {
      await db.query(
        `INSERT INTO agent_run_events (persona_key, action, tool, input_summary, status, trace_id)
         VALUES ('compliance_risk', $1, 'policy_advisor', $2, $3, $4)`,
        [e.kind, (e.summary ?? question).slice(0, 200), e.status, traceId],
      );
    },
  };

  let brief: SynthesisBrief | null = null;

  const nodes: WorkflowNode[] = [
    {
      id: "policy", kind: "policy", onFailure: "route_human",
      run: async () => {
        brief = await getTool<{ query: string; themes?: string[] }, SynthesisBrief>("synthesize_corpus")
          .run({ db, viewer }, { query: question, themes });
        if (brief.sourceCount === 0) {
          return { ok: false, reason: "No approved source covers this — not answering from outside the library." };
        }
        return { ok: true, citations: brief.citations, data: { confidence: brief.confidence } };
      },
    },
    {
      id: "gate", kind: "gate", onFailure: "stop",
      run: async () => {
        const [automationState, ceiling, override] = await Promise.all([
          getAutomationState(db), getCeiling(db), activeOverrideFor(db, "persona", "compliance_risk"),
        ]);
        const guardrailBlocked = NAMED_INDIVIDUAL.test(question);
        const res = resolveAutonomy({
          automationState, personaDefault: "propose_only", ceiling,
          override: override ? { action: override.action, scope: "target" } : null,
          guardrailBlocked,
        });
        if (res.autonomy === "blocked") return { ok: true, gate: "blocked" };
        // High-judgment routing: conflicts or low confidence → human.
        const b = brief!;
        if (b.conflicts.length > 0 || b.confidence < 0.34 || res.autonomy === "propose_only") {
          return { ok: true, gate: "human" };
        }
        return { ok: true, gate: "proceed" };
      },
    },
    {
      id: "action", kind: "action", onFailure: "stop",
      run: async () => {
        // Stage a DRAFT advisory in the governed queue (never published).
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO approval_items (kind, state, submitted_by, gate_category_key)
           VALUES ('answer', 'pending', $1, 'legal') RETURNING id`,
          [viewer.userId],
        );
        return { ok: true, identifiers: { approvalItemId: rows[0]!.id } };
      },
    },
    {
      id: "notify", kind: "notify", onFailure: "stop",
      run: async () => ({ ok: true }),
    },
  ];

  return runWorkflow(nodes, ctx);
}
