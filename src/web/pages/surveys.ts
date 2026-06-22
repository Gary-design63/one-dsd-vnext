// =====================================================================
// One DSD vNext — Surveys & Reflections (staff surface).
// Shows ONLY what the consultant has distributed to this staff member
// (open distributions targeting them). Responses are confidential and
// reported only in aggregate — that promise is rendered into the page.
// In edit mode (authority) the heading + intro and each instrument's
// title/description are editable in place (versioned, audited, roll-back).
// =====================================================================
import { html, raw, editMark, type SafeHtml } from "../render.js";
import { page } from "../layout.js";
import { copyText } from "../copy.js";
import type { SurveyView, SurveyItemVM } from "../viewModels.js";

const KIND_LABEL: Record<string, string> = {
  module_survey: "Module survey",
  reflection: "Reflection",
  engagement: "Engagement survey",
  annual_deia: "Annual DEIA survey",
  needs_assessment: "Needs assessment",
};

function surveyRow(s: SurveyItemVM, ed: boolean): SafeHtml {
  const endpoint = `/api/edit/instrument/${s.id}`;
  return html`
    <li class="card">
      <h2 class="card__title"${editMark(ed, endpoint, "title")}>${s.title}</h2>
      <p class="card__meta">
        <span class="chip">${KIND_LABEL[s.kind] ?? s.kind}</span>
        ${s.closesOn ? html`<span class="chip chip--time">Open until ${s.closesOn}</span>` : raw("")}
      </p>
      ${s.description || ed ? html`<p class="card__summary"${editMark(ed, endpoint, "description")}>${s.description ?? ""}</p>` : raw("")}
    </li>`;
}

export function renderSurveys(v: SurveyView): string {
  const ed = v.editMode === true;
  const title = copyText(v.copy, "surveys.intro.title", "Surveys & Reflections");
  const lede = copyText(v.copy, "surveys.intro.lede", "When something is shared with you here, your voice shapes the program. Responses are confidential and reported only in aggregate.");
  const body = html`
    <section aria-labelledby="surv-h">
      <h1 id="surv-h" class="section__title"${editMark(ed, "/api/edit/copy/surveys.intro.title", "value")}>${title}</h1>
      <p class="lede"${editMark(ed, "/api/edit/copy/surveys.intro.lede", "value")}>${lede}</p>
      ${v.items.length > 0
        ? html`<ul class="cardgrid">${v.items.map((s) => surveyRow(s, ed))}</ul>`
        : html`<p class="empty">Nothing is waiting for your input right now. When a survey or reflection is shared with you, it will appear here.</p>`}
    </section>`;
  return page({
    title: "Surveys & Reflections",
    nav: { ...v.nav, active: "surveys", editMode: ed },
    body,
    editAllowed: ed,
    description: "Surveys and reflections shared with you.",
  });
}
