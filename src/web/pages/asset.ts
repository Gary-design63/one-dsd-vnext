// =====================================================================
// One DSD vNext — Asset detail (Layer 7) + in-place editing (authority).
// When v.editable is true (consultant/admin + edit mode), the title,
// summary, and body carry data-editable markers so edit.js makes them
// editable in place; saves go to the governed, versioned, audited endpoint.
// =====================================================================
import { html, raw, attr, type SafeHtml } from "../render.js";
import { page } from "../layout.js";
import type { AssetView } from "../viewModels.js";

export function renderAsset(v: AssetView): string {
  const a = v.asset;
  const ed = v.editable === true;
  const endpoint = `/api/edit/asset/${a.id}`;
  const editAttrs = (field: string) =>
    ed ? html`${attr("data-editable", true)}${attr("data-edit-endpoint", endpoint)}${attr("data-edit-field", field)}` : raw("");

  const chips: SafeHtml[] = [];
  if (a.format) chips.push(html`<span class="chip chip--format">${a.format}</span>`);
  if (a.proficiencyBand) chips.push(html`<span class="chip chip--band">${a.proficiencyBand}</span>`);
  if (typeof a.estimatedMinutes === "number") chips.push(html`<span class="chip chip--time">${a.estimatedMinutes} min</span>`);

  const audio = v.audioUrl
    ? html`<audio class="reader__audio" controls preload="none" src="${v.audioUrl}"></audio>`
    : raw("");

  const collections =
    v.collections && v.collections.length > 0
      ? html`<nav class="related" aria-label="Part of collections">
          <h2 class="related__title">Part of</h2>
          <ul class="related__list">${v.collections.map(
            (c) => html`<li><a href="/library?collection=${c.key}">${c.label}</a></li>`,
          )}</ul>
        </nav>`
      : raw("");

  const editBanner = ed
    ? html`<p class="editbar" role="status">Edit mode is on. Click the title, summary, or content to change it, then Save. Every change is saved with history. <a href="/console/history?store=asset&amp;id=${a.id}">View this item's revision history</a>.</p>`
    : raw("");

  const body = html`
    <article class="asset">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/library">Library</a> <span aria-hidden="true">/</span> <span>${a.title}</span>
      </nav>
      ${editBanner}
      <h1 class="asset__title"${editAttrs("title")}>${a.title}</h1>
      ${chips.length > 0 ? html`<p class="asset__meta">${chips}</p>` : raw("")}
      ${a.summary || ed ? html`<p class="asset__summary"${editAttrs("summary")}>${a.summary ?? ""}</p>` : raw("")}
      <div class="reader" data-reader>
        <button type="button" class="btn btn--secondary reader__btn" data-reader-toggle aria-pressed="false">
          Audio
        </button>
        ${audio}
      </div>
      <div class="asset__body" data-readable${editAttrs("body")}>
        ${a.body ? raw(paragraphs(a.body)) : html`<p>No content available.</p>`}
      </div>
      ${collections}
    </article>`;

  return page({
    title: a.title,
    nav: { ...v.nav, editMode: ed },
    body,
    scripts: ["/static/reader.js"],
    description: a.summary ?? undefined,
    editAllowed: ed,
  });
}

function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => html`<p>${p}</p>`.value)
    .join("");
}
