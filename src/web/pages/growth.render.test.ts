import { test } from "node:test";
import assert from "node:assert/strict";
import { renderGrowth } from "./growth.js";
import type { NavContext } from "../viewModels.js";

const nav: NavContext = { viewer: { userId: "u", roles: ["staff"] } };
function a11y(label: string, doc: string): void {
  assert.match(doc, /<html lang="en">/, `${label}: lang`);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1, `${label}: one h1`);
  assert.match(doc, /class="skip-link"/, `${label}: skip link`);
  assert.doesNotMatch(doc, /\bAI\b/, `${label}: no AI`);
  assert.doesNotMatch(doc, /\sstyle=/, `${label}: no inline style`);
  assert.doesNotMatch(doc, /manager|supervisor|\bHR\b|surveil/i, `${label}: no HR/surveillance language`);
}

test("no consent: opt-in only, nothing generated shown", () => {
  const doc = renderGrowth({ nav, consented: false, recommendations: [], themes: [] });
  a11y("growth-optin", doc);
  assert.match(doc, /Turn on personalized suggestions/);
  assert.match(doc, /never used for reviews/);
});

test("consented: suggestions with rationale + accept/dismiss + turn-off", () => {
  const doc = renderGrowth({
    nav, consented: true,
    recommendations: [{ id: "r1", pathId: "p1", title: "Leading with psychological safety", rationale: "matches your interest in well-being." }],
    themes: [{ key: "leadership_development", label: "Leadership development", selected: true }],
  });
  a11y("growth-consented", doc);
  assert.match(doc, /Add to my paths/);
  assert.match(doc, /Not for me/);
  assert.match(doc, /Turn off personalized suggestions/);
  assert.match(doc, /matches your interest/);
});
