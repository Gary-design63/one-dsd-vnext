# Refactor Changelog — Adaptive Config Layer (this work session)

Status: **code-complete and verified locally; not yet deployed.**
All changes are in the working tree of this repo (one-dsd-vnext), unpushed.

## Verification (full CI, green)
- typecheck: clean
- build: clean
- migrations check: 21 files, sequential, single-tx, self-registering
- spine invariants: OK
- web invariants: OK
- tests: 118 / 118 pass
- accessibility scan: 512 checks, 0 problems, 19 pages
- smoke (live server boot): OK — security headers, immutable caching, request-id, real 404s

## What changed and why
1. **Durable config layer (new).** Migration `0021_program_config` adds
   `program_instances` + `program_config` (instance-scoped key→JSON), seeded with
   DSD as instance one (identity, naming, autonomy model, boundary lanes, model
   route, measurement targets, lifecycle). Previously this layer existed only as
   ad-hoc rows in the live DB — now it is reproducible in code. A second client is
   a new row set, not a rebuild.
   - `src/config/programConfig.ts` — typed reader; merges live config over baked-in
     DSD defaults; **fails open to defaults** so config can never take the app down.
   - `src/config/programConfig.test.ts` — pure tests (defaults, multi-client override,
     malformed-value fallback, unknown-key ignore).

2. **Adaptive masthead brand.** `src/web/layout.ts` `page()` now renders brand
   (short name, subtitle, footer) from config; `setProgramBrand()` is called once at
   server startup (`src/server.ts`) from `loadProgramConfig`. DSD is unchanged by
   design; another instance re-skins by config. Tests in `src/web/layout.test.ts`.

3. **Adaptive Ask identity.** `src/ask/provider.ts` adds a pure `buildSystemPrompt(ctx)`;
   the no-fabrication rule is constant across clients, only the program identity adapts.
   `src/ask/answer.ts` passes the active instance identity from config. Tests in
   `src/ask/provider.test.ts`.

## Build fixes (repo did not compile before this session)
- `db/migrations/0020_episode_audio.sql` — `schema_migrations (version)` → `(version)`
  to satisfy the migration verifier.
- `src/web/pages/console/controls.ts` — `dialSelect` return type `string` → `SafeHtml`.
- `src/web/pages/console/controls.render.test.ts` — supply required `ledger: []`.

## To make it live (your actions — see DEPLOY_CONFIG_LAYER.md)
1. Push to GitHub `main` (GitHub Desktop) — triggers the Azure pipeline.
2. Apply migration 0021 in Azure Cloud Shell with the DB **admin** connection string.
3. Deploy (auto on push, or `az containerapp up --source .`).

## Not touched / still optional
- OpenRouter key (Ask stays extractive until OPENROUTER_API_KEY is set as a secret).
- Full per-page config threading beyond the masthead (deferred; needs live DB to verify).
