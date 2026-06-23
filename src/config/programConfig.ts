// =====================================================================
// One DSD vNext — Program Configuration reader (Refactor Layer R1/R2)
// The adaptive, multi-client layer. The engine is code; everything
// client-/engagement-specific is data in `program_config` (migration 0021).
//
// Design rules:
//   - Pure, testable parsing/merge functions (no DB needed to test).
//   - DEFAULTS are the baked-in DSD fallback, so the app renders correctly
//     even before the config table is applied or if a key is missing.
//   - Owner supremacy: config is data the consultant edits at runtime; this
//     reader never enforces anything — it only resolves the active values.
// =====================================================================
import type { Db } from "../db.js";

export interface ProgramNaming {
  communitiesSection: string;
  communityBriefTerm: string;
  assistant: string;
  audio: string;
  podcast: string;
  noAiLanguageToStaff: boolean;
  brandShort: string;
  brandSub: string;
  brandFooter: string;
}

export interface ProgramIdentity {
  programName: string;
  anchorClient: string;
}

export interface ProgramAutonomy {
  model: string;
  levels: string[];
  safetyPosture: string;
  ownerOverride: string;
}

export interface ProgramLifecycle {
  stage: string;
  targetLaunch: string;
  isEndState: boolean;
}

export interface ProgramConfig {
  instanceId: string;
  identity: ProgramIdentity;
  naming: ProgramNaming;
  autonomy: ProgramAutonomy;
  boundaryLanes: string[];
  measurement: { surveyParticipationTarget: number; agentDrivenTarget: number; aggregateOnly: boolean };
  lifecycle: ProgramLifecycle;
}

// Baked-in DSD defaults (instance one). Used as the fallback layer so the
// program is never broken by an empty/missing config row.
export const DEFAULT_CONFIG: ProgramConfig = {
  instanceId: "dsd",
  identity: {
    programName: "One DSD People, Access and Culture Program",
    anchorClient: "Minnesota DHS — Disability Services Division",
  },
  naming: {
    communitiesSection: "Minnesota Communities",
    communityBriefTerm: "Community Briefs",
    assistant: "Ask One DSD",
    audio: "Audio",
    podcast: "Podcast",
    noAiLanguageToStaff: true,
    brandShort: "One DSD",
    brandSub: "People, Access & Culture",
    brandFooter: "One DSD — Disability Services Division. Internal program surface.",
  },
  autonomy: {
    model: "per_class_dial",
    levels: ["none", "draft_and_hold", "execute_task", "fully_autonomous"],
    safetyPosture: "after_action",
    ownerOverride: "unconditional",
  },
  boundaryLanes: [
    "no client-identifying information enters the program",
    "Tribal / sovereignty matters are signpost-only (refer to the ADSA-led Tribal Consultation path)",
    "legal / HR / clinical determinations route to human channels",
    "guidance is advisory and educational; it never issues determinations",
    "the program does not assess or profile a named individual; analysis is aggregate-only",
  ],
  measurement: { surveyParticipationTarget: 0.7, agentDrivenTarget: 0.7, aggregateOnly: true },
  lifecycle: { stage: "pilot", targetLaunch: "2026-12", isEndState: false },
};

type ConfigRow = { key: string; value: unknown };

// Pure: fold raw key/value rows over the defaults. Unknown keys are ignored;
// missing keys keep their default. Malformed values fall back per-field.
export function mergeConfigRows(defaults: ProgramConfig, rows: readonly ConfigRow[]): ProgramConfig {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    if (r && typeof r === "object" && r.value && typeof r.value === "object") {
      byKey.set(r.key, r.value as Record<string, unknown>);
    }
  }
  const str = (v: unknown, fb: string): string => (typeof v === "string" && v.length > 0 ? v : fb);
  const bool = (v: unknown, fb: boolean): boolean => (typeof v === "boolean" ? v : fb);
  const numr = (v: unknown, fb: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  const arr = (v: unknown, fb: string[]): string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string") && v.length > 0 ? (v as string[]) : fb;

  const id = byKey.get("identity") ?? {};
  const nm = byKey.get("naming") ?? {};
  const au = byKey.get("autonomy") ?? {};
  const bl = byKey.get("boundary_lanes") ?? {};
  const ms = byKey.get("measurement") ?? {};
  const lc = byKey.get("lifecycle") ?? {};

  return {
    instanceId: defaults.instanceId,
    identity: {
      programName: str(id["program_name"], defaults.identity.programName),
      anchorClient: str(id["anchor_client"], defaults.identity.anchorClient),
    },
    naming: {
      communitiesSection: str(nm["communities_section"], defaults.naming.communitiesSection),
      communityBriefTerm: str(nm["community_brief_term"], defaults.naming.communityBriefTerm),
      assistant: str(nm["assistant"], defaults.naming.assistant),
      audio: str(nm["audio"], defaults.naming.audio),
      podcast: str(nm["podcast"], defaults.naming.podcast),
      noAiLanguageToStaff: bool(nm["no_ai_language_to_staff"], defaults.naming.noAiLanguageToStaff),
      brandShort: str(nm["brand_short"], defaults.naming.brandShort),
      brandSub: str(nm["brand_sub"], defaults.naming.brandSub),
      brandFooter: str(nm["brand_footer"], defaults.naming.brandFooter),
    },
    autonomy: {
      model: str(au["model"], defaults.autonomy.model),
      levels: arr(au["levels"], defaults.autonomy.levels),
      safetyPosture: str(au["safety_posture"], defaults.autonomy.safetyPosture),
      ownerOverride: str(au["owner_override"], defaults.autonomy.ownerOverride),
    },
    boundaryLanes: arr((bl as Record<string, unknown>)["lanes"], defaults.boundaryLanes),
    measurement: {
      surveyParticipationTarget: numr(ms["survey_participation_target"], defaults.measurement.surveyParticipationTarget),
      agentDrivenTarget: numr(ms["agent_driven_operations_target"], defaults.measurement.agentDrivenTarget),
      aggregateOnly: bool(ms["aggregate_only"], defaults.measurement.aggregateOnly),
    },
    lifecycle: {
      stage: str(lc["stage"], defaults.lifecycle.stage),
      targetLaunch: str(lc["target_launch"], defaults.lifecycle.targetLaunch),
      isEndState: bool(lc["is_end_state"], defaults.lifecycle.isEndState),
    },
  };
}

// Load the active instance's config from the DB, merged over defaults.
// Fail-open to defaults: config must never be able to take the app down.
export async function loadProgramConfig(db: Db, instanceId = "dsd"): Promise<ProgramConfig> {
  const defaults: ProgramConfig = { ...DEFAULT_CONFIG, instanceId };
  try {
    const res = await db.query<{ key: string; value: unknown }>(
      "SELECT key, value FROM program_config WHERE instance_id = $1",
      [instanceId],
    );
    if (res.rowCount === 0) return defaults;
    return mergeConfigRows(defaults, res.rows);
  } catch {
    // table not applied yet, or transient error → safe defaults
    return defaults;
  }
}
