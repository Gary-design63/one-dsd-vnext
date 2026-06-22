import { test } from "node:test";
import assert from "node:assert/strict";
import { canEdit, validateAssetPatch, validateCopy } from "./edit.js";

test("only consultant/admin may edit", () => {
  assert.equal(canEdit({ userId: "c", roles: ["consultant"] }), true);
  assert.equal(canEdit({ userId: "a", roles: ["admin"] }), true);
  assert.equal(canEdit({ userId: "s", roles: ["staff"] }), false);
  assert.equal(canEdit({ userId: "r", roles: ["reviewer"] }), false);
});

test("asset patch: only allowlisted fields pass; arbitrary columns rejected", () => {
  assert.equal(validateAssetPatch({ title: "Hi", summary: "s" }).ok, true);
  assert.equal(validateAssetPatch({ visibility: "consultant" }).ok, false, "cannot set visibility inline");
  assert.equal(validateAssetPatch({ approval_state: "approved" }).ok, false, "cannot set approval inline");
});

test("asset patch: typed, bounded, non-empty title", () => {
  assert.equal(validateAssetPatch({ title: "" }).ok, false);
  assert.equal(validateAssetPatch({ title: "x".repeat(301) }).ok, false);
  assert.equal(validateAssetPatch({ body: 123 }).ok, false);
  assert.equal(validateAssetPatch({}).ok, false);
  const good = validateAssetPatch({ body: "new body text" });
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.fields.body, "new body text");
});

test("copy validation bounds + non-empty", () => {
  assert.equal(validateCopy("Welcome").ok, true);
  assert.equal(validateCopy("").ok, false);
  assert.equal(validateCopy(42).ok, false);
});
