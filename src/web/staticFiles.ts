// =====================================================================
// One DSD vNext — static file server (Layer 7)
// Serves web-static/ under /static/*. Path-traversal-safe (resolved path
// must stay inside the root), correct content-types, long cache for
// fingerprintable assets. No directory listing.
// =====================================================================
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, resolve, extname } from "node:path";
import type { ServerResponse } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
// dist/web -> repo root -> web-static
const ROOT = resolve(here, "..", "..", "web-static");

const TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export async function serveStatic(
  res: ServerResponse,
  urlPath: string,
  versioned = false,
): Promise<void> {
  // urlPath like "/static/app.css" -> "app.css"
  const rel = normalize(urlPath.replace(/^\/static\//, "")).replace(/^(\.\.[/\\])+/, "");
  const full = join(ROOT, rel);
  if (!full.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  try {
    const s = await stat(full);
    if (!s.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", TYPES[extname(full)] ?? "application/octet-stream");
    res.setHeader("Cache-Control", versioned ? "public, max-age=31536000, immutable" : "public, max-age=3600");
    createReadStream(full).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}
