// =====================================================================
// One DSD vNext — Revision history + rollback (Layer 8 console surface).
// Authority-only. Shows an item's change log (who/when/prior value), lets
// the consultant restore any prior snapshot and attach a note. Pure render
// function: all data + formatting is prepared by the route handler.
// =====================================================================
import { html, raw } from "../../render.js";
import { page } from "../../layout.js";
import type { NavContext } from "../../viewModels.js";

export interface HistoryRowVM {
  store: string;
  versionId: string;
  field: string;
  preview: string;
  by: string | null;
  at: string;
}

export interface HistoryView {
  nav: NavContext;
  store: string;        // 'asset' | 'copy' | 'entity'
  id: string;           // identifier used in the lookup/forms
  heading: string;      // human label for the item
  currentPreview: string | null;
  rows: HistoryRowVM[];
  notice?: string | null;
}

export function renderHistory(v: HistoryView): string {
  const lookup = html`
    <form class="histlookup" method="get" action="/console/history">
      <div class="field">
        <label for="store">Content type</label>
        <select id="store" name="store">
          <option value="asset"${v.store === "asset" ? raw(" selected") : raw("")}>Library item</option>
          <option value="copy"${v.store === "copy" ? raw(" selected") : raw("")}>Page text (copy key)</option>
          <option value="entity"${v.store === "entity" ? raw(" selected") : raw("")}>Learning / calendar / collection</option>
        </select>
      </div>
      <div class="field">
        <label for="id">Identifier</label>
        <input id="id" name="id" type="text" value="${v.id}" placeholder="asset id, copy key, or kind:id" />
      </div>
      <button class="btn btn--secondary" type="submit">View history</button>
    </form>`;

  const notice = v.notice ? html`<p class="rulebanner">${v.notice}</p>` : raw("");

  const current = v.currentPreview !== null
    ? html`<section aria-labelledby="cur-h">
        <h2 id="cur-h" class="review__h2">Current (live) value</h2>
        <p class="hist__current">${v.currentPreview || raw("<span class=\"muted\">empty</span>")}</p>
      </section>`
    : raw("");

  const rows = v.rows.map(
    (r) => html`
      <tr>
        <td>${r.at}</td>
        <td>${r.field}</td>
        <td>${r.by ?? "—"}</td>
        <td class="hist__prev">${r.preview || raw("<span class=\"muted\">empty</span>")}</td>
        <td>
          <form method="post" action="/console/history/rollback" class="histroll">
            <input type="hidden" name="store" value="${r.store}" />
            <input type="hidden" name="versionId" value="${r.versionId}" />
            <input type="hidden" name="returnStore" value="${v.store}" />
            <input type="hidden" name="returnId" value="${v.id}" />
            <button class="btn btn--small" type="submit">Restore this version</button>
          </form>
        </td>
      </tr>`,
  );

  const table = v.rows.length > 0
    ? html`<table class="qtable">
        <thead><tr><th scope="col">When</th><th scope="col">Field</th><th scope="col">Changed by</th><th scope="col">Prior value</th><th scope="col">Action</th></tr></thead>
        <tbody>${rows}</tbody></table>`
    : (v.id ? html`<p class="empty">No recorded changes for this item yet.</p>` : raw(""));

  const noteForm = v.id
    ? html`<form class="note" method="post" action="/console/history/note">
        <input type="hidden" name="store" value="${v.store}" />
        <input type="hidden" name="id" value="${v.id}" />
        <div class="field">
          <label for="note">Add a note to this item's audit trail</label>
          <input id="note" name="note" type="text" required />
        </div>
        <button class="btn btn--secondary" type="submit">Save note</button>
      </form>`
    : raw("");

  const body = html`
    <section aria-labelledby="hist-h">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/console">Console</a> <span aria-hidden="true">/</span> <span>Revision history</span></nav>
      <h1 id="hist-h" class="section__title">Revision history${v.id ? html` — ${v.heading}` : raw("")}</h1>
      <p class="muted">Inspect every change, restore any prior version, and attach notes. Restoring is itself recorded and reversible.</p>
      ${notice}
      ${lookup}
      ${current}
      ${table}
      ${noteForm}
    </section>`;
  return page({ title: "Revision history", nav: v.nav, body });
}
