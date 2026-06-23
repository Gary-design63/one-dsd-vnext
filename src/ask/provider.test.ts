// =====================================================================
// Tests for the generation provider's prompt builder (pure, no network,
// no global state). Proves: the no-fabrication rule is constant across
// clients; only the identity adapts (multi-client); DSD is the safe default.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt } from "./provider.js";

const NO_FABRICATION = /USING ONLY the approved passages/;

test("default prompt is DSD and forbids fabrication", () => {
  const p = buildSystemPrompt();
  assert.match(p, /One DSD/);
  assert.match(p, /Minnesota DHS Disability Services/);
  assert.match(p, NO_FABRICATION);
});

test("prompt adapts to another client (multi-client) but keeps the guardrail", () => {
  const p = buildSystemPrompt({ programName: "Acme Belonging Program", audience: "Acme Corp staff" });
  assert.match(p, /Acme Belonging Program/);
  assert.match(p, /Acme Corp staff/);
  assert.doesNotMatch(p, /One DSD/);
  assert.match(p, NO_FABRICATION); // the no-fabrication rule never changes
});

test("empty/blank context falls back to DSD defaults", () => {
  const p = buildSystemPrompt({ programName: "", audience: "" });
  assert.match(p, /One DSD/);
  assert.match(p, /Minnesota DHS Disability Services/);
});
