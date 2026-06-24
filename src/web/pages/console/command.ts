// =====================================================================
// One DSD vNext — Consultant Command Center (Layer 10 / R5).
// The heart of the operating system: the consultant sees the practice at a
// glance and dispatches a need, which the Chief of Staff routes to the right
// agent "hat" under the active autonomy dials. Read models reuse the agent
// framework; the dispatch posts through the governed orchestrator (which
// records a delegation + ledger event and audits). Consultant-only.
// =====================================================================
import { html, type SafeHtml } from "../../render.js";
import { page } from "../../layout.js";
import type { NavContext } from "../../viewModels.js";
import type { PersonaView, LedgerRow, DelegationRow } from "../../../agents/controls.js";

export interface CommandView {
  nav: NavContext;
  automationState: "active" | "paused";
  ceiling: string;
  personas: PersonaView[];
  delegations: DelegationRow[];
  ledger: LedgerRow[];
  counts: { pending: number; inReview: number; consultationsOpen: number };
  lastPlan?: { persona: string; autonomy: string; rationale: string } | null;
}

const DIAL_LABEL: Record<string, string> = {
  blocked: "Off",
  propose_only: "Draft & hold",
  act_then_report: "Autonomous",
};

const STATUS_STATE: Record<string, string> = {
  running: "approved",
  completed: "approved",
  needs_approval: "review",
  queued: "review",
  blocked: "rejected",
  failed: "rejected",
};

function dial(v: string | null | undefined): string {
  return (v && DIAL_LABEL[v]) || "—";
}

function fmtTime(d: Date | string | null): string {
  if (!d) return "—";
  try { return new Date(d).toISOString().slice(0, 16).replace("T", " "); } catch { return "—"; }
}

export function renderCommand(v: CommandView): string {
  const labelFor = new Map(v.personas.map((p) => [p.key, p.label]));
  const inFlight = v.delegations.filter((d) => d.status === "running" || d.status === "needs_approval" || d.status === "queued").length;

  const roster = v.personas.map(
    (p) => html`
      <tr>
        <td>${p.label}</td>
        <td><span class="state state--${p.active ? "approved" : "rejected"}">${p.active ? "on" : "off"}</span></td>
        <td>${dial(p.default_autonomy)}</td>
      </tr>`,
  );

  const delegations: SafeHtml[] = v.delegations.length > 0
    ? v.delegations.map(
        (d) => html`
          <tr>
            <td>${labelFor.get(d.child_persona) ?? d.child_persona}</td>
            <td>${d.task}</td>
            <td>${dial(d.autonomy_applied)}</td>
            <td><span class="state state--${STATUS_STATE[d.status] ?? "review"}">${d.status.replace("_", " ")}</span></td>
            <td class="muted">${fmtTime(d.created_at)}</td>
          </tr>`,
      )
    : [html`<tr><td colspan="5" class="muted">No work dispatched yet. Use the box above to route a need.</td></tr>`];

  const ledger: SafeHtml[] = v.ledger.length > 0
    ? v.ledger.map(
        (e) => html`
          <tr>
            <td>${labelFor.get(e.persona_key ?? "") ?? e.persona_key ?? "—"}</td>
            <td>${e.action ?? "—"}</td>
            <td>${e.tool ?? "—"}</td>
            <td><span class="state state--${e.status === "answered" || e.status === "ok" ? "approved" : "review"}">${e.status ?? "—"}</span></td>
            <td class="muted">${fmtTime(e.created_at)}</td>
          </tr>`,
      )
    : [html`<tr><td colspan="5" class="muted">No agent activity recorded yet.</td></tr>`];

  const planNote = v.lastPlan
    ? html`<p class="rulebanner">Routed to <strong>${labelFor.get(v.lastPlan.persona) ?? v.lastPlan.persona}</strong> at the <strong>${dial(v.lastPlan.autonomy)}</strong> setting. <span class="muted">(${v.lastPlan.rationale})</span> It is recorded below and in the activity ledger.</p>`
    : html``;

  const paused = v.automationState === "paused";

  const body = html`
    <section aria-labelledby="cmd-h">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/console">Console</a> <span aria-hidden="true">/</span> <span>Command Center</span></nav>
      <h1 id="cmd-h" class="section__title">Command Center</h1>
      <p class="rulebanner">Your operating surface. Describe a need and the Chief of Staff routes it to the right specialist under the dials you set. Nothing is published under your authority without your sign-off.</p>

      ${planNote}

      <div class="ctl-switch">
        <form method="post" action="/console/command/dispatch" class="dispatch">
          <label for="need"><strong>Dispatch a need</strong></label>
          <textarea id="need" name="need" rows="3" placeholder="e.g. Draft a rollout plan for the new mentorship path, or analyze participation gaps by team."></textarea>
          <button type="submit" class="btn btn--primary">Route to the right specialist</button>
        </form>
      </div>

      <h2 class="section__title">Practice at a glance</h2>
      <ul class="statgrid">
        <li class="stat"><span class="stat__n">${String(inFlight)}</span><span class="stat__l">Work in flight</span></li>
        <li class="stat"><span class="stat__n">${String(v.counts.pending)}</span><span class="stat__l">Awaiting review</span></li>
        <li class="stat"><span class="stat__n">${String(v.counts.consultationsOpen)}</span><span class="stat__l"><a href="/console/consultations">Open consultations</a></span></li>
        <li class="stat"><span class="stat__l">Automation: <span class="state state--${paused ? "rejected" : "approved"}">${paused ? "paused" : "active"}</span></span></li>
        <li class="stat"><span class="stat__l">Ceiling: <strong>${dial(v.ceiling)}</strong> · <a href="/console/controls">adjust dials</a></span></li>
      </ul>

      <h2 class="section__title">Your specialists</h2>
      <table class="qtable"><thead><tr><th scope="col">Specialist</th><th scope="col">Enabled</th><th scope="col">Autonomy</th></tr></thead>
        <tbody>${roster}</tbody></table>

      <h2 class="section__title">Dispatched work</h2>
      <table class="qtable"><thead><tr><th scope="col">Specialist</th><th scope="col">Task</th><th scope="col">Autonomy</th><th scope="col">Status</th><th scope="col">When</th></tr></thead>
        <tbody>${delegations}</tbody></table>

      <h2 class="section__title">Activity ledger</h2>
      <p class="muted">After-action record. Management by exception — review what is flagged.</p>
      <table class="qtable"><thead><tr><th scope="col">Specialist</th><th scope="col">Action</th><th scope="col">Tool</th><th scope="col">Status</th><th scope="col">When</th></tr></thead>
        <tbody>${ledger}</tbody></table>
    </section>`;
  return page({ title: "Command Center", nav: v.nav, body });
}
