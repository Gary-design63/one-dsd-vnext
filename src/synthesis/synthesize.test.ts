import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBrief, needsExternalResearch, jaccard, clusterPassages } from "./synthesize.js";
import type { SourcePassage } from "./types.js";

const src = (assetId: string, content: string, themes: string[] = [], chunkId = assetId + "-c"): SourcePassage =>
  ({ chunkId, assetId, title: `Asset ${assetId}`, content, themes });

test("clusters near-duplicate passages together, keeps distinct ones apart", () => {
  const c = clusterPassages([
    src("a", "psychological safety means staff can speak up without fear of punishment"),
    src("b", "psychological safety lets staff speak up without fear or punishment"),
    src("c", "supplier diversity expands procurement to underrepresented businesses"),
  ]);
  assert.equal(c.length, 2);
});

test("corroborated point: two distinct assets saying the same thing", () => {
  const brief = buildBrief("psych safety", [
    src("a", "psychological safety means staff can speak up without fear of punishment"),
    src("b", "psychological safety means staff speak up without fear of punishment"),
  ]);
  assert.equal(brief.keyPoints[0]!.corroborated, true);
  assert.ok(brief.keyPoints[0]!.assetIds.length >= 2);
  assert.equal(brief.citations.length, 2);
});

test("conflict: opposing negation polarity within a topic is flagged for review", () => {
  const brief = buildBrief("eligibility", [
    src("a", "staff on extended leave are eligible for the stipend during the period"),
    src("b", "staff on extended leave are not eligible for the stipend during the period"),
  ]);
  assert.ok(brief.conflicts.length >= 1);
  assert.equal(brief.conflicts[0]!.reason, "negation_polarity");
  assert.match(brief.conflicts[0]!.note, /needs human review/i);
});

test("conflict: numeric mismatch within a topic is flagged", () => {
  const brief = buildBrief("threshold", [
    src("a", "purchases above 10000 require additional approval from leadership"),
    src("b", "purchases above 25000 require additional approval from leadership"),
  ]);
  assert.ok(brief.conflicts.some((c) => c.reason === "numeric_mismatch"));
});

test("gap-map: requested themes not present are reported as missing", () => {
  const brief = buildBrief("q", [src("a", "leadership development content", ["leadership_development"])],
    { requestedThemes: ["leadership_development", "service_delivery_equity"] });
  assert.deepEqual(brief.coveredThemes, ["leadership_development"]);
  assert.deepEqual(brief.missingThemes, ["service_delivery_equity"]);
});

test("needsExternalResearch true on gaps, empty, or low confidence; false on solid coverage", () => {
  const empty = buildBrief("q", []);
  assert.equal(needsExternalResearch(empty), true);

  const gappy = buildBrief("q", [src("a", "x", ["t1"])], { requestedThemes: ["t1", "t2"] });
  assert.equal(needsExternalResearch(gappy), true);

  const solid = buildBrief("q", [
    src("a", "psychological safety means staff can speak up without fear", ["t1"]),
    src("b", "psychological safety means staff can speak up without fear", ["t1"]),
  ], { requestedThemes: ["t1"] });
  assert.equal(needsExternalResearch(solid), false);
});

test("never fabricates: brief.narrative is null without a provider", () => {
  const brief = buildBrief("q", [src("a", "content")]);
  assert.equal(brief.narrative, null);
});

test("jaccard sanity", () => {
  assert.equal(jaccard(new Set(["a","b"]), new Set(["a","b"])), 1);
  assert.equal(jaccard(new Set(["a"]), new Set(["b"])), 0);
});
