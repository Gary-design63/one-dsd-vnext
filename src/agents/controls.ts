// =====================================================================
// One DSD vNext — Brain controls (Layer 10), DB-backed.
// The consultant's authority surface: read/flip the global automation
// kill-switch, read the autonomy ceiling, and record overrides. All writes
// are authority-only and audited.
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { audit, newTraceId } from "../audit/audit.js";
import type { AutomationState, OverrideAction } from "./autonomy.js";

const AUTHORITY = new Set(["consultant", "admin"]);
function isAuthority(v: Viewer): boolean { return v.roles.some((r) => AUTHORITY.has(r)); }

export async function getControl(db: Db, key: string, fallback: string): Promise<string> {
  const { rows } = await db.query<{ value: string }>(
    `SELECT value FROM program_controls WHERE key = $1`, [key],
  );
  return rows[0]?.value ?? fallback;
}

export async function getAutomationState(db: Db): Promise<AutomationState> {
  const v = await getControl(db, "automation_state", "active");
  return v === "paused" ? "paused" : "active";
}

export async function getCeiling(db: Db): Promise<string> {
  return getControl(db, "default_autonomy_ceiling", "propose_only");
}

export async function setAutomationState(
  db: Db, viewer: Viewer, state: AutomationState,
): Promise<boolean> {
  if (!isAuthority(viewer)) return false;
  await db.query(
    `UPDATE program_controls SET value = $2, updated_by = $3, updated_at = now() WHERE key = 'automation_state'`,
    ["automation_state", state, viewer.userId],
  );
  await audit(db, {
    actorId: viewer.userId, action: "controls.automation_state", detail: { state }, traceId: newTraceId(),
  });
  return true;
}

export async function recordOverride(
  db: Db, viewer: Viewer,
  o: { targetKind: "global" | "persona" | "delegation" | "action"; targetKey?: string | null; action: OverrideAction; reason?: string | null },
): Promise<boolean> {
  if (!isAuthority(viewer)) return false;
  await db.query(
    `INSERT INTO agent_overrides (target_kind, target_key, action, reason, actor_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [o.targetKind, o.targetKey ?? null, o.action, o.reason ?? null, viewer.userId],
  );
  await audit(db, {
    actorId: viewer.userId, action: "controls.override",
    target: `${o.targetKind}:${o.targetKey ?? "*"}`, detail: { action: o.action }, traceId: newTraceId(),
  });
  return true;
}

/** Latest active override for a target (persona key / delegation id). */
export async function activeOverrideFor(
  db: Db, targetKind: string, targetKey: string,
): Promise<{ action: OverrideAction } | null> {
  const { rows } = await db.query<{ action: OverrideAction }>(
    `SELECT action FROM agent_overrides
      WHERE target_kind = $1 AND target_key = $2
      ORDER BY created_at DESC LIMIT 1`,
    [targetKind, targetKey],
  );
  return rows[0] ?? null;
}

// ---- Read models for the console controls page ----------------------
export interface PersonaView { key: string; label: string; default_autonomy: string; active: boolean; }
export interface OverrideView { target_kind: string; target_key: string | null; action: string; reason: string | null; created_at: Date; }

export async function listPersonas(db: Db): Promise<PersonaView[]> {
  const { rows } = await db.query<PersonaView>(
    `SELECT key, label, default_autonomy, active FROM agent_personas ORDER BY sort_order`,
  );
  return rows;
}

export async function recentOverrides(db: Db, limit = 20): Promise<OverrideView[]> {
  const { rows } = await db.query<OverrideView>(
    `SELECT target_kind, target_key, action, reason, created_at
       FROM agent_overrides ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

// ---- R3: settable dials + after-action activity ledger --------------
const AUTONOMY_VALUES = new Set(["blocked", "propose_only", "act_then_report"]);

/** Consultant sets the global autonomy ceiling (the master dial). */
export async function setCeiling(db: Db, viewer: Viewer, value: string): Promise<boolean> {
  if (!isAuthority(viewer)) return false;
  if (!AUTONOMY_VALUES.has(value)) return false;
  await db.query(
    `UPDATE program_controls SET value = $1, updated_by = $2, updated_at = now()
       WHERE key = 'default_autonomy_ceiling'`,
    [value, viewer.userId],
  );
  await audit(db, { actorId: viewer.userId, action: "controls.ceiling", detail: { value }, traceId: newTraceId() });
  return true;
}

/** Consultant sets one persona's default autonomy (per-class dial). */
export async function setPersonaAutonomy(db: Db, viewer: Viewer, key: string, value: string): Promise<boolean> {
  if (!isAuthority(viewer)) return false;
  if (!AUTONOMY_VALUES.has(value)) return false;
  const r = await db.query(`UPDATE agent_personas SET default_autonomy = $1 WHERE key = $2`, [value, key]);
  await audit(db, {
    actorId: viewer.userId, action: "controls.persona_autonomy",
    target: `persona:${key}`, detail: { value }, traceId: newTraceId(),
  });
  return (r.rowCount ?? 0) > 0;
}

export interface LedgerRow { persona_key: string | null; action: string | null; tool: string | null; status: string | null; created_at: Date; }

/** After-action ledger: what agents actually did (management by exception). */
export async function activityLedger(db: Db, limit = 25): Promise<LedgerRow[]> {
  const { rows } = await db.query<LedgerRow>(
    `SELECT persona_key, action, tool, status, created_at
       FROM agent_run_events ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

// ---- R5: command-center read model (in-flight + recent delegations) --
export interface DelegationRow {
  child_persona: string;
  task: string;
  autonomy_applied: string;
  status: string;
  created_at: Date;
}

/** Recent delegations the Chief of Staff has routed (the consultant's
 *  dispatched work), newest first — surfaced on the Command Center. */
export async function recentDelegations(db: Db, limit = 15): Promise<DelegationRow[]> {
  const { rows } = await db.query<DelegationRow>(
    `SELECT child_persona, task, autonomy_applied, status, created_at
       FROM agent_delegations ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}
