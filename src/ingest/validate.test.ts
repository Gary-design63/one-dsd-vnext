import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRow, normalizedPayload } from "./validate.js";

test("valid asset row passes", () => {
  const r = validateRow({ source_id: "leg-001", decision: "keep", kind: "asset", title: "Plain-language MnCHOICES guide", summary: "A clear walkthrough.", body: "Body text.", format: "guide", proficiency_band: "emerging", discipline_cluster: "HRC", visibility: "staff" });
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.equal(r.errors.length, 0);
});

test("missing source_id, bad decision/kind are rejected", () => {
  const r = validateRow({ decision: "maybe", kind: "thing", title: "x" });
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /source_id is required/);
  assert.match(r.errors.join("\n"), /decision must be one of/);
  assert.match(r.errors.join("\n"), /kind must be one of/);
});

test("bad enums rejected (format/proficiency/visibility/cluster)", () => {
  const r = validateRow({ source_id: "a", decision: "keep", kind: "asset", title: "t", format: "pdf", proficiency_band: "expert", visibility: "public", discipline_cluster: "ZZ" });
  const e = r.errors.join("\n");
  assert.match(e, /format must be one of/);
  assert.match(e, /proficiency_band must be one of/);
  assert.match(e, /visibility must be one of/);
  assert.match(e, /discipline_cluster must be a known code/);
});

test("PII is blocked (email, SSN, phone)", () => {
  for (const bad of ["reach me at jane.doe@example.com", "SSN 123-45-6789", "call 612-555-0147"]) {
    const r = validateRow({ source_id: "p", decision: "keep", kind: "asset", title: "t", body: bad });
    assert.equal(r.ok, false, `should reject: ${bad}`);
    assert.match(r.errors.join("\n"), /no client PII may be ingested/);
  }
});

test('"AI" wording is blocked anywhere', () => {
  const r = validateRow({ source_id: "ai", decision: "keep", kind: "asset", title: "Our AI assistant" });
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /"AI" wording is not allowed/);
});

test("retire rows need only id+decision+kind", () => {
  const r = validateRow({ source_id: "old-9", decision: "retire", kind: "asset" });
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("collection requires label; missing visibility warns not errors", () => {
  const r = validateRow({ source_id: "c1", decision: "keep", kind: "collection", label: "Orientation" });
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.match(r.warnings.join("\n"), /default to "staff"/);
});

test("normalized payload is stable regardless of key order / empty fields", () => {
  const a = normalizedPayload({ source_id: "x", kind: "asset", title: "T", body: "B", summary: "" });
  const b = normalizedPayload({ body: "B", title: "T", kind: "asset" });
  assert.equal(a, b, "same content => same hash input");
});
