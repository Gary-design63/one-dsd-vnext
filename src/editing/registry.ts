// =====================================================================
// One DSD vNext — editable-entity registry (pure) — the allowlist.
// Defines EXACTLY which tables/columns in-place editing may touch. Tables
// and column names come only from these constants (never user input), so
// the generic save can build SQL safely with no arbitrary-column risk.
// =====================================================================
export interface EntitySpec {
  table: string;
  idCol: "id" | "key";
  fields: Record<string, number>; // field -> max length
  versionTable?: "knowledge_versions"; // assets keep richer versioning
}

export const ENTITIES: Record<string, EntitySpec> = {
  asset: { table: "knowledge_assets", idCol: "id", fields: { title: 300, summary: 2000, body: 200000 }, versionTable: "knowledge_versions" },
  learning_path: { table: "learning_paths", idCol: "id", fields: { title: 300, summary: 2000 } },
  learning_module: { table: "learning_modules", idCol: "id", fields: { title: 300, body: 20000 } },
  calendar_event: { table: "calendar_events", idCol: "id", fields: { title: 300, description: 5000 } },
  collection: { table: "collections", idCol: "key", fields: { label: 200, description: 2000 } },
  podcast_episode: { table: "podcast_episodes", idCol: "id", fields: { title: 300, summary: 2000 } },
  instrument: { table: "instruments", idCol: "id", fields: { title: 300, description: 5000 } },
};

export function getEntity(kind: string): EntitySpec | null {
  return Object.prototype.hasOwnProperty.call(ENTITIES, kind) ? ENTITIES[kind]! : null;
}

export type PatchResult =
  | { ok: true; fields: Record<string, string> }
  | { ok: false; reason: string };

/** Validate a patch against the entity's field allowlist + length caps. */
export function validateEntityPatch(kind: string, input: unknown): PatchResult {
  const spec = getEntity(kind);
  if (!spec) return { ok: false, reason: `unknown entity: ${kind}` };
  if (!input || typeof input !== "object") return { ok: false, reason: "no fields" };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!(k in spec.fields)) return { ok: false, reason: `field not editable on ${kind}: ${k}` };
    if (typeof v !== "string") return { ok: false, reason: `field must be text: ${k}` };
    if (v.length > spec.fields[k]!) return { ok: false, reason: `field too long: ${k}` };
    out[k] = v;
  }
  if (Object.keys(out).length === 0) return { ok: false, reason: "no editable fields" };
  // a primary "name" field must not be blanked
  for (const nameish of ["title", "label"]) {
    if (nameish in out && out[nameish]!.trim().length === 0) {
      return { ok: false, reason: `${nameish} cannot be empty` };
    }
  }
  return { ok: true, fields: out };
}
