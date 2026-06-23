# Go-Live: Config Layer + Adaptive Brand/Ask (this change set)

This change is **code-complete and verified locally** (full CI green: 118/118 tests,
build, migrations, spine, web, accessibility, smoke). It is **not yet live**.
Two actions make it live — both need your sign-ins, so they are yours to run.

## What this change does (once live)
- Adds migration **0021_program_config**: `program_instances` + `program_config`
  (the adaptive, multi-client layer), seeded with DSD as instance one.
- The masthead brand + the Ask assistant identity now read from that config
  (fail-open to DSD defaults). A second client becomes a new config row, not a rebuild.
- Fixes that made the repo non-compiling before (0020 verifier mismatch; controls page types).

Live app: https://one-dsd-vnext.yellowsea-7eed28e5.centralus.azurecontainerapps.io

------------------------------------------------------------------------
## STEP 1  — [You · GitHub Desktop]  Commit + push the code
(My sandbox git is locked on this mount, so the commit happens on your machine.)
1. Open **GitHub Desktop** → repository **one-dsd-vnext**.
2. You will see the changed files (migrations + src). Summary suggestion:
   "Config layer (0021) + adaptive brand/Ask identity; build fixes".
3. Click **Commit to main**, then **Push origin**.
   - If the repo's GitHub Actions deploy is configured (AZURE_CREDENTIALS + the
     ACR_NAME/RESOURCE_GROUP/CONTAINERAPP_NAME variables), the push auto-builds
     and deploys. If not, use STEP 3 to deploy manually.

------------------------------------------------------------------------
## STEP 2  — [You · Azure Cloud Shell]  Apply migration 0021 to the database
Open https://shell.azure.com (Bash). Paste, replacing only ADMIN_DB_URL with the
**admin** connection string for the onedsddbprod Postgres (the one used at first
setup — migrations need owner rights, not the app's least-priv role):

```bash
ADMIN_DB_URL="postgres://<admin-user>:<password>@onedsddbprod.postgres.database.azure.com:5432/onedsd?sslmode=require"
rm -rf ~/dsd && git clone --depth 1 https://github.com/Gary-design63/one-dsd-vnext.git ~/dsd
cd ~/dsd && npm ci >/dev/null 2>&1 && npm run build >/dev/null 2>&1
DATABASE_URL="$ADMIN_DB_URL" node scripts/migrate.mjs --apply
```
Expected tail: it applies `0021_program_config` (idempotent — safe to re-run; it
skips migrations already recorded in schema_migrations).

------------------------------------------------------------------------
## STEP 3  — [You · Azure Cloud Shell]  Deploy the new build (only if STEP 1 didn't auto-deploy)
```bash
cd ~/dsd
az containerapp up \
  --name one-dsd-vnext --resource-group one-dsd-rg \
  --environment one-dsd-env --location centralus \
  --source . --ingress external --target-port 8080
```

------------------------------------------------------------------------
## VERIFY (anyone can run)
```bash
curl -s https://one-dsd-vnext.yellowsea-7eed28e5.centralus.azurecontainerapps.io/healthz
```
Then open the app and sign in — the masthead reads "One DSD / People, Access & Culture"
from config (unchanged for DSD by design; a different instance's config would re-skin it).

## Notes
- This change does NOT touch the OpenRouter key. The Ask assistant stays extractive
  until OPENROUTER_API_KEY is set as a Container App secret (separate, optional step).
- The config table is additive; applying 0021 does not alter existing content or auth.
