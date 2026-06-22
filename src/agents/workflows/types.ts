// =====================================================================
// One DSD vNext — workflow runner types (Layer 10).
// The canonical governed-workflow contract (system prompt §4): ordered
// typed nodes; the runner records every node, short-circuits on failure,
// and never auto-publishes. The LLM is a tool inside a node, never the
// controller.
// =====================================================================
export type NodeKind = "extract" | "validate" | "policy" | "gate" | "action" | "notify";

export type NodeResult =
  | { ok: true; data?: Record<string, unknown>; gate?: "proceed" | "human" | "blocked"; identifiers?: Record<string, string>; citations?: { assetId: string; title: string }[] }
  | { ok: false; reason: string };

export interface RunContext {
  traceId: string;
  /** observability sink — writes one agent_run_events row per node */
  record: (e: { kind: NodeKind; status: string; summary?: string }) => Promise<void>;
}

export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  run: (ctx: RunContext) => Promise<NodeResult>;
  onFailure: "stop" | "route_human";
}

export type OutcomeStatus = "drafted" | "flagged" | "blocked" | "failed";

export interface WorkflowOutcome {
  status: OutcomeStatus;
  identifiers: Record<string, string>;
  nextSteps: string[];
  citations: { assetId: string; title: string }[];
  trail: { node: string; status: string }[];
}
