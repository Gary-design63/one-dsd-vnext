import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCommand } from "./command.js";
import type { NavContext } from "../../viewModels.js";

const nav: NavContext = { viewer: { userId: "c", roles: ["consultant"] }, active: "console" };

test("command center: dispatch box, roster, ledger, a11y, no AI wording", () => {
  const doc = renderCommand({
    nav,
    automationState: "active",
    ceiling: "propose_only",
    personas: [
      { key: "chief_of_staff", label: "Chief of Staff", default_autonomy: "act_then_report", active: true },
      { key: "strategy", label: "Strategy", default_autonomy: "propose_only", active: true },
    ],
    delegations: [
      { child_persona: "strategy", task: "draft a rollout plan", autonomy_applied: "propose_only", status: "needs_approval", created_at: new Date("2026-06-24T12:00:00Z") },
    ],
    ledger: [],
    counts: { pending: 0, inReview: 0, consultationsOpen: 0 },
    lastPlan: null,
  });
  assert.match(doc, /<html lang="en">/);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1);
  assert.match(doc, /Command Center/);
  assert.match(doc, /action="\/console\/command\/dispatch"/);
  assert.match(doc, /Strategy/);
  assert.doesNotMatch(doc, /\bAI\b/);
  assert.doesNotMatch(doc, /\sstyle=/);
});

test("command center: shows the routed plan after a dispatch", () => {
  const doc = renderCommand({
    nav,
    automationState: "active",
    ceiling: "act_then_report",
    personas: [{ key: "insight", label: "Insight", default_autonomy: "act_then_report", active: true }],
    delegations: [],
    ledger: [],
    counts: { pending: 1, inReview: 0, consultationsOpen: 2 },
    lastPlan: { persona: "insight", autonomy: "act_then_report", rationale: "matched insight keywords" },
  });
  assert.match(doc, /Routed to/);
  assert.match(doc, /Insight/);
});
