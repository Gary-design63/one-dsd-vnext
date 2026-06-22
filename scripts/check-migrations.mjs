// =====================================================================
// Evidence harness — migration integrity (Layer 6)
// Static checks that don't need a database:
//   - files are numbered sequentially (0001, 0002, ...)
//   - each is wrapped in a single BEGIN/COMMIT
//   - each records its own version into schema_migrations matching its name
//   - no obvious secret literals
// Exits non-zero on any failure so CI can gate on it.
// =====================================================================
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "db", "migrations");

const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
let failures = 0;
const fail = (m) => { failures++; console.error("FAIL:", m); };

if (files.length === 0) fail("no migration files found");

files.forEach((f, i) => {
  const expected = String(i + 1).padStart(4, "0");
  const num = f.slice(0, 4);
  if (num !== expected) fail(`numbering gap: ${f} (expected ${expected})`);

  const sql = readFileSync(join(dir, f), "utf8");
  const begins = (sql.match(/^BEGIN;/gm) || []).length;
  const commits = (sql.match(/^COMMIT;/gm) || []).length;
  if (begins !== 1 || commits !== 1) {
    fail(`${f}: expected exactly one BEGIN/COMMIT (got ${begins}/${commits})`);
  }

  const version = f.replace(/\.sql$/, "");
  if (!sql.includes(`schema_migrations(version) VALUES ('${version}')`)) {
    fail(`${f}: missing self-registering schema_migrations insert for '${version}'`);
  }

  if (/(password|secret|api[_-]?key)\s*=\s*'[^']+'/i.test(sql)) {
    fail(`${f}: possible hardcoded secret`);
  }
});

if (failures === 0) {
  console.log(`OK migrations: ${files.length} files, sequential, single-tx, self-registering.`);
  process.exit(0);
} else {
  console.error(`${failures} migration check(s) failed.`);
  process.exit(1);
}
