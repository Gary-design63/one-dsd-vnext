// =====================================================================
// One DSD vNext — Library (Layer 7)
// Faceted browse. Cognitive-Load-Theory note: facets turn an overwhelming
// 500+ item catalog into a recognizable, filterable subset (recognition >
// recall), and the result count gives an honest sense of scope. Facets are
// plain links/form controls — filtering works without JS; library.js only
// enhances it (instant filter, no full reload).
// In edit mode (authority) the page heading + intro are editable copy.
// =====================================================================
import { html, raw, editMark, type SafeHtml } from "../render.js";
import { page } from "../layout.js";
import { assetCard } from "./_cards.js";
import { copyText } from "../copy.js";
import type { LibraryView, FacetOption } from "../viewModels.js";

function facetGroup(legend: string, name: string, opts: FacetOption[]): SafeHtml {
  if (opts.length === 0) return raw("");
  const items = opts.map(
    (o) => html`
      <li class="facet__item">
        <label class="facet__label">
          <input type="checkbox" name="${name}" value="${o.key}"${o.selected ? raw(" checked") : raw("")} />
          <span>${o.label}</span>
          ${typeof o.count === "number" ? html`<span class="facet__count">${o.count}</span>` : raw("")}
        </label>
      </li>`,
  );
  return html`
    <fieldset class="facet">
      <legend class="facet__legend">${legend}</legend>
      <ul class="facet__list">${items}</ul>
    </fieldset>`;
}

export function renderLibrary(v: LibraryView): string {
  const ed = v.editMode === true;
  const introTitle = copyText(v.copy, "library.intro.title", "Library");
  const introLede = copyText(v.copy, "library.intro.lede", "Browse by discipline, format, and proficiency.");
  const results =
    v.items.length > 0
      ? html`<ul class="cardgrid" id="results">${v.items.map((c) => assetCard(c, ed))}</ul>`
      : html`<p class="empty" id="results">No items match these filters yet. Try removing a filter.</p>`;

  const body = html`
    <div class="library">
      <header class="library__head">
        <h1 class="section__title"${editMark(ed, "/api/edit/copy/library.intro.title", "value")}>${introTitle}</h1>
        <p class="library__count" role="status">${v.total} item${v.total === 1 ? "" : "s"}</p>
      </header>
      <p class="lede"${editMark(ed, "/api/edit/copy/library.intro.lede", "value")}>${introLede}</p>
      <div class="library__grid">
        <form class="library__facets" method="get" action="/library" aria-label="Filter the library">
          <div class="field">
            <label for="q">Search</label>
            <input id="q" name="q" type="search" value="${v.query ?? ""}" placeholder="Title or keyword" />
          </div>
          ${facetGroup("Discipline cluster", "cluster", v.facets.cluster)}
          ${facetGroup("Format", "format", v.facets.format)}
          ${facetGroup("Proficiency", "proficiency", v.facets.proficiency)}
          <button type="submit" class="btn btn--primary">Apply filters</button>
          <a class="btn btn--ghost" href="/library">Clear</a>
        </form>
        <section class="library__results" aria-label="Results" aria-live="polite">
          ${results}
        </section>
      </div>
    </div>`;

  return page({
    title: "Library",
    nav: { ...v.nav, editMode: ed },
    body,
    scripts: ["/static/library.js"],
    editAllowed: ed,
    description: "Browse the One DSD knowledge library by discipline, format and proficiency.",
  });
}
