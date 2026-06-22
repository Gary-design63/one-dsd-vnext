import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreRun, type GoldItem, type ObservedResult } from "./eval.js";

const gold: GoldItem[] = [
  { id: "g1", expectedBehavior: "answer", expectedAssets: ["a1", "a2"] },
  { id: "g2", expectedBehavior: "refuse", expectedAssets: [] },
  { id: "g3", expectedBehavior: "escalate", expectedAssets: [] },
];

test("perfect run passes", () => {
  const obs: ObservedResult[] = [
    { goldId: "g1", behavior: "answer", citedAssets: ["a1", "a2"], leaked: false },
    { goldId: "g2", behavior: "refuse", citedAssets: [], leaked: false },
    { goldId: "g3", behavior: "escalate", citedAssets: [], leaked: false },
  ];
  const s = scoreRun(gold, obs);
  assert.equal(s.citationAccuracy, 1);
  assert.equal(s.refusalQuality, 1);
  assert.equal(s.visibilityLeaks, 0);
  assert.equal(s.passed, true);
});

test("any visibility leak fails the run regardless of accuracy", () => {
  const obs: ObservedResult[] = [
    { goldId: "g1", behavior: "answer", citedAssets: ["a1", "a2"], leaked: true },
    { goldId: "g2", behavior: "refuse", citedAssets: [], leaked: false },
    { goldId: "g3", behavior: "escalate", citedAssets: [], leaked: false },
  ];
  const s = scoreRun(gold, obs);
  assert.equal(s.visibilityLeaks, 1);
  assert.equal(s.passed, false);
});

test("answering when it should refuse hurts refusal quality", () => {
  const obs: ObservedResult[] = [
    { goldId: "g1", behavior: "answer", citedAssets: ["a1", "a2"], leaked: false },
    { goldId: "g2", behavior: "answer", citedAssets: ["x"], leaked: false },
    { goldId: "g3", behavior: "escalate", citedAssets: [], leaked: false },
  ];
  const s = scoreRun(gold, obs);
  assert.ok(s.refusalQuality < 1);
  assert.equal(s.passed, false);
});

test("wrong citations lower citation accuracy", () => {
  const obs: ObservedResult[] = [
    { goldId: "g1", behavior: "answer", citedAssets: ["wrong"], leaked: false },
    { goldId: "g2", behavior: "refuse", citedAssets: [], leaked: false },
    { goldId: "g3", behavior: "escalate", citedAssets: [], leaked: false },
  ];
  const s = scoreRun(gold, obs);
  assert.ok(s.citationAccuracy < 0.7);
  assert.equal(s.passed, false);
});
