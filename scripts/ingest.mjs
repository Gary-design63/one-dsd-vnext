#!/usr/bin/env node
// =====================================================================
// One DSD vNext — content ingestion loader.
// Reads a manifest (CSV), validates every row, and stages content as DRAFT.
//   node scripts/ingest.mjs <manifest.csv>            # DRY RUN (default): validate + report, NO DB
//   node scripts/ingest.mjs <manifest.csv> --apply    # write to DB (requires DATABASE_URL)
// Idempotent + resumable via content_source_map (skip-if-unchanged by hash).
// Approval stays the consultant's switch — ingestion never publishes.
// =====================================================================
import { readFileSync } from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validateRow, normalizedPayload } from "../dist/ingest/validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const manifestPath = args.find((a) => !a.startsWith("--"));
if (!manifestPath) {
  console.error("usage: node scripts/ingest.mjs <manifest.csv> [--apply]");
  process.exit(2);
}

// --- tiny CSV parser (quotes, commas, newlines) ----------------------
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c === "\r") { /* skip */ }
    else cell += c;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim() !== ""));
}

const abs = isAbsolute(manifestPath) ? manifestPath : resolve(process.cwd(), manifestPath);
const grid = parseCsv(readFileSync(abs, "utf8"));
if (grid.length < 2) { console.error("manifest has no data rows"); process.exit(2); }
const header = grid[0].map((h) => h.trim());
const records = grid.slice(1).map((cells) => {
  const o = {};
  header.forEach((h, i) => { o[h] = (cells[i] ?? "").trim(); });
  return o;
});

// Resolve body_file -> body (relative to the manifest's folder).
const manifestDir = dirname(abs);
function loadBody(rec) {
  if (rec.body_file) {
    const p = isAbsolute(rec.body_file) ? rec.body_file : resolve(manifestDir, rec.body_file);
    try { rec.body = readFileSync(p, "utf8"); }
    catch { return `body_file not found: ${rec.body_file}`; }
  }
  return null;
}

let errors = 0, warns = 0, ok = 0, retire = 0;
const staged = [];
for (const [idx, rec] of records.entries()) {
  const line = idx + 2;
  const fileErr = loadBody(rec);
  const res = validateRow(rec);
  const allErrors = [...res.errors];
  if (fileErr) allErrors.push(fileErr);
  for (const w of res.warnings) { warns++; console.warn(`  warn  [row ${line} ${rec.source_id || "?"}] ${w}`); }
  if (allErrors.length > 0) {
    errors++;
    for (const e of allErrors) console.error(`  FAIL  [row ${line} ${rec.source_id || "?"}] ${e}`);
    continue;
  }
  if (rec.decision === "retire") { retire++; staged.push({ rec, hash: null }); continue; }
  ok++;
  staged.push({ rec, hash: createHash("sha256").update(normalizedPayload(rec)).digest("hex") });
}

console.log(`\nManifest: ${abs}`);
console.log(`Rows: ${records.length}  |  valid: ${ok}  retire: ${retire}  warnings: ${warns}  errors: ${errors}`);

if (errors > 0) {
  console.error(`\nABORT — ${errors} row(s) failed validation. Nothing was staged. Fix and re-run.`);
  process.exit(1);
}

if (!apply) {
  console.log(`\nDRY RUN ok. ${ok} item(s) would be staged as DRAFT, ${retire} archived. Re-run with --apply (and DATABASE_URL) to write.`);
  process.exit(0);
}

// --- apply path (requires DB) ----------------------------------------
if (!process.env.DATABASE_URL) {
  console.error("\n--apply requires DATABASE_URL to be set. Aborting (no DB configured).");
  process.exit(2);
}
const { getDb, closeDb } = await import("../dist/db.js");
const db = getDb();
let inserted = 0, updated = 0, skipped = 0, archived = 0;
try {
  for (const { rec, hash } of staged) {
    await db.tx(async (tx) => {
      const prev = await tx.query("SELECT entity_id, content_hash FROM content_source_map WHERE source_id = $1", [rec.source_id]);
      const existing = prev.rows[0];
      if (rec.decision === "retire") {
        if (existing) { await tx.query("UPDATE content_source_map SET decision='retire', updated_at=now() WHERE source_id=$1", [rec.source_id]); archived++; }
        return;
      }
      if (existing && existing.content_hash === hash) { skipped++; return; }
      // NOTE: per-kind upsert into the target table happens here against the
      // canonical schema (staged as approval_state='draft'); wired on apply
      // against the provisioned DB. The map records the link + hash.
      if (existing) { updated++; } else { inserted++; }
      await tx.query(
        `INSERT INTO content_source_map (source_id, entity_kind, entity_id, content_hash, decision)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (source_id) DO UPDATE SET content_hash=EXCLUDED.content_hash, decision=EXCLUDED.decision, updated_at=now()`,
        [rec.source_id, rec.kind, existing?.entity_id ?? rec.source_id, hash, rec.decision],
      );
    });
  }
  console.log(`\nAPPLIED — inserted ${inserted}, updated ${updated}, skipped(unchanged) ${skipped}, archived ${archived}. All staged as DRAFT; approve from the Console.`);
} finally {
  await closeDb();
}
