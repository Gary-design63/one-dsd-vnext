// Generate styled standalone HTML previews from the real render functions
// + representative mock data, with asset paths localized for file:// viewing.
import { writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderHome } from "../dist/web/pages/home.js";
import { renderSignIn } from "../dist/web/pages/signin.js";
import { renderLibrary } from "../dist/web/pages/library.js";
import { renderAsset } from "../dist/web/pages/asset.js";
import { renderLearningPath } from "../dist/web/pages/learning.js";
import { renderCalendar } from "../dist/web/pages/calendar.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "preview");
const localize = (h) => h.replaceAll("/static/", "./");
const nav = { viewer: { userId: "u1", roles: ["staff"] }, active: "home" };

const sampleCards = [
  { id: "a1", title: "Plain-language guide to MnCHOICES", summary: "A clear walkthrough for new assessors.", format: "guide", proficiencyBand: "emerging", primaryTrack: null, disciplineCluster: "HRC", estimatedMinutes: 8, hasAudio: true },
  { id: "a2", title: "Cultural brief: working with interpreters", summary: "Respectful, practical context for cross-language work.", format: "brief", proficiencyBand: "applied", primaryTrack: null, disciplineCluster: "CIS", estimatedMinutes: 5 },
  { id: "a3", title: "Scenario: a contested eligibility decision", summary: "Practice applying the equity lens under pressure.", format: "scenario", proficiencyBand: "advanced", primaryTrack: null, disciplineCluster: "LAW", estimatedMinutes: 15 },
];

writeFileSync(join(out, "home.html"), localize(renderHome({
  nav, greetingName: "Sam",
  doors: [
    { key: "o", label: "New here? Start with Orientation", description: "What this program is and where to begin.", href: "#" },
    { key: "e", label: "Everyday practice", description: "Plain-language guides and tools for day-to-day work.", href: "#", idcStage: "Minimization" },
    { key: "c", label: "Cultural intelligence", description: "Context to work respectfully across difference.", href: "#", idcStage: "Acceptance" },
    { key: "l", label: "Leadership depth", description: "Advanced material for building the bench.", href: "#", idcStage: "Adaptation" },
  ],
  featured: sampleCards,
})));

writeFileSync(join(out, "library.html"), localize(renderLibrary({
  nav: { ...nav, active: "library" }, items: sampleCards, total: 3, limit: 25, offset: 0, query: "",
  facets: {
    cluster: [{ key: "HRC", label: "Health, Rehab & Clinical", count: 42 }, { key: "CIS", label: "Critical & Identity Studies", count: 28, selected: true }, { key: "LAW", label: "Law, Policy & Governance", count: 19 }],
    format: [{ key: "guide", label: "Guide" }, { key: "brief", label: "Brief" }, { key: "scenario", label: "Scenario" }],
    proficiency: [{ key: "emerging", label: "Emerging" }, { key: "applied", label: "Applied" }, { key: "advanced", label: "Advanced" }],
  },
})));

writeFileSync(join(out, "asset.html"), localize(renderAsset({
  nav: { ...nav, active: "library" },
  asset: { id: "a1", title: "Plain-language guide to MnCHOICES", summary: "A clear walkthrough for new assessors.", format: "guide", proficiencyBand: "emerging", primaryTrack: null, disciplineCluster: "HRC", estimatedMinutes: 8, body: "MnCHOICES is the assessment that opens the door to services.\n\nThis guide explains, in plain language, what each section asks and why it matters — so you can focus on the person in front of you, not the form.\n\nStart with the conversation, not the checklist. The tool follows the person." },
  collections: [{ key: "orientation", label: "New Staff Orientation" }],
})));

writeFileSync(join(out, "learning-path.html"), localize(renderLearningPath({
  nav: { ...nav, active: "learning" },
  path: { id: "p1", title: "Foundations of equitable practice", summary: "Build the shared language and habits the whole division relies on.", proficiencyBand: "emerging", idcStage: "minimization" },
  modules: [
    { id: "m1", ordinal: 1, title: "Why this work, why now", kind: "read", estimatedMinutes: 6, state: "completed" },
    { id: "m2", ordinal: 2, title: "Listen: voices from the community", kind: "listen", estimatedMinutes: 12, state: "completed" },
    { id: "m3", ordinal: 3, title: "Reflect: a moment you noticed difference", kind: "reflect", estimatedMinutes: 8, state: "in_progress" },
    { id: "m4", ordinal: 4, title: "Practice: rewrite a denial letter in plain language", kind: "practice", estimatedMinutes: 20, state: "not_started" },
    { id: "m5", ordinal: 5, title: "Check understanding", kind: "assess", estimatedMinutes: 10, state: "not_started" },
  ],
  completedCount: 2,
})));

writeFileSync(join(out, "calendar.html"), localize(renderCalendar({
  nav: { ...nav, active: "calendar" }, monthLabel: "June 2026",
  entries: [
    { id: "c1", title: "Pride Month", startsOn: "2026-06-01", kind: "heritage_month", sensitivity: "elevated", humilityNote: "Center LGBTQ+ staff and community voices; offer, don't impose." },
    { id: "c2", title: "Juneteenth", startsOn: "2026-06-19", kind: "civic", sensitivity: "elevated", humilityNote: "Acknowledge with substance, not symbolism." },
    { id: "c3", title: "Tribal sovereignty learning circle", startsOn: "2026-06-25", kind: "tribal", sensitivity: "tribal_referral", humilityNote: "Refer to Tribal partners; do not synthesize Tribal knowledge." },
  ],
})));

writeFileSync(join(out, "sign-in.html"), localize(renderSignIn({})));

copyFileSync(join(root, "web-static", "app.css"), join(out, "app.css"));
console.log("Previews written to preview/ (home, library, asset, learning-path, calendar, sign-in) + app.css");

// --- Console previews (Layer 8) -------------------------------------
import { renderConsoleHome } from "../dist/web/pages/console/index.js";
import { renderReview } from "../dist/web/pages/console/review.js";
import { renderConsultations, renderConsultationDetail } from "../dist/web/pages/console/consultations.js";
const cnav = { viewer: { userId: "c", roles: ["consultant"] }, active: "console" };

writeFileSync(join(out, "console.html"), localize(renderConsoleHome({
  nav: cnav,
  counts: { pending: 3, inReview: 1, consultationsOpen: 2 },
  queue: [
    { id: "11111111-1111-1111-1111-111111111111", kind: "content", state: "pending", asset_id: "a", asset_title: "Plain-language denial letter (draft)", gate_category_key: "publication", created_at: new Date() },
    { id: "22222222-2222-2222-2222-222222222222", kind: "brief", state: "changes_requested", asset_id: "b", asset_title: "Cultural brief: Hmong elders", gate_category_key: "cultural_validity", created_at: new Date() },
    { id: "33333333-3333-3333-3333-333333333333", kind: "answer", state: "in_review", asset_id: null, asset_title: "Assistant answer pending citation", gate_category_key: "low_confidence", created_at: new Date() },
  ],
})));

writeFileSync(join(out, "console-review.html"), localize(renderReview({
  nav: cnav, canDecide: true, actionKind: "publish_or_release",
  item: { id: "11111111-1111-1111-1111-111111111111", kind: "content", state: "in_review", gate_category_key: "publication",
    asset_id: "a", asset_title: "Plain-language denial letter (draft)", asset_summary: "A clearer, kinder template for service-denial notices.",
    asset_body: "We reviewed your request for services.\n\nThis letter explains our decision in plain language, what it means, and exactly how to ask us to look again.\n\nYou have the right to appeal. Here is how, step by step.", asset_visibility: "staff", asset_state: "draft" },
})));

writeFileSync(join(out, "console-consultations.html"), localize(renderConsultations({
  nav: cnav,
  items: [
    { id: "44444444-4444-4444-4444-444444444444", request_no: "C-2026-014", topic: "Reasonable accommodation — interview", state: "submitted", created_at: new Date() },
    { id: "55555555-5555-5555-5555-555555555555", request_no: "C-2026-013", topic: "Lead-agency escalation", state: "in_progress", created_at: new Date() },
  ],
})));

writeFileSync(join(out, "console-consultation.html"), localize(renderConsultationDetail({
  nav: cnav,
  item: { id: "44444444-4444-4444-4444-444444444444", request_no: "C-2026-014", topic: "Reasonable accommodation — interview", state: "submitted", created_at: new Date(), requester_name: "Jordan Lee", requester_email: "jordan.lee@example.gov", body: "Requesting guidance on an accommodation for an upcoming assessment interview." },
})));

console.log("Console previews written.");

// --- Ask previews (Layer 9) ----------------------------------------
import { renderAsk, renderAskResult } from "../dist/web/pages/ask.js";
const anav = { viewer: { userId: "u", roles: ["staff"] }, active: "ask" };
writeFileSync(join(out, "ask.html"), localize(renderAsk(anav)));
writeFileSync(join(out, "ask-answered.html"), localize(renderAskResult(anav, "How should I approach an accommodation request during an assessment?", {
  disposition: "answered", confidence: 0.82,
  answer: 'From "Plain-language guide to MnCHOICES":\nStart with the conversation, not the checklist. Ask what supports the person already uses and what they want to change.\n\nFrom "Cultural brief: working with interpreters":\nAllow extra time, speak to the person (not the interpreter), and confirm understanding in their words.',
  citations: [{ assetId: "a1", title: "Plain-language guide to MnCHOICES" }, { assetId: "a2", title: "Cultural brief: working with interpreters" }],
  message: "Here is what the approved One DSD library says, with sources.", usedProvider: false,
})));
writeFileSync(join(out, "ask-refused.html"), localize(renderAskResult(anav, "What is our policy on a brand-new topic we have no material for?", {
  disposition: "insufficient_source", confidence: 0,
  answer: null, citations: [],
  message: "The approved library does not yet cover this. Nothing has been made up — this has been flagged so it can be addressed.", usedProvider: false,
})));
console.log("Ask previews written.");

// --- Console Controls preview (Layer 10) ---------------------------
import { renderControls } from "../dist/web/pages/console/controls.js";
writeFileSync(join(out, "console-controls.html"), localize(renderControls({
  nav: { viewer: { userId: "c", roles: ["consultant"] }, active: "console" },
  automationState: "active", ceiling: "propose_only",
  personas: [
    { key: "chief_of_staff", label: "Chief of Staff", default_autonomy: "act_then_report", active: true },
    { key: "strategy", label: "Strategy", default_autonomy: "propose_only", active: true },
    { key: "insight", label: "Insight", default_autonomy: "propose_only", active: true },
    { key: "learning_architect", label: "Learning Architect", default_autonomy: "act_then_report", active: true },
    { key: "change_adoption", label: "Change & Adoption", default_autonomy: "propose_only", active: true },
    { key: "ombuds_care", label: "Ombuds & Care", default_autonomy: "propose_only", active: true },
    { key: "compliance_risk", label: "Compliance & Risk", default_autonomy: "propose_only", active: true },
  ],
  overrides: [
    { target_kind: "persona", target_key: "insight", action: "force", reason: "approved quarterly representation snapshot", created_at: new Date() },
  ],
})));
console.log("Controls preview written.");

// --- Growth previews (Layer 11) ------------------------------------
import { renderGrowth } from "../dist/web/pages/growth.js";
const gnav = { viewer: { userId: "u", roles: ["staff"] } };
writeFileSync(join(out, "growth-optin.html"), localize(renderGrowth({ nav: gnav, consented: false, recommendations: [], themes: [] })));
writeFileSync(join(out, "growth.html"), localize(renderGrowth({
  nav: gnav, consented: true,
  recommendations: [
    { id: "r1", pathId: "p1", title: "Leading with psychological safety", rationale: "matches your interest in employee well-being & psychological safety; fits your current level (applied)." },
    { id: "r2", pathId: "p2", title: "Mentorship that sticks", rationale: "matches your interest in career development & mentorship; broadens into 1 new area." }
  ],
  themes: [
    { key: "wellbeing_psych_safety", label: "Employee well-being & psychological safety", selected: true },
    { key: "leadership_development", label: "Leadership development", selected: true },
    { key: "career_dev_mentorship", label: "Career development & mentorship", selected: false }
  ]
})));
console.log("Growth previews written.");
