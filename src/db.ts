// =====================================================================
// One DSD vNext — database access (Layer 6)
// Thin wrapper over a pg Pool. The app connects as the least-privilege
// role `one_dsd_app` (see migration 0001). A small Db interface is exported
// so handlers depend on an abstraction, not the driver — this keeps the
// access/visibility gate testable without a live database.
// =====================================================================
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { loadConfig } from "./config.js";

export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  tx<T>(fn: (client: Db) => Promise<T>): Promise<T>;
}

class PgDb implements Db {
  constructor(private readonly pool: Pool) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const res = await this.pool.query<T>(text, params as unknown[]);
    return { rows: res.rows, rowCount: res.rowCount ?? 0 };
  }

  async tx<T>(fn: (client: Db) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    const scoped: Db = {
      query: async (text, params = []) => {
        const res = await client.query(text, params as unknown[]);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      },
      tx: () => {
        throw new Error("Nested transactions are not supported");
      },
    };
    try {
      await client.query("BEGIN");
      const out = await fn(scoped);
      await client.query("COMMIT");
      return out;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

let pool: Pool | null = null;
let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  const cfg = loadConfig();
  // Managed Postgres (Supabase / Azure) requires TLS. node-postgres >=8.2x
  // treats sslmode=require as verify-full, which fails against the Supabase
  // pooler's cert chain — so we set SSL explicitly here and don't depend on
  // the connection-string sslmode. Local/dev (localhost) connects without TLS.
  const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(cfg.databaseUrl);
  pool = new Pool({
    connectionString: cfg.databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  db = new PgDb(pool);
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
