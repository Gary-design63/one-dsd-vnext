// WCAG 2.1 AA scan over the rendered demo pages + palette contrast checks.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const demo = join(here, "..", "demo");
const files = readdirSync(demo).filter(f => f.endsWith(".html"));

let problems = 0, checks = 0;
const note = (f, msg) => { problems++; console.log(`  ✗ [${f}] ${msg}`); };
const ok = (m) => console.log(`✓ ${m}`);

// ---------- Structural checks per page ----------
for (const f of files) {
  const h = readFileSync(join(demo, f), "utf8");
  const C = (cond, msg) => { checks++; if (!cond) note(f, msg); };

  C(/<html[^>]*\blang="/.test(h), "missing <html lang>");
  C((h.match(/<h1[ >]/g) || []).length === 1, `expected exactly one <h1> (found ${(h.match(/<h1[ >]/g)||[]).length})`);
  C(/class="skip-link"/.test(h), "missing skip link");
  C(/<main[ >]/.test(h), "missing <main> landmark");
  C(/<nav[ >]/.test(h), "missing <nav> landmark");
  C(/role="contentinfo"|<footer/.test(h), "missing footer/contentinfo");
  // images need non-empty alt
  for (const img of h.match(/<img[^>]*>/g) || []) {
    C(/\balt="[^"]+"/.test(img), `image without meaningful alt: ${img.slice(0,60)}…`);
  }
  // form controls need an explicit (for=), implicit (wrapped in <label>), or aria label
  const labelBlocks = h.match(/<label\b[\s\S]*?<\/label>/g) || [];
  for (const ctl of h.match(/<(input|textarea|select)\b[^>]*>/g) || []) {
    if (/type="hidden"/.test(ctl)) continue;
    const id = (ctl.match(/\bid="([^"]+)"/) || [])[1];
    const explicit = id && new RegExp(`<label[^>]*for="${id}"`).test(h);
    const implicit = labelBlocks.some(b => b.includes(ctl));
    const aria = /aria-label=/.test(ctl);
    C(explicit || implicit || aria, `form control without label: ${ctl.slice(0,60)}…`);
  }
  // buttons + links must have a text name
  for (const b of h.match(/<button[\s\S]*?<\/button>/g) || []) {
    const txt = b.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim();
    C(/[A-Za-z]/.test(txt) || /aria-label=/.test(b), "button with no text");
  }
  for (const a of h.match(/<a\b[^>]*>([\s\S]*?)<\/a>/g) || []) {
    const text = a.replace(/<[^>]+>/g,"").trim();
    C(text.length > 0 || /aria-label=/.test(a), "link with no text");
  }
  // tables need header cells with scope
  for (const t of h.match(/<table[\s\S]*?<\/table>/g) || []) {
    C(/<th[^>]*\bscope="(col|row)"/.test(t), "table without scoped <th> headers");
  }
  // CSP-safety / no JS-dependency for meaning
  C(!/\sstyle="/.test(h), "inline style attribute present (CSP risk)");
  C(!/\son(click|load|error|mouseover|change|submit)=/i.test(h), "inline event handler present");
  // language clarity guard from the program rule
  C(!/\bAI\b/.test(h), 'contains the literal token "AI" (program rule: human language only)');
}

// ---------- Color contrast (WCAG) ----------
function lum(hex){const c=hex.replace('#','');const v=[0,2,4].map(i=>{let x=parseInt(c.substr(i,2),16)/255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];}
function ratio(a,b){const L1=lum(a),L2=lum(b);return ((Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05));}
const pairs = [
  ["body text on page", "#2e2e2b", "#f5f5f3", 4.5],
  ["body text on card", "#2e2e2b", "#ffffff", 4.5],
  ["secondary text on card", "#4d4d49", "#ffffff", 4.5],
  ["link on white", "#004f90", "#ffffff", 4.5],
  ["nav link (white on navy)", "#ffffff", "#002244", 4.5],
  ["primary button (white on blue)", "#ffffff", "#003865", 4.5],
  ["secondary button (white on green)", "#ffffff", "#2e6b12", 4.5],
  ["band chip text", "#002244", "#e8f0f7", 4.5],
  ["neutral chip text", "#3a3a37", "#eeeeeb", 4.5],
  ["approved state badge", "#245610", "#edf7de", 4.5],
  ["pending state badge", "#7a5212", "#fdf0d8", 4.5],
  ["rejected/referral badge", "#7a2e12", "#fbe7e3", 4.5],
  ["hero title (white on navy overlay)", "#ffffff", "#002244", 4.5],
  ["hero eyebrow (on navy overlay)", "#cfe0ee", "#002244", 4.5],
  ["footer text on page", "#4d4d49", "#f5f5f3", 4.5],
];
console.log("\n— Color contrast (target AA 4.5:1 for normal text) —");
let cfail=0;
for (const [name,fg,bg,min] of pairs){
  const r=ratio(fg,bg); checks++;
  const pass=r>=min;
  if(!pass){cfail++;problems++;}
  console.log(`  ${pass?"✓":"✗"} ${name}: ${r.toFixed(2)}:1 ${pass?"":"(below "+min+")"}`);
}

console.log(`\n${problems===0?"PASS":"ISSUES"}: ${checks} checks, ${problems} problem(s) across ${files.length} pages.`);
process.exit(0);
