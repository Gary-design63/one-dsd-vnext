// =====================================================================
// One DSD vNext — synthesis engine (Synthesis layer), DB-backed + governed.
// Retrieves APPROVED, visibility-gated passages (reusing the L9 retriever),
// attaches their themes, builds a deterministic brief, optionally adds a
// generative narrative (provider seam; Null until model+key), persists the
// brief for observability, and logs an agent_run_event. This is the
// corpus-integration pass that precedes any external research.
// =====================================================================
import type { Db } from "../db.js";
import type { Viewer } from "../access/visibility.js";
import { audit, newTraceId } from "../audit/audit.js";
import { retrieve } from "../ask/retrieval.js";
import { getProvider } from "../ask/provider.js";
import { buildBrief, needsExternalResearch } from "./synthesize.js";
import type { SourcePassage, SynthesisBrief } from "./types.js";

async function attachThemes(db: Db, assetIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (assetIds.length === 0) return map;
  const { rows } = await db.query<{ asset_id: string; theme_key: string }>(
    `SELECT asset_id, theme_key FROM asset_themes WHERE asset_id = ANY($1)`,
    [assetIds],
  );
  for (const r of rows) {
    const cur = map.get(r.asset_id) ?? [];
    cur.push(r.theme_key);
    map.set(r.asset_id, cur);
  }
  return map;
}

export interface SynthesizeOptions {
  requestedThemes?: string[];
  persist?: boolean; // default true
}

export async function synthesize(
  db: Db,
  viewer: Viewer,
  query: string,
  opts: SynthesizeOptions = {},
): Promise<SynthesisBrief> {
  const trace = newTraceId();
  const candidates = await retrieve(db, viewer, query); // approved + visibility-gated
  const themeMap = await attachThemes(db, [...new Set(candidates.map((c) => c.assetId))]);
  const sources: SourcePassage[] = candidates.map((c) => ({
    chunkId: c.chunkId,
    assetId: c.assetId,
    title: c.title,
    content: c.content,
    themes: themeMap.get(c.assetId) ?? [],
    score: c.hybrid,
  }));

  const brief = buildBrief(query, sources, { requestedThemes: opts.requestedThemes ?? [] });

  // Optional generative narrative — strictly over the approved passages.
  const provider = getProvider();
  if (provider.available() && sources.length > 0) {
    try {
      brief.narrative = await provider.synthesize(query, sources.map((s) => s.content));
    } catch {
      brief.narrative = null; // never fabricate; deterministic brief stands
    }
  }

  const external = needsExternalResearch(brief);

  // Observability: the Brain/Insight can see synthesis happened (aggregate).
  await db.query(
    `INSERT INTO agent_run_events (persona_key, action, tool, input_summary, output_summary, status, trace_id)
     VALUES ('insight', 'synthesize', 'corpus', $1, $2, $3, $4)`,
    [query.slice(0, 200), `${brief.sourceCount} sources, conf ${brief.confidence.toFixed(2)}`,
     external ? "needs_external" : "sufficient", trace],
  );

  if (opts.persist !== false) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO synthesis_briefs
        (query, confidence, source_count, covered_themes, missing_themes, needs_external, narrative, created_by, trace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [query, brief.confidence, brief.sourceCount, brief.coveredThemes, brief.missingThemes,
       external, brief.narrative, viewer.userId, trace],
    );
    const briefId = rows[0]!.id;
    for (const c of brief.citations) {
      await db.query(
        `INSERT INTO synthesis_brief_citations (brief_id, asset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [briefId, c.assetId],
      );
    }
    for (const cf of brief.conflicts) {
      await db.query(
        `INSERT INTO synthesis_brief_conflicts (brief_id, reason, topic, a_asset, b_asset, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [briefId, cf.reason, cf.topic, cf.a.assetId, cf.b.assetId, cf.note],
      );
    }
  }

  await audit(db, {
    actorId: viewer.userId, action: "synthesis.built",
    detail: { sources: brief.sourceCount, confidence: brief.confidence, needsExternal: external },
    traceId: trace,
  });
  return brief;
}
