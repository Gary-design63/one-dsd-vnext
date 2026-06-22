// =====================================================================
// One DSD vNext — page render + accessibility tests (Layer 7)
// Renders every page with mock view models and asserts the structural
// accessibility contract + XSS-safety. No DB, no network.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHome } from "./home.js";
import { renderSignIn } from "./signin.js";
import { renderLibrary } from "./library.js";
import { renderAsset } from "./asset.js";
import { renderLearningIndex, renderLearningPath } from "./learning.js";
import { renderCalendar } from "./calendar.js";
import { esc, html } from "../render.js";
import type { NavContext } from "../viewModels.js";

const nav: NavContext = { viewer: { userId: "u1", roles: ["staff"] } };

function a11yContract(label: string, doc: string): void {
  assert.match(doc, /<html lang="en">/, `${label}: has lang`);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1, `${label}: exactly one <h1>`);
  assert.match(doc, /class="skip-link"/, `${label}: has skip link`);
  assert.match(doc, /<main id="main"/, `${label}: has main landmark`);
  assert.match(doc, /rel="stylesheet" href="\/static\/app\.css(\?v=[0-9a-f]+)?"/, `${label}: links app.css`);
  // CSP-safety: no inline styles or inline event handlers anywhere.
  assert.doesNotMatch(doc, /\sstyle=/, `${label}: no inline style attributes`);
  assert.doesNotMatch(doc, /\bAI\b/, `${label}: program surface must not mention "AI"`);
  assert.doesNotMatch(doc, /artificial intelligence/i, `${label}: no "artificial intelligence"`);
  assert.doesNotMatch(doc, /\son(click|load|error|mouseover)=/i, `${label}: no inline event handlers`);
  assert.doesNotMatch(doc, /<script>(?!<\/)/, `${label}: no inline <script> body`);
}

test("home renders and meets a11y contract", () => {
  const doc = renderHome({
    nav: { viewer: nav.viewer, active: "home" },
    greetingName: "Sam",
    doors: [{ key: "d1", label: "Start", description: "Begin here", href: "/learning" }],
    featured: [{ id: "11111111-1111-1111-1111-111111111111", title: "A", summary: "s", format: "guide", proficiencyBand: "applied", primaryTrack: null, disciplineCluster: "SBS" }],
  });
  a11yContract("home", doc);
  assert.match(doc, /Start/);
});

test("sign-in renders with labeled inputs", () => {
  const doc = renderSignIn({ error: "Bad creds" });
  a11yContract("signin", doc);
  assert.match(doc, /<label for="identifier">/);
  assert.match(doc, /<label for="password">/);
  assert.match(doc, /role="alert"/);
});

test("library renders facets and result count", () => {
  const doc = renderLibrary({
    nav: { viewer: nav.viewer, active: "library" },
    items: [],
    total: 0,
    limit: 25,
    offset: 0,
    facets: {
      cluster: [{ key: "SBS", label: "Social", count: 3, selected: true }],
      format: [{ key: "guide", label: "Guide" }],
      proficiency: [{ key: "applied", label: "Applied" }],
    },
  });
  a11yContract("library", doc);
  assert.match(doc, /<label for="q">/);
  assert.match(doc, /aria-live="polite"/);
  assert.match(doc, /checked/); // selected facet
});

test("asset renders audio control and escapes body", () => {
  const doc = renderAsset({
    nav: { viewer: nav.viewer, active: "library" },
    asset: {
      id: "22222222-2222-2222-2222-222222222222",
      title: "Safe <script>alert(1)</script>",
      summary: null,
      format: "brief",
      proficiencyBand: null,
      primaryTrack: null,
      disciplineCluster: null,
      body: "Para one.\n\nPara two with <b>tags</b>.",
    },
  });
  a11yContract("asset", doc);
  assert.match(doc, /data-reader-toggle/);
  // XSS: the script tag in the title must be escaped, not live.
  assert.doesNotMatch(doc, /<script>alert\(1\)<\/script>/);
  assert.ok(doc.includes(esc("<script>alert(1)</script>")), "escaped script present as text");
});

test("learning index + path render with progress", () => {
  const idx = renderLearningIndex({
    nav: { viewer: nav.viewer, active: "learning" },
    paths: [{ id: "33333333-3333-3333-3333-333333333333", title: "Path", summary: null, proficiencyBand: "emerging", moduleCount: 2 }],
  });
  a11yContract("learning-index", idx);

  const path = renderLearningPath({
    nav: { viewer: nav.viewer, active: "learning" },
    path: { id: "33333333-3333-3333-3333-333333333333", title: "Path", summary: "s", proficiencyBand: "emerging", idcStage: "minimization" },
    modules: [
      { id: "m1", ordinal: 1, title: "Read it", kind: "read", estimatedMinutes: 5, state: "completed" },
      { id: "m2", ordinal: 2, title: "Practice", kind: "practice", estimatedMinutes: 10, state: "not_started" },
    ],
    completedCount: 1,
  });
  a11yContract("learning-path", path);
  assert.match(path, /data-pct="50"/);
  assert.match(path, /1 of 2 complete/);
});

test("calendar renders humility + tribal-referral guardrail", () => {
  const doc = renderCalendar({
    nav: { viewer: nav.viewer, active: "calendar" },
    monthLabel: "June 2026",
    entries: [
      { id: "c1", title: "Heritage Month", startsOn: "2026-06-01", kind: "heritage_month", sensitivity: "tribal_referral", humilityNote: "Defer to community voice." },
    ],
  });
  a11yContract("calendar", doc);
  assert.match(doc, /refer, do not synthesize/i);
  assert.match(doc, /<time/);
});

test("esc neutralizes html and html`` escapes interpolations", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(html`<p>${"<b>"}</p>`.value, "<p>&lt;b&gt;</p>");
});
