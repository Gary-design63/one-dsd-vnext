// =====================================================================
// One DSD vNext — Console home (Layer 8)
// The consultant's operating surface: at-a-glance counts + the review
// queue. The hard-rule banner is always visible: drafts are prepared; the consultant
// decides. Authority/reviewer only (route-guarded).
// =====================================================================
import { html, raw } from "../../render.js";
import { page } from "../../layout.js";
import type { NavContext } from "../../viewModels.js";
import type { QueueRow, ConsoleCounts } from "../../data_console.js";

export interface ConsoleHomeView {
  nav: NavContext;
  counts: ConsoleCounts;
  queue: QueueRow[];
}

export function renderConsoleHome(v: ConsoleHomeView): string {
  const rows = v.queue.map(
    (q) => html`
      <tr>
        <td><a href="/console/review/${q.id}">${q.asset_title ?? q.kind}</a></td>
        <td>${q.kind}</td>
        <td><span class="state state--${q.state}">${q.state.replace("_", " ")}</span></td>
        <td>${q.gate_category_key ?? "—"}</td>
      </tr>`,
  );
  const body = html`
    <section aria-labelledby="con-h">
      <h1 id="con-h" class="section__title">Console</h1>
      <p class="rulebanner">Everything here is prepared for your review. Only you approve, publish, or decide under your authority.</p>
      <ul class="statgrid">
        <li class="stat"><span class="stat__n">${v.counts.pending}</span><span class="stat__l">Awaiting review</span></li>
        <li class="stat"><span class="stat__n">${v.counts.inReview}</span><span class="stat__l">In review</span></li>
        <li class="stat"><span class="stat__n">${v.counts.consultationsOpen}</span><span class="stat__l"><a href="/console/consultations">Open consultations</a></span></li>
        <li class="stat"><span class="stat__l"><a href="/console/command">Command Center</a></span></li>
        <li class="stat"><span class="stat__l"><a href="/console/controls">Controls &amp; automation</a></span></li>
        <li class="stat"><span class="stat__l"><a href="/console/history">Revision history &amp; rollback</a></span></li>
      </ul>
      <h2 class="section__title">Review queue</h2>
      ${v.queue.length > 0
        ? html`<table class="qtable">
            <thead><tr><th scope="col">Item</th><th scope="col">Kind</th><th scope="col">State</th><th scope="col">Gate</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`
        : html`<p class="empty">The queue is clear. Nothing is waiting on you.</p>`}
    </section>`;
  return page({ title: "Console", nav: v.nav, body });
}
