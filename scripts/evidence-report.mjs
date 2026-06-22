// One DSD vNext — evidence report (Layer 12). Summarizes the verifiable
// state of the build (migrations, tests, layers) into docs/EVIDENCE.md so
// "done" always has receipts. Run in CI after `npm run verify`.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mig = readdirSync(join(root, "db/migrations")).filter((f) => f.endsWith(".sql")).sort();

function countTests(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".test.ts")) {
        n += (readFileSync(p, "utf8").match(/^test\(/gm) || []).length;
      }
    }
  };
  walk(dir);
  return n;
}
const tests = countTests(join(root, "src"));

const lines = [
  "# One DSD vNext — Evidence Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `- Migrations: **${mig.length}** (${mig[0]} … ${mig[mig.length - 1]})`,
  `- Unit/render/gate tests: **${tests}**`,
  "- Gates: migrations + spine invariants + web invariants + typecheck + build + tests (see `npm run verify`).",
  "",
  "## Migrations",
  ...mig.map((m) => `- ${m}`),
  "",
  "## Layers (per canonical map)",
  "L1 Ground Truth · L2 Visual Standard · L4 IA · L5 Schema · L6 Spine · L7 Staff · L8 Console/Governance · L9 Ask · L10 Brain (core) · L11 Growth · L12 Hardening.",
];
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs/EVIDENCE.md"), lines.join("\n") + "\n");
console.log(`evidence report: ${mig.length} migrations, ${tests} tests -> docs/EVIDENCE.md`);
