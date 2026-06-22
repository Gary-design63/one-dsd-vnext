import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreRecommendations, type LearnerProfile, type PathCandidate } from "./score.js";

const profile: LearnerProfile = {
  interests: ["wellbeing_psych_safety", "leadership_development"],
  completedThemes: ["intercultural_practice"],
  enrolledPathIds: ["p-enrolled"],
  level: "applied",
};
const candidates: PathCandidate[] = [
  { pathId: "p1", title: "Leading with psychological safety", themes: ["wellbeing_psych_safety", "leadership_development"], band: "applied", moduleCount: 5 },
  { pathId: "p2", title: "Advanced equity strategy", themes: ["workplace_equity"], band: "advanced", moduleCount: 6 },
  { pathId: "p-enrolled", title: "Already in this", themes: ["wellbeing_psych_safety"], band: "applied", moduleCount: 3 },
  { pathId: "p3", title: "Unrelated emerging basics", themes: ["service_delivery_equity"], band: "emerging", moduleCount: 4 },
];

test("interest + level match ranks highest, with transparent rationale", () => {
  const recs = scoreRecommendations(profile, candidates);
  assert.equal(recs[0]!.pathId, "p1");
  assert.match(recs[0]!.rationale, /matches your interest/);
  assert.match(recs[0]!.rationale, /current level/);
});

test("already-enrolled paths are never re-suggested", () => {
  const recs = scoreRecommendations(profile, candidates);
  assert.ok(!recs.some((r) => r.pathId === "p-enrolled"));
});

test("suggestions are bounded and scored 0..1", () => {
  const recs = scoreRecommendations(profile, candidates, 2);
  assert.ok(recs.length <= 2);
  for (const r of recs) assert.ok(r.score > 0 && r.score <= 1);
});

test("rationale is always present (transparency) and never mentions other people or HR", () => {
  const recs = scoreRecommendations(profile, candidates);
  for (const r of recs) {
    assert.ok(r.rationale.length > 0);
    assert.doesNotMatch(r.rationale, /manager|supervisor|HR|peer|colleague|compared/i);
  }
});
