// =====================================================================
// One DSD vNext — static asset versioning (cache-busting + immutable).
// Reads web-static/asset-manifest.json (built by scripts/asset-manifest.mjs)
// and appends a content hash to each static URL: /static/app.css?v=<hash>.
// The static server serves any ?v= request with a 1-year immutable cache,
// so changing a file changes its hash (and URL), busting the cache safely.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = resolve(here, "..", "..", "web-static", "asset-manifest.json");

let manifest: Record<string, string> = {};
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Record<string, string>;
} catch {
  manifest = {}; // dev / pre-build: fall back to unversioned URLs
}

/** Map a /static path or bare filename to a content-hashed URL. */
export function assetUrl(path: string): string {
  const name = path.replace(/^\/static\//, "");
  const hash = manifest[name];
  return hash ? `/static/${name}?v=${hash}` : `/static/${name}`;
}

/** True when a request carries a content-hash version param (=> immutable). */
export function isVersioned(search: string | null | undefined): boolean {
  return typeof search === "string" && /(?:^|[?&])v=[0-9a-f]{6,}/.test(search);
}
