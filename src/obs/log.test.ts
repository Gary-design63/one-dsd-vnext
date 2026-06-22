import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLog, redact, captureError } from "./log.js";

test("formatLog emits one-line JSON with ts/level/msg", () => {
  const line = formatLog("info", "request", { path: "/library", status: 200 }, new Date("2026-06-21T00:00:00Z"));
  assert.doesNotMatch(line, /\n/, "single line");
  const o = JSON.parse(line);
  assert.equal(o.level, "info");
  assert.equal(o.msg, "request");
  assert.equal(o.path, "/library");
  assert.equal(o.status, 200);
  assert.equal(o.ts, "2026-06-21T00:00:00.000Z");
});

test("redaction hides sensitive field names (shallow + nested)", () => {
  const r = redact({ path: "/x", password: "hunter2", token: "abc", nested: { sessionToken: "z", ok: 1 } });
  assert.equal(r.password, "[redacted]");
  assert.equal(r.token, "[redacted]");
  assert.equal((r.nested as any).sessionToken, "[redacted]");
  assert.equal((r.nested as any).ok, 1);
  assert.equal(r.path, "/x");
});

test("captureError never throws and logs structured error", () => {
  const errs: string[] = [];
  const orig = process.stderr.write.bind(process.stderr);
  (process.stderr as any).write = (s: string) => { errs.push(String(s)); return true; };
  try {
    captureError(new Error("boom"), { id: "r1", path: "/ask" });
  } finally {
    (process.stderr as any).write = orig;
  }
  const o = JSON.parse(errs.join(""));
  assert.equal(o.level, "error");
  assert.equal(o.msg, "unhandled_error");
  assert.equal(o.path, "/ask");
  assert.equal(o.error.message, "boom");
});
