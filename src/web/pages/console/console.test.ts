// =====================================================================
// One DSD vNext — console render tests (Layer 8)
// Renders the console surfaces and asserts the a11y contract, the
// hard-rule banner, and that the PII detail view warns about access.
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConsoleHome } from "./index.js";
import { renderReview } from "./review.js";
import { renderConsultations, renderConsultationDetail } from "./consultations.js";
import type { NavContext } from "../../viewModels.js";

const nav: NavContext = { viewer: { userId: "c", roles: ["consultant"] }, active: "console" };

function a11y(label: string, doc: string): void {
  assert.match(doc, /<html lang="en">/, `${label}: lang`);
  assert.equal((doc.match(/<h1[ >]/g) || []).length, 1, `${label}: one h1`);
  assert.match(doc, /class="skip-link"/, `${label}: skip link`);
  assert.match(doc, /<main id="main"/, `${label}: main landmark`);
  assert.doesNotMatch(doc, /\sstyle=/, `${label}: no inline style`);
  assert.doesNotMatch(doc, /\bAI\b/, `${label}: program surface must not mention "AI"`);
  assert.doesNotMatch(doc, /artificial intelligence/i, `${label}: no "artificial intelligence"`);
  assert.doesNotMatch(doc, /\son(click|load|error)=/i, `${label}: no inline handlers`);
}

test("console home shows hard-rule banner + counts", () => {
  const doc = renderConsoleHome({
    nav,
    counts: { pending: 2, inReview: 1, consultationsOpen: 3 },
    queue: [{ id: "11111111-1111-1111-1111-111111111111", kind: "content", state: "pending", asset_id: null, asset_title: "Draft A", gate_category_key: "publication", created_at: new Date() }],
  });
  a11y("console-home", doc);
  assert.match(doc, /Only you approve, publish, or decide/);
  assert.match(doc, /Draft A/);
});

test("review shows decision controls only when authorized; publish only when approved", () => {
  const base = {
    nav,
    item: {
      id: "22222222-2222-2222-2222-222222222222",
      kind: "content", state: "in_review", gate_category_key: "publication",
      asset_id: "33333333-3333-3333-3333-333333333333", asset_title: "Draft B",
      asset_summary: "s", asset_body: "Body one.\n\nBody two.", asset_visibility: "staff", asset_state: "draft",
    },
    actionKind: "publish_or_release",
  };
  const authorized = renderReview({ ...base, canDecide: true });
  a11y("review", authorized);
  assert.match(authorized, /name="decision" value="approved"/);
  assert.doesNotMatch(authorized, /Publish to staff/, "no publish until approved");

  const unauth = renderReview({ ...base, canDecide: false });
  assert.doesNotMatch(unauth, /name="decision" value="approved"/);
  assert.match(unauth, /only an authorized consultant may decide/i);

  const approved = renderReview({ ...base, item: { ...base.item, state: "approved" }, canDecide: true });
  assert.match(approved, /Publish to staff/);
});

test("consultations list shows no PII; detail warns about logged access", () => {
  const list = renderConsultations({
    nav,
    items: [{ id: "44444444-4444-4444-4444-444444444444", request_no: "C-001", topic: "Accommodation question", state: "submitted", created_at: new Date() }],
  });
  a11y("consultations", list);
  assert.match(list, /Accommodation question/);
  assert.doesNotMatch(list, /@/, "no email addresses in the list view");

  const detail = renderConsultationDetail({
    nav,
    item: { id: "44444444-4444-4444-4444-444444444444", request_no: "C-001", topic: "Accommodation question", state: "submitted", created_at: new Date(), requester_name: "Jordan Lee", requester_email: "jordan@example.gov", body: "Details." },
  });
  a11y("consultation-detail", detail);
  assert.match(detail, /Jordan Lee/);
  assert.match(detail, /access has been recorded/i);
});
