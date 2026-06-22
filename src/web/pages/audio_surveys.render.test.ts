import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAudio } from "./audio.js";
import { renderSurveys } from "./surveys.js";
import type { NavContext } from "../viewModels.js";

const nav: NavContext = { viewer: { userId: "u", roles: ["consultant"] } };

function a11y(label: string, doc: string): void {
  assert.match(doc, /<html lang="en">/, `${label}: lang`);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1, `${label}: one h1`);
  assert.match(doc, /class="skip-link"/, `${label}: skip link`);
  assert.doesNotMatch(doc, /\bAI\b/, `${label}: no "AI"`);
  assert.doesNotMatch(doc, /artificial intelligence/i, `${label}: no "artificial intelligence"`);
  assert.doesNotMatch(doc, /\sstyle=/, `${label}: no inline style`);
}

test("audio: lists episodes, player when ready, editable in edit mode, escapes title", () => {
  const doc = renderAudio({
    nav, editMode: true, copy: {},
    episodes: [
      { id: "e1", title: "<b>Ep One</b>", summary: "A talk", episodeNo: 1, seasonNo: 1, audioUrl: "/static/x.mp3", durationMin: 12 },
      { id: "e2", title: "Ep Two", summary: null, episodeNo: 2, seasonNo: 1, audioUrl: null, durationMin: null },
    ],
  });
  a11y("audio", doc);
  assert.match(doc, /<audio[^>]+controls/, "native audio player present");
  assert.match(doc, /Audio for this episode is being prepared/, "no-render fallback");
  assert.match(doc, /data-edit-endpoint="\/api\/edit\/podcast_episode\/e1"/, "episode editable");
  assert.match(doc, /data-edit-endpoint="\/api\/edit\/copy\/audio\.intro\.title"/, "page copy editable");
  assert.doesNotMatch(doc, /<b>Ep One<\/b>/, "title is escaped");
});

test("audio: empty state, no edit markers when not editing", () => {
  const doc = renderAudio({ nav, editMode: false, episodes: [] });
  a11y("audio-empty", doc);
  assert.match(doc, /No episodes are published yet/);
  assert.doesNotMatch(doc, /data-editable/);
});

test("surveys: shows only distributed items, confidentiality framing, editable in edit mode", () => {
  const doc = renderSurveys({
    nav, editMode: true, copy: {},
    items: [
      { id: "i1", title: "Engagement Pulse", description: "Quick check-in", kind: "engagement", closesOn: "2026-07-01" },
      { id: "i2", title: "Annual DEIA", description: null, kind: "annual_deia", closesOn: null },
    ],
  });
  a11y("surveys", doc);
  assert.match(doc, /aggregate/i, "confidentiality framing present");
  assert.match(doc, /Engagement survey/, "kind label rendered");
  assert.match(doc, /Open until 2026-07-01/, "close date shown");
  assert.match(doc, /data-edit-endpoint="\/api\/edit\/instrument\/i1"/, "instrument editable");
  assert.match(doc, /data-edit-endpoint="\/api\/edit\/copy\/surveys\.intro\.lede"/, "page copy editable");
});

test("surveys: empty state communicates nothing-to-do, no surveillance wording", () => {
  const doc = renderSurveys({ nav, editMode: false, items: [] });
  a11y("surveys-empty", doc);
  assert.match(doc, /Nothing is waiting for your input/);
  assert.doesNotMatch(doc, /surveil/i);
});
