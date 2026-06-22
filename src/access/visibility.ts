// =====================================================================
// One DSD vNext — fail-closed visibility gate (Layer 6)
// THE security spine. Content has a visibility level (staff|consultant|
// internal) and an approval_state. A viewer has roles. This module is the
// single authority that decides what a viewer may see — and it is
// fail-closed: unknown role, unknown visibility, or un-approved content all
// resolve to DENY. Handlers must route every read through here; they never
// hand-roll a WHERE clause.
// =====================================================================

export type Visibility = "staff" | "consultant" | "internal";
export type ApprovalState = "draft" | "pending_review" | "approved" | "archived";
export type Role = "staff" | "reviewer" | "data_steward" | "consultant" | "admin";

export interface Viewer {
  userId: string;
  roles: readonly string[];
}

const KNOWN_ROLES = new Set<Role>([
  "staff",
  "reviewer",
  "data_steward",
  "consultant",
  "admin",
]);

/** Which visibility levels each role may read. Anything not listed = denied. */
const READABLE_VISIBILITY: Record<Role, ReadonlySet<Visibility>> = {
  staff: new Set<Visibility>(["staff"]),
  reviewer: new Set<Visibility>(["staff", "internal"]),
  data_steward: new Set<Visibility>(["staff", "internal"]),
  consultant: new Set<Visibility>(["staff", "internal", "consultant"]),
  admin: new Set<Visibility>(["staff", "internal", "consultant"]),
};

/** Roles permitted to see content that is not yet approved (review surfaces). */
const CAN_SEE_UNAPPROVED = new Set<Role>([
  "reviewer",
  "data_steward",
  "consultant",
  "admin",
]);

function effectiveRoles(viewer: Viewer): Role[] {
  return viewer.roles.filter((r): r is Role => KNOWN_ROLES.has(r as Role));
}

/** The set of visibility levels this viewer may read (union across roles). */
export function allowedVisibilities(viewer: Viewer): Visibility[] {
  const out = new Set<Visibility>();
  for (const role of effectiveRoles(viewer)) {
    for (const v of READABLE_VISIBILITY[role]) out.add(v);
  }
  return [...out];
}

export function canSeeUnapproved(viewer: Viewer): boolean {
  return effectiveRoles(viewer).some((r) => CAN_SEE_UNAPPROVED.has(r));
}

/** Fail-closed per-item decision. */
export function canRead(
  viewer: Viewer,
  item: { visibility: string; approvalState: string },
): boolean {
  const vis = item.visibility as Visibility;
  const state = item.approvalState as ApprovalState;
  const allowed = allowedVisibilities(viewer);
  if (!allowed.includes(vis)) return false; // unknown vis => not in allowed => deny
  if (state === "archived") return false;
  if (state !== "approved" && !canSeeUnapproved(viewer)) return false;
  return true;
}

/**
 * SQL fragment + params that constrain a knowledge_assets query to what the
 * viewer may read. Returned as a parameterized clause so callers never
 * concatenate user data. `paramStart` is the next positional placeholder.
 */
export function visibilitySqlClause(
  viewer: Viewer,
  paramStart: number,
): { clause: string; params: unknown[]; nextParam: number } {
  const allowed = allowedVisibilities(viewer);
  if (allowed.length === 0) {
    // No readable visibility at all => match nothing (fail-closed).
    return { clause: "false", params: [], nextParam: paramStart };
  }
  const visParam = paramStart;
  const params: unknown[] = [allowed];
  let clause = `a.visibility = ANY($${visParam})`;
  let next = paramStart + 1;
  if (canSeeUnapproved(viewer)) {
    clause += ` AND a.approval_state <> 'archived'`;
  } else {
    clause += ` AND a.approval_state = 'approved' AND a.archived_at IS NULL`;
  }
  return { clause, params, nextParam: next };
}
