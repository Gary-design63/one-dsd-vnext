// =====================================================================
// One DSD vNext — Calendar (Layer 7)
// Observances and program dates. The humility note travels with each
// culturally sensitive entry ("to inform, never to perform"); tribal
// matters are marked for referral, never synthesized. This is a values
// guardrail rendered into the surface, not just policy on paper.
// In edit mode (authority) the intro line is editable copy.
// =====================================================================
import { html, raw, editMark, type SafeHtml } from "../render.js";
import { page } from "../layout.js";
import { copyText } from "../copy.js";
import type { CalendarView, CalendarEntry } from "../viewModels.js";

function entryRow(e: CalendarEntry, ed = false): SafeHtml {
  const sensitive = e.sensitivity && e.sensitivity !== "standard";
  return html`
    <li class="cal__entry${sensitive ? " cal__entry--sensitive" : ""}">
      <time class="cal__date" datetime="${e.startsOn}">${e.startsOn}</time>
      <span class="cal__body">
        <span class="cal__title"${editMark(ed, `/api/edit/calendar_event/${e.id}`, "title")}>${e.title}</span>
        <span class="chip chip--kind">${e.kind}</span>
        ${e.sensitivity === "tribal_referral"
          ? html`<span class="chip chip--referral">Tribal matter — refer, do not synthesize</span>`
          : raw("")}
        ${e.humilityNote ? html`<span class="cal__humility">${e.humilityNote}</span>` : raw("")}
      </span>
    </li>`;
}

export function renderCalendar(v: CalendarView): string {
  const ed = v.editMode === true;
  const introLede = copyText(v.copy, "calendar.intro.lede", "Observances and program dates. Shared to inform, never to perform.");
  const total = v.total ?? v.entries.length;
  const limit = v.limit ?? v.entries.length;
  const offset = v.offset ?? 0;
  const shownTo = offset + v.entries.length;
  const hasPrev = offset > 0;
  const hasNext = shownTo < total;
  const pager = (hasPrev || hasNext)
    ? html`<nav class="pager" aria-label="Calendar pages">
        ${hasPrev ? html`<a class="btn btn--ghost" href="/calendar?offset=${Math.max(0, offset - limit)}">Previous</a>` : raw("")}
        <span class="pager__status" role="status">Showing ${offset + 1}–${shownTo} of ${total}</span>
        ${hasNext ? html`<a class="btn btn--ghost" href="/calendar?offset=${offset + limit}">Next</a>` : raw("")}
      </nav>`
    : raw("");
  const body = html`
    <section aria-labelledby="cal-h">
      <h1 id="cal-h" class="section__title">Calendar — ${v.monthLabel}</h1>
      <p class="lede"${editMark(ed, "/api/edit/copy/calendar.intro.lede", "value")}>${introLede}</p>
      ${v.entries.length > 0
        ? html`<ul class="cal__list">${v.entries.map((e) => entryRow(e, ed))}</ul>`
        : html`<p class="empty">No entries for this period.</p>`}
      ${pager}
    </section>`;
  return page({ title: "Calendar", nav: { ...v.nav, editMode: ed }, body, description: "Observances and program dates.", editAllowed: ed });
}
