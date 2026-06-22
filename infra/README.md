# One DSD vNext — Infrastructure / Deployment Posture (Layer 12)

**Target:** Azure-oriented production. Single secure Node front-door + (later) a Python/FastAPI reasoning service (ADR 15). Everything below is the *intended posture*; runtime provisioning is the consultant's go-live step.

## Components
- **App (Tier 1):** Node 20 container (`Dockerfile`) → **Azure Container Apps** (HTTPS only, autoscale, health probe `/healthz`).
- **Database:** **Azure Database for PostgreSQL Flexible Server**, `pgvector` + `pg_trgm` enabled. App connects as least-privilege role `one_dsd_app`.
- **Secrets:** **Azure Key Vault** → injected as env at runtime (DATABASE_URL, model/keys when added). Nothing secret in the repo (`.env` git-ignored; `.env.example` only).
- **Object storage:** **Azure Blob** for audio renders (pointers in `audio_renders.storage_url`).
- **Reasoning service (Tier 2, later):** Python/FastAPI container; called by Tier 1 only; holds no authority/secrets beyond its model key.

## Deploy checklist (pre-go-live)
1. Provision Postgres; enable `vector`, `pg_trgm`, `pgcrypto`. Apply migrations `0001…0012` in order; confirm `schema_migrations` rows.
2. Create role `one_dsd_app` (migrations create it `NOLOGIN`; assign login/credentials per environment).
3. Key Vault: set `DATABASE_URL`, `COOKIE_SECURE=true`, session lifetimes; (later) model/provider keys.
4. Container build (`Dockerfile`) → Container Apps; set min replicas ≥1; health probe `/healthz`.
5. Front with HTTPS + edge **rate limiting** (login + `/api/ask`); confirm HSTS/CSP headers pass.
6. Seed the first **consultant** user (authority) out-of-band; verify console + kill-switch reachable.
7. Run `npm run verify` in CI on the release commit; archive `docs/EVIDENCE.md`.

## Backups & recovery
- Postgres: automated daily backups + point-in-time restore (Flexible Server default); test a restore before launch.
- Blob: soft-delete + versioning on the audio container.
- **Append-only audit** (`audit_events`) + **agent observability** (`agent_run_events`) are the forensic record; amendments are attributed (never destructive).

## Monitoring
- Liveness: `/healthz`. App logs to stdout → Container Apps log analytics.
- Watch: login failure spikes (`session_events`), Ask no-match rate, delegation `blocked` rate, automation_state changes.
- Metrics surface (`program_metrics` / `metric_snapshots`): agent-driven share (0.70), survey participation (0.70), consultant hours reclaimed — all aggregate, min cell size enforced.
