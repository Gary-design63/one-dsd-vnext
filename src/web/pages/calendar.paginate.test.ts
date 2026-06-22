import { test } from "node:test";
import assert from "node:assert/strict";
import { renderCalendar } from "./calendar.js";
import type { NavContext } from "../viewModels.js";

const nav: NavContext = { viewer: { userId: "u", roles: ["staff"] } };
const entry = (i: number) => ({ id: `e${i}`, title: `Day ${i}`, startsOn: "2026-06-21", kind: "observance", sensitivity: "standard", humilityNote: null });

test("calendar shows a pager with Next when more remain, and status range", () => {
  const doc = renderCalendar({ nav, entries: Array.from({ length: 50 }, (_, i) => entry(i)), monthLabel: "June 2026", total: 219, limit: 50, offset: 0 });
  assert.match(doc, /Showing 1–50 of 219/);
  assert.match(doc, /href="\/calendar\?offset=50"/, "Next link");
  assert.doesNotMatch(doc, /Previous/, "no Previous on first page");
});

test("middle page shows both Previous and Next", () => {
  const doc = renderCalendar({ nav, entries: Array.from({ length: 50 }, (_, i) => entry(i)), monthLabel: "June 2026", total: 219, limit: 50, offset: 50 });
  assert.match(doc, /href="\/calendar\?offset=0"/, "Previous link");
  assert.match(doc, /href="\/calendar\?offset=100"/, "Next link");
  assert.match(doc, /Showing 51–100 of 219/);
});

test("no pager when everything fits on one page", () => {
  const doc = renderCalendar({ nav, entries: [entry(1)], monthLabel: "June 2026", total: 1, limit: 50, offset: 0 });
  assert.doesNotMatch(doc, /class="pager"/);
});
