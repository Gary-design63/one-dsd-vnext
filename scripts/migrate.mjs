#!/usr/bin/env node
// =====================================================================
// One DSD vNext — database migration runner.
//   node scripts/migrate.mjs            # DRY RUN: list migrations in order (no DB)
//   DATABASE_URL=... node scripts/migrate.mjs --apply   # apply pending migrations
// Each migration file is self-contained (its own BEGIN/COMMIT) and registers
// itself in schema_migrations, so this runner only needs to apply the files
// whose version is not yet recorded. Safe to re-run (idempotent).
// =====================================================================
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "db", "migrations");
const apply = process.argv.includes("--apply");

const files = readdirSync(migDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const versions = files.map((f) => f.replace(/\.sql$/, ""));
console.log(`Found ${files.length} migration(s):`);
for (const v of versions) console.log("  -", v);

if (!apply) {
  console.log("\nDRY RUN. Set DATABASE_URL and pass --apply to run them against the database.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("\n--apply requires DATABASE_URL. Aborting (no DB configured).");
  process.exit(2);
}

const { getDb, closeDb } = await import("../dist/db.js");
const db = getDb();
try {
  // applied set (table may not exist yet on a brand-new database)
  let applied = new Set();
  try {
    const r = await db.query("SELECT version FROM schema_migrations");
    applied = new Set(r.rows.map((x) => x.version));
  } catch { /* first run: schema_migrations created by 0001 */ }

  let ran = 0, skipped = 0;
  for (const v of versions) {
    if (applied.has(v)) { skipped++; continue; }
    const sql = readFileSync(join(migDir, `${v}.sql`), "utf8");
    process.stdout.write(`applying ${v} ... `);
    await db.query(sql);            // file contains its own BEGIN/COMMIT
    console.log("ok");
    ran++;
  }
  console.log(`\nDONE — applied ${ran}, skipped(already applied) ${skipped}.`);
} finally {
  await closeDb();
}
