// =====================================================================
// One DSD vNext — Brain core tests (Layer 10): autonomy + delegation.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAutonomy, mayAutoAct } from "./autonomy.js";
import { choosePersona } from "./delegation.js";

const base = { automationState: "active" as const, personaDefault: "act_then_report", ceiling: "act_then_report" };

test("active + high persona + high ceiling -> act_then_report", () => {
  const r = resolveAutonomy(base);
  assert.equal(r.autonomy, "act_then_report");
  assert.equal(mayAutoAct(r), true);
});

test("ceiling caps persona autonomy", () => {
  const r = resolveAutonomy({ ...base, ceiling: "propose_only" });
  assert.equal(r.autonomy, "propose_only");
});

test("global kill-switch (paused) blocks everything", () => {
  const r = resolveAutonomy({ ...base, automationState: "paused" });
  assert.equal(r.autonomy, "blocked");
  assert.match(r.reason, /kill-switch/);
});

test("consultant resume override re-enables under pause (capped by ceiling)", () => {
  const r = resolveAutonomy({ ...base, automationState: "paused", override: { action: "resume", scope: "global" } });
  assert.equal(r.autonomy, "act_then_report");
});

test("per-target pause/cancel override blocks", () => {
  for (const action of ["pause", "cancel"] as const) {
    const r = resolveAutonomy({ ...base, override: { action, scope: "target" } });
    assert.equal(r.autonomy, "blocked");
  }
});

test("force override acts even under pause", () => {
  const r = resolveAutonomy({ ...base, automationState: "paused", override: { action: "force", scope: "target" } });
  assert.equal(r.autonomy, "act_then_report");
});

test("HARD GUARDRAIL wins over everything, including force", () => {
  const r = resolveAutonomy({ ...base, override: { action: "force", scope: "target" }, guardrailBlocked: true });
  assert.equal(r.autonomy, "blocked");
  assert.match(r.reason, /guardrail/);
});

test("fail-closed: unknown persona/ceiling collapse toward blocked", () => {
  const r = resolveAutonomy({ automationState: "active", personaDefault: "wat", ceiling: null });
  assert.equal(r.autonomy, "blocked");
});

test("delegation routes by theme first", () => {
  assert.equal(choosePersona({ text: "anything", themeKey: "wellbeing_psych_safety" }).persona, "ombuds_care");
  assert.equal(choosePersona({ text: "anything", themeKey: "leadership_development" }).persona, "strategy");
});

test("delegation routes by keywords when no theme", () => {
  assert.equal(choosePersona({ text: "There's a conflict and someone feels excluded" }).persona, "ombuds_care");
  assert.equal(choosePersona({ text: "What does the ADA require for an accommodation request?" }).persona, "compliance_risk");
  assert.equal(choosePersona({ text: "Show me representation trends in the survey data" }).persona, "insight");
});

test("unmatched need triages to Chief of Staff (never dropped)", () => {
  assert.equal(choosePersona({ text: "hello" }).persona, "chief_of_staff");
});
