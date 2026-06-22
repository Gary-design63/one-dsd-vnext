import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAsk, renderAskResult } from "./ask.js";
import type { NavContext } from "../viewModels.js";

const nav: NavContext = { viewer: { userId: "u", roles: ["staff"] } };

function a11y(label: string, doc: string): void {
  assert.match(doc, /<html lang="en">/, `${label}: lang`);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1, `${label}: one h1`);
  assert.match(doc, /class="skip-link"/, `${label}: skip link`);
  assert.doesNotMatch(doc, /\bAI\b/, `${label}: no "AI"`);
  assert.doesNotMatch(doc, /artificial intelligence/i, `${label}: no "artificial intelligence"`);
  assert.doesNotMatch(doc, /\sstyle=/, `${label}: no inline style`);
}

test("ask page renders, labeled input, no AI wording", () => {
  const doc = renderAsk(nav);
  a11y("ask", doc);
  assert.match(doc, /<label for="q">/);
  assert.match(doc, /Professional Support/);
});

test("ask result: answered shows sources; refused shows honest framing, no fabrication", () => {
  const answered = renderAskResult(nav, "How do I do X?", {
    disposition: "answered", confidence: 0.8,
    answer: "From the guide:\n\nDo X carefully.", citations: [{ assetId: "11111111-1111-1111-1111-111111111111", title: "The Guide" }],
    message: "Here is what the approved One DSD library says, with sources.", usedProvider: false,
  });
  a11y("ask-answered", answered);
  assert.match(answered, /The Guide/);
  assert.match(answered, /Sources/);

  const refused = renderAskResult(nav, "Obscure?", {
    disposition: "insufficient_source", confidence: 0,
    answer: null, citations: [], message: "The approved library does not yet cover this. Nothing has been made up — this has been flagged so it can be addressed.", usedProvider: false,
  });
  a11y("ask-refused", refused);
  assert.match(refused, /Nothing has been made up/);
  assert.doesNotMatch(refused, /Sources/);
});
