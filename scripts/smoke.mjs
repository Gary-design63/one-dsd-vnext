#!/usr/bin/env node
// One DSD vNext — smoke test (no database needed).
// Boots the built app on an ephemeral port and asserts the contracts that
// must hold on every deploy: health is OK, security headers are present,
// fingerprinted assets are served immutably, and unknown routes are real 404s.
import { createApp } from "../dist/server.js";

const server = createApp();
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
let failures = 0;
const ok = (m) => console.log("ok  -", m);
const bad = (m) => { failures++; console.error("FAIL-", m); };

async function main() {
  // 1. health
  let res = await fetch(`${base}/healthz`);
  const body = await res.json().catch(() => ({}));
  res.status === 200 && body.status === "ok" ? ok("/healthz 200 {status:ok}") : bad(`/healthz => ${res.status}`);

  // 2. security headers on every response
  for (const h of ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy"]) {
    res.headers.get(h) ? ok(`header ${h}`) : bad(`missing header ${h}`);
  }

  // 3. fingerprinted asset is immutable; unversioned is short-cache
  const verRes = await fetch(`${base}/static/app.css?v=deadbeef1234`);
  (verRes.status === 200 && /immutable/.test(verRes.headers.get("cache-control") || "")) ? ok("versioned asset immutable") : bad(`versioned asset cache: ${verRes.headers.get("cache-control")}`);
  const plainRes = await fetch(`${base}/static/app.css`);
  (plainRes.status === 200 && !/immutable/.test(plainRes.headers.get("cache-control") || "")) ? ok("unversioned asset not immutable") : bad("unversioned asset cache wrong");

  // 4. unknown API path is a real JSON 404 (not an HTML shell)
  const nf = await fetch(`${base}/api/does-not-exist`);
  nf.status === 404 ? ok("unknown route => 404") : bad(`unknown route => ${nf.status}`);

  // 5. request id header present (observability)
  res.headers.get("x-request-id") ? ok("x-request-id present") : bad("missing x-request-id");
}

try { await main(); } catch (e) { bad(String(e)); }
finally { server.close(); }
console.log(failures === 0 ? "\nSMOKE OK" : `\n${failures} smoke check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
