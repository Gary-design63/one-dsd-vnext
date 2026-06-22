// =====================================================================
// One DSD vNext — governance policy core (Layer 8)
// Pure decision logic over the seeded agent_action_policies model. This is
// the engine behind the program's hard rule:
//   AI may draft / recommend / prepare / classify / summarize / flag.
//   AI may NOT approve / publish / send / represent / decide under the
//   consultant's authority without explicit human sign-off.
// These functions take a policy row + viewer and return decisions; they
// touch no database, so the rule is unit-tested directly.
// =====================================================================
import type { Viewer } from "../access/visibility.js";

export type AutonomyLevel = "act_then_report" | "propose_only" | "blocked";

export interface ActionPolicy {
  actionKind: string;
  autonomyLevel: AutonomyLevel;
  gateCategoryKey: string | null;
  releaseRequiresRole: string | null;
  active: boolean;
}

export interface AutonomyDecision {
  /** AI may perform the action and report afterward (low-risk). */
  mayAutoAct: boolean;
  /** AI must stage a draft/flag for human review before anything ships. */
  mustPropose: boolean;
  /** AI may not perform this at all (e.g. assessing a named individual). */
  blocked: boolean;
  /** human role required to release/approve, if any. */
  releaseRequiresRole: string | null;
  gateCategoryKey: string | null;
}

const AUTHORITY_ROLES = new Set(["consultant", "admin"]);

/** What the AI is allowed to do for this action. Fail-closed: an inactive
 *  or unknown policy is treated as `blocked`. */
export function decideAutonomy(policy: ActionPolicy | null): AutonomyDecision {
  if (!policy || !policy.active) {
    return {
      mayAutoAct: false,
      mustPropose: false,
      blocked: true,
      releaseRequiresRole: null,
      gateCategoryKey: null,
    };
  }
  return {
    mayAutoAct: policy.autonomyLevel === "act_then_report",
    mustPropose: policy.autonomyLevel === "propose_only",
    blocked: policy.autonomyLevel === "blocked",
    releaseRequiresRole: policy.releaseRequiresRole,
    gateCategoryKey: policy.gateCategoryKey,
  };
}

/** May this viewer release/approve work governed by this policy?
 *  Fail-closed: blocked actions are never releasable; an explicit
 *  release_requires_role must be held; and only authority roles
 *  (consultant/admin) may ever release under the consultant's name. */
export function mayRelease(viewer: Viewer, policy: ActionPolicy | null): boolean {
  if (!policy || !policy.active) return false;
  if (policy.autonomyLevel === "blocked") return false;
  const hasAuthority = viewer.roles.some((r) => AUTHORITY_ROLES.has(r));
  if (!hasAuthority) return false;
  if (policy.releaseRequiresRole) {
    return viewer.roles.includes(policy.releaseRequiresRole);
  }
  return true;
}

/** Convenience: is this viewer allowed to operate the console at all? */
export function canOperateConsole(viewer: Viewer): boolean {
  return viewer.roles.some((r) => AUTHORITY_ROLES.has(r) || r === "reviewer");
}
