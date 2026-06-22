// =====================================================================
// One DSD vNext — Consultations (Layer 8) — SANCTIONED PII ZONE surface.
// List view shows NO PII (topic + state only). Detail view shows requester
// name/email — authority only, and the server audits every PII read. Triage
// and notes post same-origin. This data never leaves this surface.
// =====================================================================
import { html, raw } from "../../render.js";
import { page } from "../../layout.js";
import type { NavContext } from "../../viewModels.js";
import type { ConsultationSummary, ConsultationDetail } from "../../../governance/consultation.js";

export interface ConsultationsView {
  nav: NavContext;
  items: ConsultationSummary[];
}

export function renderConsultations(v: ConsultationsView): string {
  const rows = v.items.map(
    (c) => html`
      <tr>
        <td><a href="/console/consultations/${c.id}">${c.request_no ?? c.id.slice(0, 8)}</a></td>
        <td>${c.topic ?? "—"}</td>
        <td><span class="state state--${c.state}">${c.state.replace("_", " ")}</span></td>
      </tr>`,
  );
  const body = html`
    <section aria-labelledby="cons-h">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/console">Console</a> <span aria-hidden="true">/</span> <span>Consultations</span></nav>
      <h1 id="cons-h" class="section__title">Consultations</h1>
      <p class="rulebanner">Protected zone. Requester identity is shown only on the detail view and every access is logged.</p>
      ${v.items.length > 0
        ? html`<table class="qtable">
            <thead><tr><th scope="col">Ref</th><th scope="col">Topic</th><th scope="col">State</th></tr></thead>
            <tbody>${rows}</tbody></table>`
        : html`<p class="empty">No consultation requests.</p>`}
    </section>`;
  return page({ title: "Consultations", nav: v.nav, body });
}

export interface ConsultationDetailView {
  nav: NavContext;
  item: ConsultationDetail;
}

export function renderConsultationDetail(v: ConsultationDetailView): string {
  const c = v.item;
  const body = html`
    <article class="consult">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/console/consultations">Consultations</a> <span aria-hidden="true">/</span> <span>${c.request_no ?? c.id.slice(0, 8)}</span></nav>
      <h1 class="section__title">${c.topic ?? "Consultation request"}</h1>
      <p class="rulebanner">This view contains protected requester information. Your access has been recorded.</p>
      <dl class="pii">
        <dt>Requester</dt><dd>${c.requester_name ?? "—"}</dd>
        <dt>Email</dt><dd>${c.requester_email ?? "—"}</dd>
        <dt>State</dt><dd><span class="state state--${c.state}">${c.state.replace("_", " ")}</span></dd>
      </dl>
      <section aria-label="Request">
        <h2 class="review__h2">Request</h2>
        <p>${c.body ?? raw("<span class=\"muted\">No details provided.</span>")}</p>
      </section>
      <form class="triage" method="post" action="/console/consultations/${c.id}/triage">
        <label for="state">Update state</label>
        <select id="state" name="state">
          <option value="triaged">Triaged</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Closed</option>
        </select>
        <button class="btn btn--primary" type="submit">Update</button>
      </form>
      <form class="note" method="post" action="/console/consultations/${c.id}/note">
        <div class="field">
          <label for="note">Add a private note</label>
          <input id="note" name="note" type="text" required />
        </div>
        <button class="btn btn--secondary" type="submit">Save note</button>
      </form>
    </article>`;
  return page({ title: "Consultation", nav: v.nav, body });
}
