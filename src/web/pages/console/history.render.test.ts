import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHistory, type HistoryView } from "./history.js";
import type { NavContext } from "../../viewModels.js";

const nav: NavContext = { viewer: { userId: "u", roles: ["consultant"] }, active: "console" };

function a11y(label: string, doc: string): void {
  assert.match(doc, /<html lang="en">/, `${label}: lang`);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1, `${label}: one h1`);
  assert.match(doc, /class="skip-link"/, `${label}: skip link`);
  assert.doesNotMatch(doc, /\bAI\b/, `${label}: no "AI"`);
  assert.doesNotMatch(doc, /\sstyle=/, `${label}: no inline style`);
}

test("history: empty lookup renders form, no rows table", () => {
  const v: HistoryView = { nav, store: "asset", id: "", heading: "", currentPreview: null, rows: [] };
  const doc = renderHistory(v);
  a11y("history-empty", doc);
  assert.match(doc, /action="\/console\/history"/, "lookup form present");
  assert.doesNotMatch(doc, /Restore this version/, "no rollback buttons without rows");
});

test("history: with versions shows current value, restore buttons, escapes content, note form", () => {
  const v: HistoryView = {
    nav, store: "asset", id: "11111111-1111-1111-1111-111111111111",
    heading: "The Guide", currentPreview: "Live body text",
    rows: [
      { store: "asset", versionId: "v1", field: "body", preview: "<script>x</script> prior", by: "consultant", at: "2026-06-21 10:00 UTC" },
    ],
    notice: "Version restored. The change is recorded in the audit trail.",
  };
  const doc = renderHistory(v);
  a11y("history-rows", doc);
  assert.match(doc, /Current \(live\) value/);
  assert.match(doc, /Live body text/);
  assert.match(doc, /Restore this version/, "rollback action present");
  assert.match(doc, /action="\/console\/history\/rollback"/, "rollback posts to server");
  assert.match(doc, /action="\/console\/history\/note"/, "note form present");
  assert.match(doc, /name="versionId" value="v1"/, "version id wired");
  assert.doesNotMatch(doc, /<script>x<\/script>/, "prior value is escaped (no live script)");
  assert.match(doc, /&lt;script&gt;/, "prior value shown as escaped text");
  assert.match(doc, /recorded in the audit trail/, "notice rendered");
});
