// =====================================================================
// One DSD vNext — Ask core tests (Layer 9): the trust gate + fusion.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideDisposition, DEFAULT_THRESHOLDS, framingFor } from "./confidence.js";
import { reciprocalRankFusion, normalize } from "./fusion.js";
import type { Candidate } from "./types.js";

function cand(id: string, hybrid: number): Candidate {
  return { chunkId: id, assetId: id, title: id, visibility: "staff", content: "x", ftsScore: hybrid, vectorScore: 0, hybrid };
}

test("empty corpus -> refuse, never answer", () => {
  const d = decideDisposition([]);
  assert.equal(d.disposition, "insufficient_source");
  assert.equal(d.confidence, 0);
});

test("strong top + support -> answered (vetted content shown)", () => {
  const d = decideDisposition([cand("a", 0.8), cand("b", 0.6)]);
  assert.equal(d.disposition, "answered");
  assert.ok(d.confidence > 0.5, `confidence ${d.confidence}`);
});

test("relevant-but-modest top -> answered (no consultant routing)", () => {
  const d = decideDisposition([cand("a", 0.4)]);
  assert.equal(d.disposition, "answered");
});

test("below relevance floor -> insufficient_source (honest, no routing)", () => {
  const d = decideDisposition([cand("a", 0.2)]);
  assert.equal(d.disposition, "insufficient_source");
});

test("minSupport can require more than one relevant hit", () => {
  const strict = { ...DEFAULT_THRESHOLDS, minSupport: 2 };
  const d = decideDisposition([cand("a", 0.6)], strict);
  assert.equal(d.disposition, "insufficient_source");
});

test("framing is human, never fabricates, never routes", () => {
  assert.match(framingFor("insufficient_source"), /Nothing has been made up/);
  assert.match(framingFor("answered"), /approved One DSD library/);
  for (const d of ["answered","insufficient_source"] as const) {
    assert.doesNotMatch(framingFor(d), /\bAI\b/);
  }
});

test("RRF fuses two rankings; items in both rank higher", () => {
  const fused = reciprocalRankFusion([
    { id: "both", ftsRank: 1, vectorRank: 1 },
    { id: "fts_only", ftsRank: 2 },
    { id: "vec_only", vectorRank: 2 },
  ]);
  assert.equal(fused[0]!.id, "both");
});

test("RRF works on FTS alone (vector weight 0 path)", () => {
  const fused = reciprocalRankFusion(
    [{ id: "a", ftsRank: 1 }, { id: "b", ftsRank: 2 }],
    { fts: 1, vector: 0 },
  );
  assert.equal(fused[0]!.id, "a");
  assert.ok(fused[0]!.score > fused[1]!.score);
});

test("normalize is stable on empty and equal inputs", () => {
  assert.deepEqual(normalize([]), []);
  assert.deepEqual(normalize([5, 5]), [1, 1]);
  assert.deepEqual(normalize([0, 0]), [0, 0]);
  const n = normalize([0, 5, 10]);
  assert.equal(n[0], 0); assert.equal(n[2], 1);
});
