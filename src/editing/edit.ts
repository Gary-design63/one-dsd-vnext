// =====================================================================
// One DSD vNext — in-place editing core (pure) — authority + safety.
// Inline editing is CONSULTANT/ADMIN only, field-allowlisted (an edit can
// never set an arbitrary column), length-bounded, and — at the call site —
// versioned + audited. Pure functions here so the rules are unit-tested.
// =====================================================================
import type { Viewer } from "../access/visibility.js";

const AUTHORITY = new Set(["consultant", "admin"]);
export function canEdit(viewer: Viewer): boolean {
  return viewer.roles.some((r) => AUTHORITY.has(r));
}

// Only these asset fields may ever be edited in place.
const ASSET_FIELDS = new Set(["title", "summary", "body"]);
const LIMITS: Record<string, number> = { title: 300, summary: 2000, body: 200000 };

export type PatchResult =
  | { ok: true; fields: Record<string, string> }
  | { ok: false; reason: string };

/** Validate an incoming asset edit: allowlisted keys, typed, bounded,
 *  non-empty title. Returns only the clean, allowed fields. Fail-closed. */
export function validateAssetPatch(input: unknown): PatchResult {
  if (!input || typeof input !== "object") return { ok: false, reason: "no fields" };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!ASSET_FIELDS.has(k)) return { ok: false, reason: `field not editable: ${k}` };
    if (typeof v !== "string") return { ok: false, reason: `field must be text: ${k}` };
    if (v.length > (LIMITS[k] ?? 0)) return { ok: false, reason: `field too long: ${k}` };
    out[k] = v;
  }
  if (Object.keys(out).length === 0) return { ok: false, reason: "no editable fields" };
  if ("title" in out && out["title"]!.trim().length === 0) {
    return { ok: false, reason: "title cannot be empty" };
  }
  return { ok: true, fields: out };
}

/** Validate a page-copy edit (single key/value). */
export function validateCopy(value: unknown): PatchResult {
  if (typeof value !== "string") return { ok: false, reason: "value must be text" };
  if (value.length > 5000) return { ok: false, reason: "value too long" };
  if (value.trim().length === 0) return { ok: false, reason: "value cannot be empty" };
  return { ok: true, fields: { value } };
}
