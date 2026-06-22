// =====================================================================
// One DSD vNext — governance core tests (Layer 8)
// Proves the hard rule and the approval state machine directly.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideAutonomy,
  mayRelease,
  canOperateConsole,
  type ActionPolicy,
} from "./policy.js";
import { applyDecision, canClaim, releasable } from "./approvalState.js";
import type { Viewer } from "../access/visibility.js";

const staff: Viewer = { userId: "s", roles: ["staff"] };
const reviewer: Viewer = { userId: "r", roles: ["reviewer"] };
const consultant: Viewer = { userId: "c", roles: ["consultant"] };
const admin: Viewer = { userId: "a", roles: ["admin"] };

const actThenReport: ActionPolicy = { actionKind: "answer_staff_guidance", autonomyLevel: "act_then_report", gateCategoryKey: null, releaseRequiresRole: null, active: true };
const proposeOnly: ActionPolicy = { actionKind: "publish_or_release", autonomyLevel: "propose_only", gateCategoryKey: "publication", releaseRequiresRole: "consultant", active: true };
const blocked: ActionPolicy = { actionKind: "assess_named_individual", autonomyLevel: "blocked", gateCategoryKey: "named_individual", releaseRequiresRole: null, active: true };

test("autonomy: act_then_report lets AI act, propose_only does not, blocked forbids", () => {
  assert.equal(decideAutonomy(actThenReport).mayAutoAct, true);
  assert.equal(decideAutonomy(proposeOnly).mustPropose, true);
  assert.equal(decideAutonomy(proposeOnly).mayAutoAct, false);
  assert.equal(decideAutonomy(blocked).blocked, true);
});

test("autonomy fail-closed: null or inactive policy is blocked", () => {
  assert.equal(decideAutonomy(null).blocked, true);
  assert.equal(decideAutonomy({ ...actThenReport, active: false }).blocked, true);
});

test("release: only authority roles with the required role may release", () => {
  // propose_only/publish requires 'consultant'
  assert.equal(mayRelease(consultant, proposeOnly), true);
  assert.equal(mayRelease(admin, proposeOnly), false, "admin lacks the 'consultant' role required by policy");
  assert.equal(mayRelease(reviewer, proposeOnly), false);
  assert.equal(mayRelease(staff, proposeOnly), false);
});

test("release: blocked actions are never releasable; staff never releases", () => {
  assert.equal(mayRelease(consultant, blocked), false);
  assert.equal(mayRelease(staff, actThenReport), false, "staff is not an authority role");
  assert.equal(mayRelease(admin, actThenReport), true, "no special role required + authority");
});

test("console access: authority and reviewer in; plain staff out", () => {
  assert.equal(canOperateConsole(consultant), true);
  assert.equal(canOperateConsole(reviewer), true);
  assert.equal(canOperateConsole(staff), false);
});

test("approval state machine: legal transitions only", () => {
  assert.deepEqual(applyDecision("pending", "approved"), { ok: true, next: "approved" });
  assert.deepEqual(applyDecision("in_review", "changes_requested"), { ok: true, next: "changes_requested" });
  assert.equal(applyDecision("approved", "rejected").ok, false, "no decisions after terminal");
  assert.equal(applyDecision("rejected", "approved").ok, false);
});

test("approval helpers: claim only from pending; release only when approved", () => {
  assert.equal(canClaim("pending"), true);
  assert.equal(canClaim("in_review"), false);
  assert.equal(releasable("approved"), true);
  assert.equal(releasable("pending"), false);
});
