// =====================================================================
// One DSD vNext — workflow runner tests (Layer 10). DB-free (fake record).
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { runWorkflow } from "./runner.js";
import type { WorkflowNode, RunContext } from "./types.js";

function ctx(): RunContext & { events: { kind: string; status: string }[] } {
  const events: { kind: string; status: string }[] = [];
  return { traceId: "t", events, record: async (e) => { events.push({ kind: e.kind, status: e.status }); } };
}

const okNode = (id: string, kind: WorkflowNode["kind"], extra: any = {}): WorkflowNode =>
  ({ id, kind, onFailure: "stop", run: async () => ({ ok: true, ...extra }) });

test("happy path runs all nodes and returns 'drafted' with identifiers + citations", async () => {
  const c = ctx();
  const out = await runWorkflow([
    okNode("policy", "policy", { citations: [{ assetId: "a", title: "A" }] }),
    okNode("gate", "gate", { gate: "proceed" }),
    okNode("action", "action", { identifiers: { approvalItemId: "x" } }),
    okNode("notify", "notify"),
  ], c);
  assert.equal(out.status, "drafted");
  assert.equal(out.identifiers.approvalItemId, "x");
  assert.equal(out.citations.length, 1);
  assert.equal(c.events.length, 4);
});

test("gate 'human' short-circuits to 'flagged' (no action runs)", async () => {
  const c = ctx();
  let actionRan = false;
  const out = await runWorkflow([
    okNode("policy", "policy"),
    okNode("gate", "gate", { gate: "human" }),
    { id: "action", kind: "action", onFailure: "stop", run: async () => { actionRan = true; return { ok: true }; } },
  ], c);
  assert.equal(out.status, "flagged");
  assert.equal(actionRan, false, "action must not run after human gate");
});

test("gate 'blocked' short-circuits to 'blocked'", async () => {
  const out = await runWorkflow([
    okNode("policy", "policy"),
    okNode("gate", "gate", { gate: "blocked" }),
    okNode("action", "action"),
  ], ctx());
  assert.equal(out.status, "blocked");
});

test("failing node with route_human => 'flagged'; with stop => 'failed'", async () => {
  const human = await runWorkflow([
    { id: "policy", kind: "policy", onFailure: "route_human", run: async () => ({ ok: false, reason: "no source" }) },
    okNode("action", "action"),
  ], ctx());
  assert.equal(human.status, "flagged");

  const failed = await runWorkflow([
    { id: "validate", kind: "validate", onFailure: "stop", run: async () => ({ ok: false, reason: "bad data" }) },
  ], ctx());
  assert.equal(failed.status, "failed");
});

test("a thrown node is caught and treated as failure (no crash)", async () => {
  const out = await runWorkflow([
    { id: "x", kind: "validate", onFailure: "stop", run: async () => { throw new Error("boom"); } },
  ], ctx());
  assert.equal(out.status, "failed");
  assert.match(out.nextSteps[0]!, /boom/);
});

test("allowlist is fail-closed for unknown tools", async () => {
  const { getTool } = await import("../tools/allowlist.js");
  assert.throws(() => getTool("arbitrary_sql"), /not in allowlist/);
});
