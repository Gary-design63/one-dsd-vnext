// =====================================================================
// One DSD vNext — editable page copy helper (Layer 7 + editing).
// Loads site_copy values by key prefix for a page's framing text
// (heading + intro). Pairs with editMark() so authority can edit copy in
// place; saves go to /api/edit/copy/:key (versioned, audited, roll-back).
// =====================================================================
import type { Db } from "../db.js";

export async function loadCopy(db: Db, prefix: string): Promise<Record<string, string>> {
  const { rows } = await db.query<{ key: string; value: string }>(
    `SELECT key, value FROM site_copy WHERE key LIKE $1`, [prefix + "%"],
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function copyText(c: Record<string, string> | undefined, key: string, fallback: string): string {
  return (c && c[key] !== undefined) ? c[key]! : fallback;
}
