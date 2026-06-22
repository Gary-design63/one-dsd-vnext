import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, _resetRateLimits } from "./ratelimit.js";

test("allows up to the limit, then blocks with Retry-After, then resets", () => {
  _resetRateLimits();
  const key = "signin:1.2.3.4";
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) {
    const r = rateLimit(key, 3, 1000, t0);
    assert.equal(r.ok, true, `attempt ${i + 1} allowed`);
  }
  const blocked = rateLimit(key, 3, 1000, t0);
  assert.equal(blocked.ok, false, "4th blocked");
  assert.ok(blocked.retryAfterSec >= 1, "retry-after set");

  // after the window, allowed again
  const after = rateLimit(key, 3, 1000, t0 + 1001);
  assert.equal(after.ok, true, "allowed after window reset");
});

test("separate keys have independent budgets", () => {
  _resetRateLimits();
  const t = 5000;
  assert.equal(rateLimit("ask:a", 1, 1000, t).ok, true);
  assert.equal(rateLimit("ask:a", 1, 1000, t).ok, false, "a exhausted");
  assert.equal(rateLimit("ask:b", 1, 1000, t).ok, true, "b independent");
});
