// =====================================================================
// One DSD vNext — security headers (Layer 6)
// Applied to every response. Conservative defaults; the CSP is strict and
// can be relaxed per-route only with an explicit reason. Mirrors the
// hardening extracted from the live app's vercel.json, but enforced in-app
// so it is portable to Azure Container Apps (no platform dependency).
// =====================================================================
import type { ServerResponse } from "node:http";

export interface SecurityHeaderOptions {
  /** Allow inline styles only if a route truly needs it (default false). */
  allowInlineStyle?: boolean;
  /** Extra connect-src origins (e.g. the API host) if the page is split. */
  connectSrc?: string[];
}

export function buildCsp(opts: SecurityHeaderOptions = {}): string {
  const style = opts.allowInlineStyle ? "'self' 'unsafe-inline'" : "'self'";
  const connect = ["'self'", ...(opts.connectSrc ?? [])].join(" ");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:", // audio renders
    `style-src ${style}`,
    "script-src 'self'",
    `connect-src ${connect}`,
    "upgrade-insecure-requests",
  ].join("; ");
}

export function applySecurityHeaders(
  res: ServerResponse,
  opts: SecurityHeaderOptions = {},
): void {
  res.setHeader("Content-Security-Policy", buildCsp(opts));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
}
