// =====================================================================
// One DSD vNext — content ingestion validator (pure, typed, tested).
// Validates one manifest row before it can be staged. Fail-closed: unknown
// kind/format/cluster/visibility, missing required fields, PII patterns, or
// "AI" wording all reject the row. No DB, no I/O — unit-testable.
// Referential checks (cluster exists, etc.) run again against the DB on apply.
// =====================================================================
export const DECISIONS = ["keep", "revise", "retire"] as const;
export const KINDS = ["asset", "learning_path", "learning_module", "calendar_event", "podcast_episode", "instrument", "collection"] as const;
export const FORMATS = ["resource", "brief", "scenario", "guide", "tool", "reference"] as const;
export const PROFICIENCY = ["emerging", "applied", "advanced"] as const;
export const VISIBILITY = ["staff", "consultant", "internal"] as const;
export const CLUSTERS = ["SBS", "CIS", "HUM", "EDU", "COM", "LAW", "HRC", "ORG", "DTD"] as const;

export type Kind = (typeof KINDS)[number];

// Field length caps mirror the in-place edit registry (single source of truth in spirit).
const CAPS: Record<string, number> = { title: 300, summary: 2000, body: 200000, description: 5000, label: 200 };

// Required fields per kind (beyond source_id + decision + kind).
const REQUIRED: Record<Kind, string[]> = {
  asset: ["title"],
  learning_path: ["title"],
  learning_module: ["title"],
  calendar_event: ["title"],
  podcast_episode: ["title"],
  instrument: ["title"],
  collection: ["label"],
};

// Conservative PII detectors (no client PII may ever be ingested).
const PII = [
  { name: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/ },
  { name: "phone", re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
  { name: "DOB", re: /\b(date of birth|dob)\b/i },
];

const AI_WORDING = /\bAI\b|artificial intelligence/i;

export interface ManifestRow {
  source_id?: string;
  decision?: string;
  kind?: string;
  title?: string;
  label?: string;
  summary?: string;
  description?: string;
  body?: string;          // may be inline or loaded from body_file by the loader
  format?: string;
  proficiency_band?: string;
  discipline_cluster?: string;
  visibility?: string;
  [k: string]: unknown;
}

export interface RowResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function inSet<T extends readonly string[]>(set: T, v: unknown): boolean {
  return typeof v === "string" && (set as readonly string[]).includes(v);
}

export function validateRow(row: ManifestRow): RowResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.source_id || !String(row.source_id).trim()) errors.push("source_id is required (stable id for idempotent re-runs)");
  if (!inSet(DECISIONS, row.decision)) errors.push(`decision must be one of ${DECISIONS.join("/")}`);
  if (!inSet(KINDS, row.kind)) errors.push(`kind must be one of ${KINDS.join("/")}`);

  // Retire rows need only an identifier; nothing else is staged.
  if (row.decision === "retire") {
    return { ok: errors.length === 0, errors, warnings };
  }

  const kind = row.kind as Kind | undefined;
  if (kind && inSet(KINDS, kind)) {
    for (const f of REQUIRED[kind]) {
      if (!row[f] || !String(row[f]).trim()) errors.push(`${kind} requires non-empty "${f}"`);
    }
  }

  // enum fields (only when present)
  if (row.format !== undefined && row.format !== "" && !inSet(FORMATS, row.format)) errors.push(`format must be one of ${FORMATS.join("/")}`);
  if (row.proficiency_band !== undefined && row.proficiency_band !== "" && !inSet(PROFICIENCY, row.proficiency_band)) errors.push(`proficiency_band must be one of ${PROFICIENCY.join("/")}`);
  if (row.visibility !== undefined && row.visibility !== "" && !inSet(VISIBILITY, row.visibility)) errors.push(`visibility must be one of ${VISIBILITY.join("/")}`);
  if (row.discipline_cluster !== undefined && row.discipline_cluster !== "" && !inSet(CLUSTERS, row.discipline_cluster)) errors.push(`discipline_cluster must be a known code (${CLUSTERS.join(",")})`);

  // length caps
  for (const [f, cap] of Object.entries(CAPS)) {
    const val = row[f];
    if (typeof val === "string" && val.length > cap) errors.push(`${f} exceeds ${cap} chars`);
  }

  // PII + wording across all text fields
  const text = ["title", "label", "summary", "description", "body"]
    .map((f) => (typeof row[f] === "string" ? (row[f] as string) : "")).join("\n");
  for (const p of PII) {
    if (p.re.test(text)) errors.push(`possible ${p.name} detected — no client PII may be ingested`);
  }
  if (AI_WORDING.test(text)) errors.push(`"AI" wording is not allowed anywhere in the program`);

  if (!row.visibility) warnings.push('no visibility set — will default to "staff"');
  if (kind === "asset" && !row.discipline_cluster) warnings.push("asset has no discipline_cluster — it will be harder to find in the Library");

  return { ok: errors.length === 0, errors, warnings };
}

/** Canonical normalized payload used for the content hash (skip-if-unchanged). */
export function normalizedPayload(row: ManifestRow): string {
  const keep = ["kind", "title", "label", "summary", "description", "body", "format", "proficiency_band", "discipline_cluster", "visibility"];
  const obj: Record<string, unknown> = {};
  for (const k of keep) if (row[k] !== undefined && row[k] !== "") obj[k] = row[k];
  return JSON.stringify(obj, Object.keys(obj).sort());
}
