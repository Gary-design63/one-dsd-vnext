// =====================================================================
// One DSD vNext — structured logging + error-capture seam (observability).
// Emits one JSON object per line (App Insights / OTel collectors ingest this
// directly). Never logs request bodies, passwords, tokens, cookies, or keys —
// a redaction net catches sensitive field names. An optional error exporter
// (Sentry/App Insights) plugs in via setErrorExporter; default is a no-op so
// there is zero external dependency until you choose one.
// =====================================================================
export type Level = "debug" | "info" | "warn" | "error";

const REDACT_KEY = /pass|token|secret|authorization|cookie|\bkey\b|session/i;
const REDACTED = "[redacted]";

/** Redact sensitive-looking keys (shallow + one level deep). */
export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT_KEY.test(k)) { out[k] = REDACTED; continue; }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner: Record<string, unknown> = {};
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) {
        inner[ik] = REDACT_KEY.test(ik) ? REDACTED : iv;
      }
      out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Pure formatter (testable): the exact JSON line we would write. */
export function formatLog(level: Level, msg: string, fields: Record<string, unknown> = {}, now = new Date()): string {
  return JSON.stringify({ ts: now.toISOString(), level, msg, ...redact(fields) });
}

export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const line = formatLog(level, msg, fields);
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

// --- error exporter seam (no-op until configured) --------------------
export type ErrorExporter = (err: unknown, ctx: Record<string, unknown>) => void;
let exporter: ErrorExporter | null = null;
export function setErrorExporter(fn: ErrorExporter | null): void { exporter = fn; }

export function captureError(err: unknown, ctx: Record<string, unknown> = {}): void {
  const e = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { message: String(err) };
  log("error", "unhandled_error", { ...ctx, error: e });
  if (exporter) { try { exporter(err, ctx); } catch { /* never let logging crash the request */ } }
}
