// =====================================================================
// One DSD vNext — Console Controls (Layer 10): the consultant's authority
// surface. Global kill-switch (pause/resume ALL automation), the autonomy
// ceiling DIAL, per-persona DIALS, the after-action activity ledger, and
// the override log. Consultant-only. (R3)
// =====================================================================
import { html, raw, type SafeHtml } from "../../render.js";
import { page } from "../../layout.js";
import type { NavContext } from "../../viewModels.js";
import type { PersonaView, OverrideView, LedgerRow } from "../../../agents/controls.js";

export interface ControlsView {
  nav: NavContext;
  automationState: "active" | "paused";
  ceiling: string;
  personas: PersonaView[];
  overrides: OverrideView[];
  ledger: LedgerRow[];
}

// Plain-language labels for the autonomy dial (mapped to the stored values).
const DIAL: { value: string; label: string }[] = [
  { value: "blocked", label: "Off" },
  { value: "propose_only", label: "Draft & hold" },
  { value: "act_then_report", label: "Autonomous" },
];

function dialSelect(name: string, current: string): SafeHtml {
  const opts = DIAL.map(
    (d) => html`<option value="${d.value}"${d.value === current ? raw(" selected") : raw("")}>${d.label}</option>`,
  );
  return html`<select name="${name}">${opts}</select>`;
}

function fmtTime(d: Date | string | null): string {
  if (!d) return "—";
  try { return new Date(d).toISOString().slice(0, 16).replace("T", " "); } catch { return "—"; }
}

export function renderControls(v: ControlsView): string {
  const paused = v.automationState === "paused";

  const personas = v.personas.map(
    (p) => html`
      <tr>
        <td>${p.label}</td>
        <td><span class="state state--${p.active ? "approved" : "rejected"}">${p.active ? "on" : "off"}</span></td>
        <td>
          <form method="post" action="/console/controls/persona" class="dialform">
            <input type="hidden" name="key" value="${p.key}" />
            ${dialSelect("value", p.default_autonomy)}
            <button type="submit" class="btn btn--ghost btn--sm">Set</button>
          </form>
        </td>
      </tr>`,
  );

  const overrides = v.overrides.length > 0
    ? v.overrides.map(
        (o) => html`<tr><td>${o.target_kind}${o.target_key ? ` · ${o.target_key}` : ""}</td><td>${o.action}</td><td>${o.reason ?? "—"}</td></tr>`,
      )
    : [html`<tr><td colspan="3" class="muted">No overrides recorded.</td></tr>`];

  const ledger = v.ledger.length > 0
    ? v.ledger.map(
        (e) => html`<tr>
          <td>${e.persona_key ?? "—"}</td><td>${e.action ?? "—"}</td><td>${e.tool ?? "—"}</td>
          <td><span class="state state--${e.status === "answered" || e.status === "ok" ? "approved" : "review"}">${e.status ?? "—"}</span></td>
          <td class="muted">${fmtTime(e.created_at)}</td>
        </tr>`,
      )
    : [html`<tr><td colspan="5" class="muted">No agent activity recorded yet.</td></tr>`];

  const body = html`
    <section aria-labelledby="ctl-h">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/console">Console</a> <span aria-hidden="true">/</span> <span>Controls</span></nav>
      <h1 id="ctl-h" class="section__title">Controls</h1>
      <p class="rulebanner">You hold unconditional authority. The kill-switch pauses or resumes <strong>all</strong> automation immediately. The boundary lanes always apply at every dial setting.</p>

      <div class="ctl-switch">
        <p>Automation is currently:
          <span class="state state--${paused ? "rejected" : "approved"}">${paused ? "paused" : "active"}</span>
        </p>
        <form method="post" action="/console/controls/automation">
          <input type="hidden" name="state" value="${paused ? "active" : "paused"}" />
          <button type="submit" class="btn ${paused ? "btn--primary" : "btn--danger btn--ghost"}">
            ${paused ? "Resume all automation" : "Pause all automation"}
          </button>
        </form>
      </div>

      <h2 class="section__title">Autonomy ceiling</h2>
      <p class="muted">The master cap. No agent acts above this, whatever its own dial.</p>
      <form method="post" action="/console/controls/ceiling" class="dialform">
        ${dialSelect("value", v.ceiling)}
        <button type="submit" class="btn btn--ghost btn--sm">Set ceiling</button>
      </form>

      <h2 class="section__title">Agents — autonomy dial</h2>
      <table class="qtable"><thead><tr><th scope="col">Agent</th><th scope="col">Enabled</th><th scope="col">Autonomy</th></tr></thead>
        <tbody>${personas}</tbody></table>

      <h2 class="section__title">Activity ledger</h2>
      <p class="muted">After-action record of what agents did. Management by exception — review what is flagged.</p>
      <table class="qtable"><thead><tr><th scope="col">Agent</th><th scope="col">Action</th><th scope="col">Tool</th><th scope="col">Status</th><th scope="col">When</th></tr></thead>
        <tbody>${ledger}</tbody></table>

      <h2 class="section__title">Recent overrides</h2>
      <table class="qtable"><thead><tr><th scope="col">Target</th><th scope="col">Action</th><th scope="col">Reason</th></tr></thead>
        <tbody>${overrides}</tbody></table>
    </section>`;
  return page({ title: "Controls", nav: v.nav, body });
}
