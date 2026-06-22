import { test } from "node:test";
import assert from "node:assert/strict";
import { renderLibrary } from "./library.js";
import { renderLearningIndex } from "./learning.js";
import { renderCalendar } from "./calendar.js";
import { renderAsk } from "./ask.js";
import { renderGrowth } from "./growth.js";
import type { NavContext } from "../viewModels.js";

const nav: NavContext = { viewer: { userId: "u", roles: ["consultant"] } };

test("page copy is editable in edit mode, plain in view mode (library/learning/calendar/ask/growth)", () => {
  const libEd = renderLibrary({ nav, editMode: true, copy: { "library.intro.title": "Library", "library.intro.lede": "Browse." }, items: [], total: 0, limit: 25, offset: 0, facets: { cluster: [], format: [], proficiency: [] } });
  assert.match(libEd, /data-edit-endpoint="\/api\/edit\/copy\/library\.intro\.title"/);
  assert.match(libEd, /data-edit-endpoint="\/api\/edit\/copy\/library\.intro\.lede"/);

  const libView = renderLibrary({ nav, editMode: false, items: [], total: 0, limit: 25, offset: 0, facets: { cluster: [], format: [], proficiency: [] } });
  assert.doesNotMatch(libView, /data-editable/, "no edit markers when not editing");

  const learn = renderLearningIndex({ nav, editMode: true, copy: {}, paths: [] });
  assert.match(learn, /data-edit-endpoint="\/api\/edit\/copy\/learning\.intro\.title"/);

  const cal = renderCalendar({ nav, editMode: true, copy: {}, entries: [], monthLabel: "June 2026" });
  assert.match(cal, /data-edit-endpoint="\/api\/edit\/copy\/calendar\.intro\.lede"/);

  const ask = renderAsk(nav, { editMode: true, copy: {} });
  assert.match(ask, /data-edit-endpoint="\/api\/edit\/copy\/ask\.intro\.title"/);

  const growth = renderGrowth({ nav, consented: true, recommendations: [], themes: [], editMode: true, copy: {} });
  assert.match(growth, /data-edit-endpoint="\/api\/edit\/copy\/growth\.intro\.lede"/);
  // a11y: still exactly one h1, no AI wording
  for (const [label, doc] of [["library", libEd], ["learning", learn], ["calendar", cal], ["ask", ask], ["growth", growth]] as const) {
    assert.equal((doc.match(/<h1[ >]/g) || []).length, 1, `${label}: one h1`);
    assert.doesNotMatch(doc, /\bAI\b/, `${label}: no AI wording`);
  }
});
