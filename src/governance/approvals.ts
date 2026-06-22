// =====================================================================
// One DSD vNext — approval workflow (Layer 8), DB-backed.
// Enforces the hard rule end-to-end: AI/staff may SUBMIT; only an
// authority role with the policy-required role may APPROVE or RELEASE.
// Every transition is written to append-only audit_events. Releasing an
// approved item flips the asset to approved + records a release event.
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { audit, newTraceId } from "../audit/audit.js";
import {
  applyDecision,
  releasable,
  type ApprovalState,
  type Decision,
} from "./approvalState.js";
import { mayRelease, type ActionPolicy } from "./policy.js";

export interface ApprovalItem {
  id: string;
  asset_id: string | null;
  kind: string;
  state: ApprovalState;
  submitted_by: string | null;
  gate_category_key: string | null;
}

export async function loadPolicy(
  db: Db,
  actionKind: string,
): Promise<ActionPolicy | null> {
  const { rows } = await db.query<{
    action_kind: string;
    autonomy_level: ActionPolicy["autonomyLevel"];
    gate_category_key: string | null;
    release_requires_role: string | null;
    active: boolean;
  }>(
    `SELECT action_kind, autonomy_level, gate_category_key, release_requires_role, active
       FROM agent_action_policies WHERE action_kind = $1`,
    [actionKind],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    actionKind: r.action_kind,
    autonomyLevel: r.autonomy_level,
    gateCategoryKey: r.gate_category_key,
    releaseRequiresRole: r.release_requires_role,
    active: r.active,
  };
}

/** Stage an item into the review queue. Anyone authenticated (or the AI
 *  pipeline) may submit; submission ships NOTHING live. */
export async function submitForReview(
  db: Db,
  submitter: Viewer,
  input: { assetId: string | null; kind?: string; gateCategoryKey?: string | null },
): Promise<string> {
  const trace = newTraceId();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO approval_items (asset_id, kind, state, submitted_by, gate_category_key)
     VALUES ($1, $2, 'pending', $3, $4) RETURNING id`,
    [input.assetId, input.kind ?? "content", submitter.userId, input.gateCategoryKey ?? null],
  );
  const id = rows[0]!.id;
  await audit(db, {
    actorId: submitter.userId,
    action: "approval.submitted",
    target: `approval_item:${id}`,
    detail: { assetId: input.assetId, kind: input.kind ?? "content" },
    traceId: trace,
  });
  return id;
}

async function getItem(db: Db, id: string): Promise<ApprovalItem | null> {
  const { rows } = await db.query<ApprovalItem>(
    `SELECT id, asset_id, kind, state, submitted_by, gate_category_key
       FROM approval_items WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export type DecisionResult =
  | { ok: true; state: ApprovalState }
  | { ok: false; reason: string; code: 403 | 404 | 409 };

/**
 * Record an approval decision. Authorization is policy-driven: the viewer
 * must satisfy mayRelease() for the action governing this item. A decision
 * may not be self-approval-from-nothing: the state machine is enforced.
 */
export async function decide(
  db: Db,
  viewer: Viewer,
  itemId: string,
  decision: Decision,
  note: string | null,
  actionKind: string,
): Promise<DecisionResult> {
  const trace = newTraceId();
  return db.tx(async (tx) => {
    const item = await getItem(tx, itemId);
    if (!item) return { ok: false, reason: "not found", code: 404 } as const;

    const policy = await loadPolicy(tx, actionKind);
    if (!mayRelease(viewer, policy)) {
      await audit(tx, {
        actorId: viewer.userId,
        action: "approval.denied",
        target: `approval_item:${itemId}`,
        detail: { decision, actionKind },
        traceId: trace,
      });
      return { ok: false, reason: "not authorized to decide", code: 403 } as const;
    }

    const move = applyDecision(item.state, decision);
    if (!move.ok) return { ok: false, reason: move.reason, code: 409 } as const;

    await tx.query(
      `UPDATE approval_items SET state = $2, updated_at = now() WHERE id = $1`,
      [itemId, move.next],
    );
    await tx.query(
      `INSERT INTO approval_decisions (approval_item_id, decision, decided_by, note)
       VALUES ($1, $2, $3, $4)`,
      [itemId, decision, viewer.userId, note],
    );
    await audit(tx, {
      actorId: viewer.userId,
      action: `approval.${decision}`,
      target: `approval_item:${itemId}`,
      detail: { actionKind, note: note ?? undefined },
      traceId: trace,
    });
    return { ok: true, state: move.next } as const;
  });
}

/**
 * Release (publish) an approved item's asset. Requires the same authority
 * AND an approved approval_item. Flips the asset to approved + records a
 * content_release_event. This is the ONLY path content goes live.
 */
export async function release(
  db: Db,
  viewer: Viewer,
  itemId: string,
  actionKind: string,
): Promise<DecisionResult> {
  const trace = newTraceId();
  return db.tx(async (tx) => {
    const item = await getItem(tx, itemId);
    if (!item) return { ok: false, reason: "not found", code: 404 } as const;

    const policy = await loadPolicy(tx, actionKind);
    if (!mayRelease(viewer, policy)) {
      await audit(tx, {
        actorId: viewer.userId,
        action: "release.denied",
        target: `approval_item:${itemId}`,
        traceId: trace,
      });
      return { ok: false, reason: "not authorized to release", code: 403 } as const;
    }
    if (!releasable(item.state)) {
      return { ok: false, reason: `item is ${item.state}, not approved`, code: 409 } as const;
    }
    if (!item.asset_id) {
      return { ok: false, reason: "no asset to release", code: 409 } as const;
    }

    await tx.query(
      `UPDATE knowledge_assets
          SET approval_state = 'approved', approved_by = $2, approved_at = now(), updated_at = now()
        WHERE id = $1`,
      [item.asset_id, viewer.userId],
    );
    await tx.query(
      `INSERT INTO content_release_events (asset_id, action, actor_id)
       VALUES ($1, 'published', $2)`,
      [item.asset_id, viewer.userId],
    );
    await audit(tx, {
      actorId: viewer.userId,
      action: "release.published",
      target: `asset:${item.asset_id}`,
      detail: { approvalItemId: itemId, actionKind },
      traceId: trace,
    });
    return { ok: true, state: "approved" } as const;
  });
}
