// =====================================================================
// One DSD vNext — workflow runner (Layer 10) — governed executor.
// Runs nodes in order; records each; honors gate decisions; produces a
// structured outcome. DB-agnostic (takes a `record` sink) so it is unit-
// testable without a database. ACTION nodes may only stage drafts — the
// runner has no publish path.
// =====================================================================
import type { WorkflowNode, RunContext, WorkflowOutcome } from "./types.js";

export async function runWorkflow(
  nodes: readonly WorkflowNode[],
  ctx: RunContext,
): Promise<WorkflowOutcome> {
  const outcome: WorkflowOutcome = {
    status: "drafted",
    identifiers: {},
    nextSteps: [],
    citations: [],
    trail: [],
  };

  for (const node of nodes) {
    let result;
    try {
      result = await node.run(ctx);
    } catch (e) {
      result = { ok: false as const, reason: e instanceof Error ? e.message : "node_error" };
    }

    if (!result.ok) {
      const status = node.onFailure === "route_human" ? "flagged" : "failed";
      await ctx.record({ kind: node.kind, status, summary: result.reason });
      outcome.trail.push({ node: node.id, status });
      outcome.status = status as WorkflowOutcome["status"];
      outcome.nextSteps.push(
        status === "flagged"
          ? `Routed to a human: ${result.reason}`
          : `Stopped: ${result.reason}`,
      );
      return outcome; // short-circuit
    }

    // success: merge identifiers/citations
    if (result.identifiers) Object.assign(outcome.identifiers, result.identifiers);
    if (result.citations) outcome.citations.push(...result.citations);

    // gate handling
    if (node.kind === "gate" && result.gate && result.gate !== "proceed") {
      const status = result.gate === "blocked" ? "blocked" : "flagged";
      await ctx.record({ kind: "gate", status });
      outcome.trail.push({ node: node.id, status });
      outcome.status = status;
      outcome.nextSteps.push(
        status === "blocked"
          ? "Blocked by governance (kill-switch or hard guardrail)."
          : "Routed to the consultant for approval.",
      );
      return outcome; // governance stop — never auto-completes
    }

    await ctx.record({ kind: node.kind, status: "ok" });
    outcome.trail.push({ node: node.id, status: "ok" });
  }

  return outcome; // reached the end => 'drafted'
}
