// =====================================================================
// One DSD vNext — config (Layer 6)
// All secrets come from the environment (Azure Key Vault -> env at runtime).
// Nothing secret is ever committed. Fail loudly if a required var is missing.
// =====================================================================

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function intOpt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface AppConfig {
  env: "development" | "production" | "test";
  port: number;
  databaseUrl: string;
  // session lifetimes (minutes)
  sessionIdleMinutes: number;
  sessionAbsoluteMinutes: number;
  // cookie
  cookieName: string;
  cookieSecure: boolean;
  // login throttling
  maxLoginFailuresPerWindow: number;
  loginWindowMinutes: number;
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const env = optional("NODE_ENV", "development") as AppConfig["env"];
  cached = {
    env,
    port: intOpt("PORT", 8080),
    // In real deploys DATABASE_URL is required; tests may stub the db layer.
    databaseUrl: optional("DATABASE_URL", "postgres://localhost:5432/one_dsd"),
    sessionIdleMinutes: intOpt("SESSION_IDLE_MINUTES", 60),
    sessionAbsoluteMinutes: intOpt("SESSION_ABSOLUTE_MINUTES", 60 * 12),
    cookieName: optional("SESSION_COOKIE", "one_dsd_session"),
    cookieSecure: optional("COOKIE_SECURE", env === "production" ? "true" : "false") === "true",
    maxLoginFailuresPerWindow: intOpt("LOGIN_MAX_FAILURES", 8),
    loginWindowMinutes: intOpt("LOGIN_WINDOW_MINUTES", 15),
  };
  return cached;
}

export { required };
