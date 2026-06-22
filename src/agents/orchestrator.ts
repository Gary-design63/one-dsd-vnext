// =====================================================================
// One DSD vNext — Chief-of-Staff orchestrator (Layer 10), DB-backed.
// Governed entrypoint: classify a need -> resolve autonomy (kill-switch,
// ceiling, overrides, hard guardrails) -> record a delegation -> log an
// observability event. It NEVER auto-publishes; act_then_report still flows
// through governance for anything carrying the consultant's authority.
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { audit, newTraceId } from "../audit/audit.js";
import { choosePersona, type Need } from "./delegation.js";
import { resolveAutonomy, type Autonomy } from "./autonomy.js";
import { getAutomationState, getCeiling, activeOverrideFor } from "./controls.js";

interface PersonaRow { default_autonomy: string; active: boolean; }

// Minimal hard-guardrail check: assessing a named individual is blocked
// (agent_guardrails 'assess_named_individual' / aggregate-only). Expanded
// as guardrail rules grow; conservative + fail-closed by default.
function guardrailBlocked(need: Need): boolean {
  return /\bassess(ing)?\s+[A-Z][a-z]+\b/.test(need.text) || /\bnamed individual\b/i.test(need.text);
}

export interface DelegationPlan {
  persona: string;
  autonomy: Autonomy;
  reason: string;
  delegationId: string | null;
  rationale: string;
}

export async function delegate(db: Db, viewer: Viewer, need: Need): Promise<DelegationPlan> {
  const trace = newTraceId();
  const routing = choosePersona(need);
  const [{ rows: prow }, automationState, ceiling] = await Promise.all([
    db.query<PersonaRow>(`SELECT default_autonomy, active FROM agent_personas WHERE key = $1`, [routing.persona]),
    getAutomationState(db),
    getCeiling(db),
  ]);
  const persona = prow[0];
  const override = await activeOverrideFor(db, "persona", routing.persona);

  const resolution = resolveAutonomy({
    automationState,
    personaDefault: persona?.active ? persona.default_autonomy : "blocked",
    ceiling,
    override: override ? { action: override.action, scope: "target" } : null,
    guardrailBlocked: guardrailBlocked(need),
  });

  let delegationId: string | null = null;
  const status = resolution.autonomy === "blocked" ? "blocked"
    : resolution.autonomy === "act_then_report" ? "running" : "needs_approval";

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO agent_delegations (parent_persona, child_persona, task, autonomy_applied, status, trace_id)
     VALUES ('chief_of_staff', $1, $2, $3, $4, $5) RETURNING id`,
    [routing.persona, need.text.slice(0, 500), resolution.autonomy, status, trace],
  );
  delegationId = rows[0]!.id;

  await db.query(
    `INSERT INTO agent_run_events (persona_key, delegation_id, action, input_summary, output_summary, status, trace_id)
     VALUES ('chief_of_staff', $1, 'plan', $2, $3, $4, $5)`,
    [delegationId, need.text.slice(0, 200), `${routing.persona} / ${resolution.autonomy}`, status, trace],
  );
  await audit(db, {
    actorId: viewer.userId, action: "brain.delegate",
    target: `persona:${routing.persona}`,
    detail: { autonomy: resolution.autonomy, status, reason: resolution.reason },
    traceId: trace,
  });

  return { persona: routing.persona, autonomy: resolution.autonomy, reason: resolution.reason, delegationId, rationale: routing.rationale };
}
