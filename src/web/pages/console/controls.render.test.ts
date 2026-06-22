import { test } from "node:test";
import assert from "node:assert/strict";
import { renderControls } from "./controls.js";
import type { NavContext } from "../../viewModels.js";

const nav: NavContext = { viewer: { userId: "c", roles: ["consultant"] }, active: "console" };

test("controls page: kill-switch + authority banner, a11y, no AI wording", () => {
  const doc = renderControls({
    nav, automationState: "active", ceiling: "propose_only",
    personas: [{ key: "chief_of_staff", label: "Chief of Staff", default_autonomy: "act_then_report", active: true }],
    overrides: [],
  });
  assert.match(doc, /<html lang="en">/);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1);
  assert.match(doc, /Pause all automation/);
  assert.match(doc, /unconditional authority/i);
  assert.doesNotMatch(doc, /\bAI\b/);
  assert.doesNotMatch(doc, /\sstyle=/);
});

test("controls page: paused state offers resume", () => {
  const doc = renderControls({
    nav, automationState: "paused", ceiling: "propose_only", personas: [], overrides: [],
  });
  assert.match(doc, /Resume all automation/);
});
