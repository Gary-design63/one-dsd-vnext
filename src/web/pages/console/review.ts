// =====================================================================
// One DSD vNext — Review detail (Layer 8)
// Shows the staged draft and the consultant's decision controls. Decisions
// POST to same-origin endpoints; the server enforces authority + the state
// machine. "Publish" appears only once the item is approved. Nothing here
// ships content on its own — it routes through governance/approvals.ts.
// =====================================================================
import { html, raw, type SafeHtml } from "../../render.js";
import { page } from "../../layout.js";
import type { NavContext } from "../../viewModels.js";
import type { ReviewDetailRow } from "../../data_console.js";

export interface ReviewView {
  nav: NavContext;
  item: ReviewDetailRow;
  canDecide: boolean;
  actionKind: string;
}

function bodyPreview(text: string | null): SafeHtml {
  if (!text) return html`<p class="muted">No draft body.</p>`;
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return html`${paras.map((p) => html`<p>${p}</p>`)}`;
}

export function renderReview(v: ReviewView): string {
  const it = v.item;
  const terminal = it.state === "approved" || it.state === "rejected";

  const decisionForm =
    v.canDecide && !terminal
      ? html`
        <form class="decide" method="post" action="/console/review/${it.id}/decide">
          <input type="hidden" name="actionKind" value="${v.actionKind}" />
          <div class="field">
            <label for="note">Decision note (optional)</label>
            <input id="note" name="note" type="text" />
          </div>
          <div class="decide__btns">
            <button class="btn btn--primary" name="decision" value="approved" type="submit">Approve</button>
            <button class="btn btn--secondary" name="decision" value="changes_requested" type="submit">Request changes</button>
            <button class="btn btn--ghost btn--danger" name="decision" value="rejected" type="submit">Reject</button>
          </div>
        </form>`
      : raw("");

  const releaseForm =
    v.canDecide && it.state === "approved" && it.asset_state !== "approved"
      ? html`
        <form class="release" method="post" action="/console/review/${it.id}/release">
          <input type="hidden" name="actionKind" value="${v.actionKind}" />
          <button class="btn btn--primary" type="submit">Publish to staff</button>
          <p class="muted">Publishing carries your authority and is recorded in the audit log.</p>
        </form>`
      : raw("");

  const notAuthorized = !v.canDecide
    ? html`<p class="formerror" role="status">You can view this item, but only an authorized consultant may decide on it.</p>`
    : raw("");

  const body = html`
    <article class="review">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/console">Console</a> <span aria-hidden="true">/</span> <span>Review</span></nav>
      <h1 class="section__title">${it.asset_title ?? "Untitled item"}</h1>
      <p class="review__meta">
        <span class="chip">${it.kind}</span>
        <span class="state state--${it.state}">${it.state.replace("_", " ")}</span>
        ${it.gate_category_key ? html`<span class="chip chip--gate">Gate: ${it.gate_category_key}</span>` : raw("")}
      </p>
      ${it.asset_summary ? html`<p class="review__summary">${it.asset_summary}</p>` : raw("")}
      <section class="review__draft" aria-label="Draft content">
        <h2 class="review__h2">Draft</h2>
        ${bodyPreview(it.asset_body)}
      </section>
      ${notAuthorized}
      ${decisionForm}
      ${releaseForm}
    </article>`;
  return page({ title: "Review", nav: v.nav, body });
}
