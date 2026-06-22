// =====================================================================
// One DSD vNext — Growth (personalized) page (Layer 11).
// Voluntary + self-directed. With no consent, shows only a plain opt-in
// explanation (nothing generated). With consent, shows suggestions WITH
// rationale + accept/dismiss, plus an interests editor and a clear way to
// turn it off. No "AI" wording; never references HR/peers/surveillance.
// In edit mode (authority) the heading + intro are editable copy.
// =====================================================================
import { html, raw, editMark, type SafeHtml } from "../render.js";
import { page } from "../layout.js";
import { copyText } from "../copy.js";
import type { NavContext } from "../viewModels.js";
import type { ActiveReco } from "../../reco/engine.js";

export interface ThemeOption { key: string; label: string; selected: boolean; }

export interface GrowthView {
  nav: NavContext;
  consented: boolean;
  recommendations: ActiveReco[];
  themes: ThemeOption[];
  editMode?: boolean;
  copy?: Record<string, string>;
}

export function renderGrowth(v: GrowthView): string {
  const ed = v.editMode === true;
  const title = copyText(v.copy, "growth.intro.title", "Your growth");
  const lede = copyText(v.copy, "growth.intro.lede", "Suggestions based on your interests and what you've completed. These are yours alone — optional, private, and never used for reviews.");

  if (!v.consented) {
    const body = html`
      <section class="ask" aria-labelledby="g-h">
        <h1 id="g-h" class="section__title"${editMark(ed, "/api/edit/copy/growth.intro.title", "value")}>${title}</h1>
        <p class="lede">This space can suggest learning paths based only on <strong>your own</strong> choices and progress — to help you grow where <em>you</em> want to. It is optional, private to you, and never shared with anyone, never used for reviews, and never tracks you. You can turn it off anytime.</p>
        <form method="post" action="/growth/consent">
          <input type="hidden" name="granted" value="true" />
          <button type="submit" class="btn btn--primary">Turn on personalized suggestions</button>
        </form>
      </section>`;
    return page({ title: "Your growth", nav: { ...v.nav, active: "growth", editMode: ed }, body, editAllowed: ed });
  }

  const recs: SafeHtml = v.recommendations.length > 0
    ? html`<ul class="cardgrid">${v.recommendations.map(
        (r) => html`
          <li class="card">
            <a class="card__link" href="${r.pathId ? `/learning/${r.pathId}` : "/learning"}">
              <h3 class="card__title">${r.title}</h3>
              ${r.rationale ? html`<p class="card__summary">${r.rationale}</p>` : raw("")}
            </a>
            <p class="card__meta">
              <form method="post" action="/growth/reco/${r.id}/accept"><button class="btn btn--secondary" type="submit">Add to my paths</button></form>
              <form method="post" action="/growth/reco/${r.id}/dismiss"><button class="btn btn--ghost btn--danger" type="submit">Not for me</button></form>
            </p>
          </li>`,
      )}</ul>`
    : html`<p class="empty">No suggestions yet. Tell us what interests you below and check back.</p>`;

  const themeBoxes = v.themes.map(
    (t) => html`<li class="facet__item"><label class="facet__label"><input type="checkbox" name="theme" value="${t.key}"${t.selected ? raw(" checked") : raw("")} /><span>${t.label}</span></label></li>`,
  );

  const body = html`
    <section aria-labelledby="g-h">
      <h1 id="g-h" class="section__title"${editMark(ed, "/api/edit/copy/growth.intro.title", "value")}>${title}</h1>
      <p class="lede"${editMark(ed, "/api/edit/copy/growth.intro.lede", "value")}>${lede}</p>
      ${recs}
      <section class="section" aria-labelledby="int-h">
        <h2 id="int-h" class="section__title">What interests you?</h2>
        <form method="post" action="/growth/interests">
          <ul class="facet__list">${themeBoxes}</ul>
          <button type="submit" class="btn btn--primary">Save interests</button>
        </form>
      </section>
      <form method="post" action="/growth/consent" class="section">
        <input type="hidden" name="granted" value="false" />
        <button type="submit" class="btn btn--ghost btn--danger">Turn off personalized suggestions</button>
      </form>
    </section>`;
  return page({ title: "Your growth", nav: { ...v.nav, active: "growth", editMode: ed }, body, editAllowed: ed });
}
