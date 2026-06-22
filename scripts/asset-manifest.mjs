#!/usr/bin/env node
// Generates web-static/asset-manifest.json: { "app.css": "ab12cd34ef56", ... }
// A short content hash per static asset, used for cache-busting + immutable
// long-cache. Run as part of `npm run build`.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "web-static");
const manifest = {};
for (const name of readdirSync(dir)) {
  if (name === "asset-manifest.json") continue;
  const full = join(dir, name);
  if (!statSync(full).isFile()) continue;
  manifest[name] = createHash("sha256").update(readFileSync(full)).digest("hex").slice(0, 12);
}
writeFileSync(join(dir, "asset-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`asset-manifest: ${Object.keys(manifest).length} asset(s) fingerprinted`);
