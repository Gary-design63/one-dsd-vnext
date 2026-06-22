import { test } from "node:test";
import assert from "node:assert/strict";
import { isVersioned } from "./assets.js";
import { renderAsk } from "./pages/ask.js";

test("isVersioned detects content-hash param", () => {
  assert.equal(isVersioned("?v=243e5bbeafbf"), true);
  assert.equal(isVersioned("?foo=1"), false);
  assert.equal(isVersioned(null), false);
});

test("rendered pages reference a versioned stylesheet (cache-busting)", () => {
  const doc = renderAsk({ viewer: { userId: "u", roles: ["staff"] } });
  // app.css is referenced with a ?v= content hash so it can be immutably cached
  assert.match(doc, /\/static\/app\.css\?v=[0-9a-f]{6,}/, "stylesheet is fingerprinted");
});
