// =====================================================================
// One DSD vNext — approval state machine (Layer 8) — pure.
// Encodes the only legal transitions for an approval_item. Anything not
// listed is rejected, so an out-of-order or duplicate decision cannot
// silently corrupt state. Used by the DB-backed workflow + tested directly.
// =====================================================================
export type ApprovalState =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "changes_requested";

export type Decision = "approved" | "rejected" | "changes_requested";

const TERMINAL: ReadonlySet<ApprovalState> = new Set(["approved", "rejected"]);

/** Allowed: a reviewer may claim (pending->in_review) then decide; a
 *  changes_requested item may be resubmitted to pending by the author. */
export function applyDecision(
  current: ApprovalState,
  decision: Decision,
): { ok: true; next: ApprovalState } | { ok: false; reason: string } {
  if (TERMINAL.has(current)) {
    return { ok: false, reason: `item is ${current}; no further decisions` };
  }
  if (current !== "pending" && current !== "in_review" && current !== "changes_requested") {
    return { ok: false, reason: `cannot decide from state ${current}` };
  }
  return { ok: true, next: decision };
}

export function canClaim(current: ApprovalState): boolean {
  return current === "pending";
}

/** Only an approved item may transition the underlying asset to published. */
export function releasable(state: ApprovalState): boolean {
  return state === "approved";
}
