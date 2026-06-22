// =====================================================================
// One DSD vNext — autonomy resolver (Layer 10) — PURE.
// Decides, for one intended agent action, the autonomy actually permitted:
//   act_then_report | propose_only | blocked
// Precedence (highest wins), encoding the consultant's authority + safety:
//   1. Hard guardrail violation  -> blocked   (safety wins, even over force)
//   2. Per-target override cancel/pause -> blocked
//   3. Global kill-switch 'paused' -> blocked  (unless a consultant resume/force override)
//   4. Consultant 'force' override -> act_then_report
//   5. Otherwise: min(persona default, autonomy ceiling)
// Fail-closed: unknown inputs collapse toward 'blocked'.
// =====================================================================
export type Autonomy = "act_then_report" | "propose_only" | "blocked";
export type AutomationState = "active" | "paused";
export type OverrideAction = "pause" | "resume" | "cancel" | "override" | "force";

const RANK: Record<Autonomy, number> = { blocked: 0, propose_only: 1, act_then_report: 2 };
const BY_RANK: Autonomy[] = ["blocked", "propose_only", "act_then_report"];

function norm(a: string | null | undefined): Autonomy {
  return a === "act_then_report" || a === "propose_only" || a === "blocked" ? a : "blocked";
}
function minA(a: Autonomy, b: Autonomy): Autonomy {
  return BY_RANK[Math.min(RANK[a], RANK[b])]!;
}

export interface AutonomyInputs {
  automationState: AutomationState;     // program_controls.automation_state
  personaDefault: string | null;        // agent_personas.default_autonomy
  ceiling: string | null;               // program_controls.default_autonomy_ceiling
  override?: { action: OverrideAction; scope: "global" | "target" } | null;
  guardrailBlocked?: boolean;           // a hard guardrail forbids this action
}

export interface AutonomyResolution {
  autonomy: Autonomy;
  reason: string;
}

export function resolveAutonomy(i: AutonomyInputs): AutonomyResolution {
  if (i.guardrailBlocked) {
    return { autonomy: "blocked", reason: "hard guardrail forbids this action" };
  }
  const ov = i.override ?? null;
  if (ov && (ov.action === "cancel" || ov.action === "pause")) {
    return { autonomy: "blocked", reason: `override:${ov.action}` };
  }
  if (i.automationState === "paused") {
    const reenabled = ov && (ov.action === "resume" || ov.action === "force");
    if (!reenabled) return { autonomy: "blocked", reason: "global automation paused (kill-switch)" };
  }
  if (ov && ov.action === "force") {
    return { autonomy: "act_then_report", reason: "consultant force override" };
  }
  const base = minA(norm(i.personaDefault), norm(i.ceiling));
  return { autonomy: base, reason: "persona default capped by ceiling" };
}

/** Convenience: may an autonomous agent ACT without waiting for sign-off? */
export function mayAutoAct(r: AutonomyResolution): boolean {
  return r.autonomy === "act_then_report";
}
