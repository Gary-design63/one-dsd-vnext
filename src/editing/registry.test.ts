import { test } from "node:test";
import assert from "node:assert/strict";
import { getEntity, validateEntityPatch } from "./registry.js";

test("registry exposes only known content entities", () => {
  for (const k of ["asset","learning_path","learning_module","calendar_event","collection"]) {
    assert.ok(getEntity(k), `${k} should be editable`);
  }
  assert.equal(getEntity("users"), null, "users must NOT be editable");
  assert.equal(getEntity("audit_events"), null, "audit must NOT be editable");
});

test("patch is field-allowlisted per entity", () => {
  assert.equal(validateEntityPatch("learning_path", { title: "New" }).ok, true);
  assert.equal(validateEntityPatch("learning_path", { proficiency_band: "advanced" }).ok, false);
  assert.equal(validateEntityPatch("calendar_event", { sensitivity: "x" }).ok, false);
  assert.equal(validateEntityPatch("nope", { title: "x" }).ok, false);
});

test("patch enforces non-empty name + length + type", () => {
  assert.equal(validateEntityPatch("learning_path", { title: "" }).ok, false);
  assert.equal(validateEntityPatch("collection", { label: "" }).ok, false);
  assert.equal(validateEntityPatch("learning_path", { title: "x".repeat(301) }).ok, false);
  assert.equal(validateEntityPatch("learning_module", { title: 9 }).ok, false);
});
