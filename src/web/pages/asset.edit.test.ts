import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAsset } from "./asset.js";
import type { NavContext } from "../viewModels.js";

const navC: NavContext = { viewer: { userId: "c", roles: ["consultant"] }, active: "library" };
const navS: NavContext = { viewer: { userId: "s", roles: ["staff"] }, active: "library" };
const asset = { id: "11111111-1111-1111-1111-111111111111", title: "T", summary: "s", body: "Body.", format: "guide", proficiencyBand: "applied", primaryTrack: null, disciplineCluster: null, estimatedMinutes: 5 };

test("edit mode (authority): editable markers + edit-allowed body + edit.js", () => {
  const doc = renderAsset({ nav: navC, editable: true, asset });
  assert.match(doc, /data-edit-allowed/);
  assert.match(doc, /data-editable/);
  assert.match(doc, /data-edit-endpoint="\/api\/edit\/asset\/11111111-1111-1111-1111-111111111111"/);
  assert.match(doc, /\/static\/edit\.js/);
  assert.match(doc, /Edit mode is on/);
});

test("no edit mode: no editable markers, no edit.js (staff can never edit)", () => {
  const off = renderAsset({ nav: navC, editable: false, asset });
  assert.doesNotMatch(off, /data-editable/);
  assert.doesNotMatch(off, /data-edit-allowed/);
  assert.doesNotMatch(off, /edit\.js/);
  // staff with editable accidentally true is still gated server-side; render itself only marks when told
  const staff = renderAsset({ nav: navS, asset });
  assert.doesNotMatch(staff, /data-editable/);
});
