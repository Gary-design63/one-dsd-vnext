// =====================================================================
// Tests for the program configuration reader (pure, no DB).
// Proves: defaults hold when rows are empty/partial/malformed; real rows
// override defaults; multi-client instance id is honored.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, mergeConfigRows } from "./programConfig.js";

test("empty rows → defaults (DSD instance one)", () => {
  const cfg = mergeConfigRows(DEFAULT_CONFIG, []);
  assert.equal(cfg.naming.communitiesSection, "Minnesota Communities");
  assert.equal(cfg.naming.communityBriefTerm, "Community Briefs");
  assert.equal(cfg.naming.noAiLanguageToStaff, true);
  assert.equal(cfg.autonomy.safetyPosture, "after_action");
  assert.equal(cfg.lifecycle.isEndState, false);
  assert.equal(cfg.measurement.surveyParticipationTarget, 0.7);
  assert.equal(cfg.boundaryLanes.length, 5);
});

test("real rows override defaults (a second client re-themes by data, not rebuild)", () => {
  const cfg = mergeConfigRows({ ...DEFAULT_CONFIG, instanceId: "acme" }, [
    { key: "identity", value: { program_name: "Acme Belonging Program", anchor_client: "Acme Corp" } },
    { key: "naming", value: { communities_section: "Acme Communities", community_brief_term: "Community Notes" } },
    { key: "measurement", value: { survey_participation_target: 0.5, agent_driven_operations_target: 0.9 } },
  ]);
  assert.equal(cfg.instanceId, "acme");
  assert.equal(cfg.identity.programName, "Acme Belonging Program");
  assert.equal(cfg.naming.communitiesSection, "Acme Communities");
  assert.equal(cfg.naming.communityBriefTerm, "Community Notes");
  // unset fields still fall back to defaults
  assert.equal(cfg.naming.assistant, "Ask One DSD");
  assert.equal(cfg.measurement.surveyParticipationTarget, 0.5);
  assert.equal(cfg.measurement.agentDrivenTarget, 0.9);
});

test("malformed values fall back per-field, never throw", () => {
  const cfg = mergeConfigRows(DEFAULT_CONFIG, [
    { key: "naming", value: { communities_section: 123, no_ai_language_to_staff: "yes" } },
    { key: "autonomy", value: { levels: [] } }, // empty array → keep defaults
    { key: "boundary_lanes", value: { lanes: "not-an-array" } },
  ]);
  assert.equal(cfg.naming.communitiesSection, "Minnesota Communities"); // bad number ignored
  assert.equal(cfg.naming.noAiLanguageToStaff, true); // bad bool ignored
  assert.equal(cfg.autonomy.levels.length, 4); // empty array ignored
  assert.equal(cfg.boundaryLanes.length, 5); // bad lanes ignored
});

test("unknown keys are ignored", () => {
  const cfg = mergeConfigRows(DEFAULT_CONFIG, [{ key: "nonsense", value: { foo: "bar" } }]);
  assert.equal(cfg.identity.programName, DEFAULT_CONFIG.identity.programName);
});
