// =====================================================================
// One DSD vNext — Console Controls (Layer 10): the consultant's authority
// surface. Global kill-switch (pause/resume ALL automation), the autonomy
// ceiling, per-persona defaults, and the override log. Consultant-only.
// =====================================================================
import { html, raw } from "../../render.js";
import { page } from "../../layout.js";
import type { NavContext } from "../../viewModels.js";
import type { PersonaView, OverrideView } from "../../../agents/controls.js";

export interface ControlsView {
  nav: NavContext;
  automationState: "active" | "paused";
  ceiling: string;
  personas: PersonaView[];
  overrides: OverrideView[];
}

export function renderControls(v: ControlsView): string {
  const paused = v.automationState === "paused";
  const personas = v.personas.map(
    (p) => html`
      <tr>
        <td>${p.label}</td>
        <td><span class="state state--${p.active ? "approved" : "rejected"}">${p.active ? "on" : "off"}</span></td>
        <td>${p.default_autonomy.replace(/_/g, " ")}</td>
      </tr>`,
  );
  const overrides = v.overrides.length > 0
    ? v.overrides.map(
        (o) => html`<tr><td>${o.target_kind}${o.target_key ? ` · ${o.target_key}` : ""}</td><td>${o.action}</td><td>${o.reason ?? "—"}</td></tr>`,
      )
    : [html`<tr><td colspan="3" class="muted">No overrides recorded.</td></tr>`];

  const body = html`
    <section aria-labelledby="ctl-h">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/console">Console</a> <span aria-hidden="true">/</span> <span>Controls</span></nav>
      <h1 id="ctl-h" class="section__title">Controls</h1>
      <p class="rulebanner">You hold unconditional authority. The switch below pauses or resumes <strong>all</strong> automation immediately. Hard ethical guardrails always apply.</p>

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
        <p class="muted">Autonomy ceiling for all agents: <strong>${v.ceiling.replace(/_/g, " ")}</strong></p>
      </div>

      <h2 class="section__title">Agents</h2>
      <table class="qtable"><thead><tr><th scope="col">Agent</th><th scope="col">Enabled</th><th scope="col">Default autonomy</th></tr></thead>
        <tbody>${personas}</tbody></table>

      <h2 class="section__title">Recent overrides</h2>
      <table class="qtable"><thead><tr><th scope="col">Target</th><th scope="col">Action</th><th scope="col">Reason</th></tr></thead>
        <tbody>${overrides}</tbody></table>
    </section>`;
  return page({ title: "Controls", nav: v.nav, body });
}
