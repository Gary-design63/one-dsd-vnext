// =====================================================================
// Evidence harness — web layer invariants (Layer 7)
// Static guards on the staff surface that complement the rendered-HTML
// tests: design tokens align to the locked palette, client JS is
// enhancement-only (no framework, no eval), and CSP-incompatible patterns
// are absent from shipped static assets.
// =====================================================================
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let failures = 0;
const ok = (m) => console.log("OK:", m);
const fail = (m) => { failures++; console.error("FAIL:", m); };
const must = (c, m) => (c ? ok(m) : fail(m));

for (const f of ["web-static/app.css", "web-static/library.js", "web-static/reader.js", "web-static/progress.js"]) {
  must(existsSync(join(root, f)), `present: ${f}`);
}

const css = read("web-static/app.css");
must(css.includes("#003865"), "css uses locked MN blue (#003865)");
must(css.includes("--green-strong"), "css uses accessible green for text/fills");
must(/:focus-visible/.test(css), "css defines a visible focus style");
must(/prefers-reduced-motion/.test(css), "css respects reduced-motion");
must(/--radius:\s*2px/.test(css), "css keeps the locked 2px corner radius");

for (const f of ["library.js", "reader.js", "progress.js", "ask.js", "edit.js"]) {
  const js = read(`web-static/${f}`);
  must(!/\beval\s*\(/.test(js), `${f}: no eval()`);
  must(!/\bnew Function\s*\(/.test(js), `${f}: no Function constructor`);
  must(!/<script/i.test(js), `${f}: no script injection`);
}

// reader.js must escape interpolated content if it builds HTML.
const reader = read("web-static/reader.js");
must(!/innerHTML\s*=/.test(reader), "reader.js does not write innerHTML");
const lib = read("web-static/library.js");
must(/escapeHtml/.test(lib), "library.js escapes API data before insertion");

if (failures === 0) {
  console.log("\nWEB OK — staff-surface invariants hold.");
  process.exit(0);
} else {
  console.error(`\n${failures} web invariant(s) failed.`);
  process.exit(1);
}
