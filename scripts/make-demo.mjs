// Build a clickable, offline demo of the whole staff + console experience.
// Renders every page with sample data, inlines CSS, rewrites internal links
// to local files, and neutralizes forms so it can be opened from disk.
import { writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderHome } from "../dist/web/pages/home.js";
import { renderSignIn } from "../dist/web/pages/signin.js";
import { renderLibrary } from "../dist/web/pages/library.js";
import { renderAsset } from "../dist/web/pages/asset.js";
import { renderLearningIndex, renderLearningPath } from "../dist/web/pages/learning.js";
import { renderCalendar } from "../dist/web/pages/calendar.js";
import { renderAsk, renderAskResult } from "../dist/web/pages/ask.js";
import { renderGrowth } from "../dist/web/pages/growth.js";
import { renderAudio } from "../dist/web/pages/audio.js";
import { renderSurveys } from "../dist/web/pages/surveys.js";
import { renderConsoleHome } from "../dist/web/pages/console/index.js";
import { renderReview } from "../dist/web/pages/console/review.js";
import { renderConsultations, renderConsultationDetail } from "../dist/web/pages/console/consultations.js";
import { renderControls } from "../dist/web/pages/console/controls.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "demo");
const css = readFileSync(join(root, "web-static", "app.css"), "utf8");

const viewer = { userId: "u1", roles: ["consultant", "staff"] };
const nav = (active) => ({ viewer, active });

function rewrite(html) {
  return html
    // inline the stylesheet so it works from file://
    .replace(/<link rel="stylesheet" href="[^"]*"\s*\/?>/, `<style>\n${css}\n</style>`)
    // drop external scripts (not needed to view)
    .replace(/<script[^>]*><\/script>/g, "")
    .replace(/src="\/static\/hero.jpg"/g, 'src="hero.jpg"')
    // map dynamic links to local demo files (order: specific first)
    .replace(/href="\/library\?[^"]*"/g, 'href="library.html"')
    .replace(/href="\/library\/[^"]+"/g, 'href="asset.html"')
    .replace(/href="\/learning\/[^"]+"/g, 'href="learning-path.html"')
    .replace(/href="\/console\/review\/[^"]+"/g, 'href="console-review.html"')
    .replace(/href="\/console\/consultations\/[^"]+"/g, 'href="console-consultation.html"')
    .replace(/href="\/console\/consultations"/g, 'href="console-consultations.html"')
    .replace(/href="\/console\/controls"/g, 'href="console-controls.html"')
    .replace(/href="\/console"/g, 'href="console.html"')
    .replace(/href="\/library"/g, 'href="library.html"')
    .replace(/href="\/learning"/g, 'href="learning.html"')
    .replace(/href="\/calendar"/g, 'href="calendar.html"')
    .replace(/href="\/audio"/g, 'href="audio.html"')
    .replace(/href="\/surveys"/g, 'href="surveys.html"')
    .replace(/href="\/ask"/g, 'href="ask.html"')
    .replace(/href="\/growth"/g, 'href="growth.html"')
    .replace(/href="\/sign-in[^"]*"/g, 'href="sign-in.html"')
    .replace(/href="\/"/g, 'href="home.html"')
    // neutralize forms (demo can't post)
    .replace(/(<form[^>]*action=")\/[^"]*(")/g, '$1#$2');
}
copyFileSync(join(root, "web-static", "hero.jpg"), join(out, "hero.jpg"));
const w = (name, html) => writeFileSync(join(out, name), rewrite(html));

const cards = [
  { id: "a1", title: "Plain-language guide to MnCHOICES", summary: "A clear walkthrough for new assessors.", format: "guide", proficiencyBand: "emerging", primaryTrack: null, disciplineCluster: "HRC", estimatedMinutes: 8, hasAudio: true },
  { id: "a2", title: "Cultural brief: working with interpreters", summary: "Respectful, practical context for cross-language work.", format: "brief", proficiencyBand: "applied", primaryTrack: null, disciplineCluster: "CIS", estimatedMinutes: 5 },
  { id: "a3", title: "Scenario: a contested eligibility decision", summary: "Practice applying the equity lens under pressure.", format: "scenario", proficiencyBand: "advanced", primaryTrack: null, disciplineCluster: "LAW", estimatedMinutes: 15 },
];

w("home.html", renderHome({ nav: nav("home"), greetingName: "Sam", doors: [
  { key: "o", label: "New here? Start with Orientation", description: "What this program is and where to begin.", href: "/learning" },
  { key: "e", label: "Everyday practice", description: "Plain-language guides and tools for day-to-day work.", href: "/library?proficiency=emerging", idcStage: "Minimization" },
  { key: "c", label: "Cultural intelligence", description: "Context to work respectfully across difference.", href: "/library?cluster=CIS", idcStage: "Acceptance" },
  { key: "l", label: "Leadership depth", description: "Advanced material for building the bench.", href: "/library?proficiency=advanced", idcStage: "Adaptation" },
], featured: cards }));

w("sign-in.html", renderSignIn({}));

w("library.html", renderLibrary({ nav: nav("library"), items: cards, total: 3, limit: 25, offset: 0, query: "", facets: {
  cluster: [{ key: "HRC", label: "Health, Rehab & Clinical", count: 42 }, { key: "CIS", label: "Critical & Identity Studies", count: 28, selected: true }, { key: "LAW", label: "Law, Policy & Governance", count: 19 }],
  format: [{ key: "guide", label: "Guide" }, { key: "brief", label: "Brief" }, { key: "scenario", label: "Scenario" }],
  proficiency: [{ key: "emerging", label: "Emerging" }, { key: "applied", label: "Applied" }, { key: "advanced", label: "Advanced" }],
} }));

w("asset.html", renderAsset({ nav: nav("library"), asset: { id: "a1", title: "Plain-language guide to MnCHOICES", summary: "A clear walkthrough for new assessors.", format: "guide", proficiencyBand: "emerging", primaryTrack: null, disciplineCluster: "HRC", estimatedMinutes: 8, body: "MnCHOICES is the assessment that opens the door to services.\n\nThis guide explains, in plain language, what each section asks and why it matters — so you can focus on the person in front of you, not the form.\n\nStart with the conversation, not the checklist. The tool follows the person." }, collections: [{ key: "orientation", label: "New Staff Orientation" }] }));

w("learning.html", renderLearningIndex({ nav: nav("learning"), paths: [
  { id: "p1", title: "Foundations of equitable practice", summary: "Build the shared language the whole division relies on.", proficiencyBand: "emerging", moduleCount: 5 },
  { id: "p2", title: "Leading with psychological safety", summary: "For supervisors and leads.", proficiencyBand: "applied", moduleCount: 4 },
] }));

w("learning-path.html", renderLearningPath({ nav: nav("learning"), path: { id: "p1", title: "Foundations of equitable practice", summary: "Build the shared language and habits the whole division relies on.", proficiencyBand: "emerging", idcStage: "minimization" }, modules: [
  { id: "m1", ordinal: 1, title: "Why this work, why now", kind: "read", estimatedMinutes: 6, state: "completed" },
  { id: "m2", ordinal: 2, title: "Listen: voices from the community", kind: "listen", estimatedMinutes: 12, state: "completed" },
  { id: "m3", ordinal: 3, title: "Reflect: a moment you noticed difference", kind: "reflect", estimatedMinutes: 8, state: "in_progress" },
  { id: "m4", ordinal: 4, title: "Practice: rewrite a denial letter in plain language", kind: "practice", estimatedMinutes: 20, state: "not_started" },
  { id: "m5", ordinal: 5, title: "Check understanding", kind: "assess", estimatedMinutes: 10, state: "not_started" },
], completedCount: 2 }));

w("calendar.html", renderCalendar({ nav: nav("calendar"), monthLabel: "June 2026", entries: [
  { id: "c1", title: "Pride Month", startsOn: "2026-06-01", kind: "heritage_month", sensitivity: "elevated", humilityNote: "Center LGBTQ+ staff and community voices; offer, don't impose." },
  { id: "c2", title: "Juneteenth", startsOn: "2026-06-19", kind: "civic", sensitivity: "elevated", humilityNote: "Acknowledge with substance, not symbolism." },
  { id: "c3", title: "Tribal sovereignty learning circle", startsOn: "2026-06-25", kind: "tribal", sensitivity: "tribal_referral", humilityNote: "Refer to Tribal partners; do not synthesize Tribal knowledge." },
] }));

w("ask.html", renderAsk(nav("ask")));
w("ask-answered.html", renderAskResult(nav("ask"), "How should I approach an accommodation request during an assessment?", {
  disposition: "answered", confidence: 0.82,
  answer: 'From "Plain-language guide to MnCHOICES":\nStart with the conversation, not the checklist. Ask what supports the person already uses and what they want to change.\n\nFrom "Cultural brief: working with interpreters":\nAllow extra time, speak to the person (not the interpreter), and confirm understanding in their words.',
  citations: [{ assetId: "a1", title: "Plain-language guide to MnCHOICES" }, { assetId: "a2", title: "Cultural brief: working with interpreters" }], usedProvider: false }));

w("growth.html", renderGrowth({ nav: nav("growth"), consented: true, recommendations: [
  { id: "r1", pathId: "p2", title: "Leading with psychological safety", rationale: "matches your interest in employee well-being & psychological safety; fits your current level (applied)." },
  { id: "r2", pathId: "p1", title: "Mentorship that sticks", rationale: "matches your interest in career development & mentorship; broadens into 1 new area." },
], themes: [
  { key: "wellbeing_psych_safety", label: "Employee well-being & psychological safety", selected: true },
  { key: "leadership_development", label: "Leadership development", selected: true },
  { key: "career_dev_mentorship", label: "Career development & mentorship", selected: false },
] }));

w("audio.html", renderAudio({ nav: nav("audio"), episodes: [
  { id: "e1", title: "Season opener: what One DSD is for", summary: "A short conversation on the purpose behind the program.", episodeNo: 1, seasonNo: 1, audioUrl: null, durationMin: 14 },
  { id: "e2", title: "Plain-language letters that respect people", summary: "Why how we write changes how decisions land.", episodeNo: 2, seasonNo: 1, audioUrl: null, durationMin: 11 },
] }));
w("surveys.html", renderSurveys({ nav: nav("surveys"), items: [
  { id: "i1", title: "Quarterly engagement pulse", description: "A few quick questions — your answers are confidential and reported only in aggregate.", kind: "engagement", closesOn: "2026-07-01" },
  { id: "i2", title: "Module reflection: equitable practice", description: "Reflect on one thing you will try this week.", kind: "reflection", closesOn: null },
] }));
w("console.html", renderConsoleHome({ nav: nav("console"), counts: { pending: 3, inReview: 1, consultationsOpen: 2 }, queue: [
  { id: "11111111-1111-1111-1111-111111111111", kind: "content", state: "pending", asset_id: "a", asset_title: "Plain-language denial letter (draft)", gate_category_key: "publication", created_at: new Date() },
  { id: "22222222-2222-2222-2222-222222222222", kind: "brief", state: "changes_requested", asset_id: "b", asset_title: "Cultural brief: Hmong elders", gate_category_key: "cultural_validity", created_at: new Date() },
] }));
w("console-review.html", renderReview({ nav: nav("console"), canDecide: true, actionKind: "publish_or_release", item: { id: "11111111-1111-1111-1111-111111111111", kind: "content", state: "in_review", gate_category_key: "publication", asset_id: "a", asset_title: "Plain-language denial letter (draft)", asset_summary: "A clearer, kinder template for service-denial notices.", asset_body: "We reviewed your request for services.\n\nThis letter explains our decision in plain language, what it means, and exactly how to ask us to look again.", asset_visibility: "staff", asset_state: "draft" } }));
w("console-consultations.html", renderConsultations({ nav: nav("console"), items: [
  { id: "44444444-4444-4444-4444-444444444444", request_no: "C-2026-014", topic: "Reasonable accommodation — interview", state: "submitted", created_at: new Date() },
  { id: "55555555-5555-5555-5555-555555555555", request_no: "C-2026-013", topic: "Lead-agency escalation", state: "in_progress", created_at: new Date() },
] }));
w("console-consultation.html", renderConsultationDetail({ nav: nav("console"), item: { id: "44444444-4444-4444-4444-444444444444", request_no: "C-2026-014", topic: "Reasonable accommodation — interview", state: "submitted", created_at: new Date(), requester_name: "Jordan Lee", requester_email: "jordan.lee@example.gov", body: "Requesting guidance on an accommodation for an upcoming assessment interview." } }));
w("console-controls.html", renderControls({ nav: nav("console"), automationState: "active", ceiling: "propose_only", personas: [
  { key: "chief_of_staff", label: "Chief of Staff", default_autonomy: "act_then_report", active: true },
  { key: "strategy", label: "Strategy", default_autonomy: "propose_only", active: true },
  { key: "insight", label: "Insight", default_autonomy: "propose_only", active: true },
  { key: "learning_architect", label: "Learning Architect", default_autonomy: "act_then_report", active: true },
  { key: "change_adoption", label: "Change & Adoption", default_autonomy: "propose_only", active: true },
  { key: "ombuds_care", label: "Ombuds & Care", default_autonomy: "propose_only", active: true },
  { key: "compliance_risk", label: "Compliance & Risk", default_autonomy: "propose_only", active: true },
], overrides: [{ target_kind: "persona", target_key: "insight", action: "force", reason: "approved quarterly representation snapshot", created_at: new Date() }] }));

console.log("demo written:", out);

// --- Editable asset page (authority edit mode) — keeps scripts so you can try it
copyFileSync(join(root, "web-static", "edit.js"), join(out, "edit.js"));
copyFileSync(join(root, "web-static", "reader.js"), join(out, "reader.js"));
function rewriteLive(html) {
  return html
    .replace(/<link rel="stylesheet" href="[^"]*"\s*\/?>/, `<style>\n${css}\n</style>`)
    .replace(/src="\/static\/([a-z]+\.js)"/g, 'src="$1"')
    .replace(/href="\/library\/[^"]+"/g, 'href="asset.html"')
    .replace(/href="\/library"/g, 'href="library.html"')
    .replace(/href="\/learning"/g, 'href="learning.html"')
    .replace(/href="\/calendar"/g, 'href="calendar.html"')
    .replace(/href="\/ask"/g, 'href="ask.html"')
    .replace(/href="\/growth"/g, 'href="growth.html"')
    .replace(/href="\/console[^"]*"/g, 'href="console.html"')
    .replace(/href="\/sign-in[^"]*"/g, 'href="sign-in.html"')
    .replace(/href="\/"/g, 'href="home.html"')
    .replace(/(<form[^>]*action=")\/[^"]*(")/g, '$1#$2');
}
writeFileSync(join(out, "asset-edit.html"), rewriteLive(renderAsset({
  nav: nav("library"), editable: true,
  asset: { id: "a1", title: "Plain-language guide to MnCHOICES", summary: "A clear walkthrough for new assessors.", format: "guide", proficiencyBand: "emerging", primaryTrack: null, disciplineCluster: "HRC", estimatedMinutes: 8, body: "MnCHOICES is the assessment that opens the door to services.\n\nThis guide explains, in plain language, what each section asks and why it matters.\n\nStart with the conversation, not the checklist." },
})));
console.log("editable demo written: asset-edit.html");

// --- Editable Home (authority edit mode) — try editing the hero text
writeFileSync(join(out, "home-edit.html"), rewriteLive(renderHome({
  nav: { viewer: { userId: "u1", roles: ["consultant","staff"] }, active: "home", editMode: true },
  editMode: true,
  greetingName: "Sam",
  heroEyebrow: "One DSD",
  heroTitle: "People, Access & Culture",
  heroLede: "Find what you need, and grow where you choose. Start with a path that fits where you are today.",
  doors: [
    { key: "o", label: "New here? Start with Orientation", description: "What this program is and where to begin.", href: "#" },
    { key: "e", label: "Everyday practice", description: "Plain-language guides and tools for day-to-day work.", href: "#", idcStage: "Minimization" }
  ],
  featured: cards,
})));
console.log("editable home written: home-edit.html");
