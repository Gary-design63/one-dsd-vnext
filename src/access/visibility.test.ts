// =====================================================================
// One DSD vNext — visibility gate tests (Layer 6)
// The security core, tested with node:test. Pure functions, no DB.
// Run: node --test (after tsc) or via `npm run test:gate`.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canRead,
  allowedVisibilities,
  canSeeUnapproved,
  visibilitySqlClause,
  type Viewer,
} from "./visibility.js";

const staff: Viewer = { userId: "u1", roles: ["staff"] };
const reviewer: Viewer = { userId: "u2", roles: ["reviewer"] };
const consultant: Viewer = { userId: "u3", roles: ["consultant"] };
const noRole: Viewer = { userId: "u4", roles: [] };
const bogus: Viewer = { userId: "u5", roles: ["wizard"] };

test("staff sees only approved staff-visible content", () => {
  assert.equal(canRead(staff, { visibility: "staff", approvalState: "approved" }), true);
  assert.equal(canRead(staff, { visibility: "internal", approvalState: "approved" }), false);
  assert.equal(canRead(staff, { visibility: "consultant", approvalState: "approved" }), false);
  assert.equal(canRead(staff, { visibility: "staff", approvalState: "draft" }), false);
  assert.equal(canRead(staff, { visibility: "staff", approvalState: "pending_review" }), false);
});

test("archived is denied to everyone, including consultant", () => {
  assert.equal(canRead(consultant, { visibility: "consultant", approvalState: "archived" }), false);
  assert.equal(canRead(staff, { visibility: "staff", approvalState: "archived" }), false);
});

test("reviewer can see unapproved internal content", () => {
  assert.equal(canRead(reviewer, { visibility: "internal", approvalState: "pending_review" }), true);
  assert.equal(canSeeUnapproved(reviewer), true);
  // but not consultant-only content
  assert.equal(canRead(reviewer, { visibility: "consultant", approvalState: "approved" }), false);
});

test("consultant sees all non-archived visibilities", () => {
  assert.equal(canRead(consultant, { visibility: "consultant", approvalState: "draft" }), true);
  assert.equal(canRead(consultant, { visibility: "internal", approvalState: "approved" }), true);
  assert.equal(canRead(consultant, { visibility: "staff", approvalState: "approved" }), true);
});

test("fail-closed: no roles and unknown roles see nothing", () => {
  assert.deepEqual(allowedVisibilities(noRole), []);
  assert.deepEqual(allowedVisibilities(bogus), []);
  assert.equal(canRead(noRole, { visibility: "staff", approvalState: "approved" }), false);
  assert.equal(canRead(bogus, { visibility: "staff", approvalState: "approved" }), false);
});

test("fail-closed: unknown visibility value is denied", () => {
  assert.equal(canRead(consultant, { visibility: "top_secret", approvalState: "approved" }), false);
  assert.equal(canRead(staff, { visibility: "", approvalState: "approved" }), false);
});

test("SQL clause matches nothing for a viewer with no readable visibility", () => {
  const g = visibilitySqlClause(noRole, 1);
  assert.equal(g.clause, "false");
  assert.deepEqual(g.params, []);
});

test("SQL clause for staff filters to approved + non-archived", () => {
  const g = visibilitySqlClause(staff, 1);
  assert.match(g.clause, /a\.visibility = ANY\(\$1\)/);
  assert.match(g.clause, /approval_state = 'approved'/);
  assert.match(g.clause, /archived_at IS NULL/);
  assert.deepEqual(g.params, [["staff"]]);
});

test("SQL clause for reviewer allows unapproved but excludes archived", () => {
  const g = visibilitySqlClause(reviewer, 1);
  assert.match(g.clause, /approval_state <> 'archived'/);
  assert.doesNotMatch(g.clause, /= 'approved'/);
});
