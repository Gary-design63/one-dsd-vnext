// =====================================================================
// One DSD vNext — tool allowlist (Layer 10).
// The ONLY functions an agent/workflow may call. No arbitrary SQL, ever.
// Each tool is a named, pre-defined, governed capability. New tools are
// added here deliberately (and audited via the workflow runner).
// =====================================================================
import type { Db } from "../../db.js";
import type { Viewer } from "../../access/visibility.js";
import { synthesize } from "../../synthesis/engine.js";
import { retrieve } from "../../ask/retrieval.js";
import type { SynthesisBrief } from "../../synthesis/types.js";

export interface ToolContext { db: Db; viewer: Viewer; }

export interface AgentTool<Args, Out> {
  name: string;
  description: string;
  run: (ctx: ToolContext, args: Args) => Promise<Out>;
}

/** Reconcile the approved corpus into a governed synthesis brief. */
const synthesizeCorpus: AgentTool<{ query: string; themes?: string[] }, SynthesisBrief> = {
  name: "synthesize_corpus",
  description: "Cluster + reconcile approved, visibility-gated passages into a cited brief with conflicts and gaps.",
  run: (ctx, args) => synthesize(ctx.db, ctx.viewer, args.query, { requestedThemes: args.themes ?? [] }),
};

/** Retrieve approved, visibility-gated policy passages (no synthesis). */
const retrievePolicy: AgentTool<{ query: string }, { assetId: string; title: string; content: string }[]> = {
  name: "retrieve_policy",
  description: "Return approved, visibility-gated passages relevant to a query.",
  run: async (ctx, args) => {
    const cands = await retrieve(ctx.db, ctx.viewer, args.query);
    return cands.map((c) => ({ assetId: c.assetId, title: c.title, content: c.content }));
  },
};

const REGISTRY = new Map<string, AgentTool<any, any>>([
  [synthesizeCorpus.name, synthesizeCorpus],
  [retrievePolicy.name, retrievePolicy],
]);

export function getTool<Args = unknown, Out = unknown>(name: string): AgentTool<Args, Out> {
  const t = REGISTRY.get(name);
  if (!t) throw new Error(`tool not in allowlist: ${name}`); // fail-closed
  return t as AgentTool<Args, Out>;
}

export function listTools(): { name: string; description: string }[] {
  return [...REGISTRY.values()].map((t) => ({ name: t.name, description: t.description }));
}
