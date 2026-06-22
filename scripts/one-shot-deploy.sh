#!/usr/bin/env bash
# =====================================================================
# One DSD vNext — ONE-SHOT deploy to Azure Container Apps.
#
# HOW TO USE:
#   1. Open Azure Cloud Shell (Bash):  https://shell.azure.com
#   2. Edit the three variables in the "FILL THIS IN" block below.
#   3. Paste this whole script into the shell and press Enter.
#   4. Walk away ~10-15 min. The final banner tells you if it worked.
#
# It is idempotent: safe to re-run. It self-verifies by curling /healthz.
# No interactive prompts (uses --source on a PUBLIC repo, no device-code).
# =====================================================================
set -euo pipefail

# ======================= FILL THIS IN ================================
# Your Supabase / Postgres connection string. MUST be replaced.
# Example: postgres://postgres.abcxyz:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
SUPABASE_URL="REPLACE_WITH_YOUR_SUPABASE_POSTGRES_CONNECTION_STRING"

# The first consultant (owner) account to seed.
CONSULTANT_EMAIL="you@example.com"
CONSULTANT_USERNAME="owner"
# =====================================================================

# ----------------- fixed deployment parameters (verified) ------------
RESOURCE_GROUP="one-dsd-rg"
ENVIRONMENT="one-dsd-env"
APP_NAME="one-dsd-vnext"
LOCATION="centralus"
REPO_URL="https://github.com/Gary-design63/one-dsd-vnext.git"
TARGET_PORT="8080"
WORKDIR="${HOME}/one-dsd-deploy"
TOTAL_STEPS="9"

# ----------------- helpers -------------------------------------------
CURRENT_STEP=""
step() { CURRENT_STEP="$1"; echo ""; echo "STEP ${1}/${TOTAL_STEPS}: ${2}"; }

fail() {
  local msg="$1"
  echo ""
  echo "==== DEPLOY FAILED at step ${CURRENT_STEP}/${TOTAL_STEPS}: ${msg} ===="
  exit 1
}
# Any unexpected error trips this and reports the step we were on.
trap 'fail "unexpected error (see output above)"' ERR

wait_for_provider() {
  local ns="$1"
  echo "  registering ${ns} ..."
  az provider register --namespace "${ns}" --wait >/dev/null 2>&1 || \
    az provider register --namespace "${ns}" >/dev/null 2>&1 || true
  local state="" tries=0
  while [ "${tries}" -lt 40 ]; do
    state="$(az provider show --namespace "${ns}" --query registrationState -o tsv 2>/dev/null || echo "")"
    if [ "${state}" = "Registered" ]; then
      echo "  ${ns}: Registered"
      return 0
    fi
    tries=$((tries + 1))
    sleep 10
  done
  fail "provider ${ns} did not reach Registered (last state: ${state:-unknown})"
}

# =====================================================================
# STEP 1 — validate inputs
# =====================================================================
step 1 "Validate inputs"
if [ "${SUPABASE_URL}" = "REPLACE_WITH_YOUR_SUPABASE_POSTGRES_CONNECTION_STRING" ] || [ -z "${SUPABASE_URL}" ]; then
  echo "  SUPABASE_URL is still the placeholder."
  echo "  Edit the 'FILL THIS IN' block at the top of this script with your real"
  echo "  Supabase Postgres connection string, then paste it again."
  fail "SUPABASE_URL not set"
fi
case "${SUPABASE_URL}" in
  postgres://*|postgresql://*) : ;;
  *) fail "SUPABASE_URL must start with postgres:// or postgresql://" ;;
esac
command -v az   >/dev/null 2>&1 || fail "Azure CLI (az) not found — run this in Azure Cloud Shell"
command -v git  >/dev/null 2>&1 || fail "git not found"
command -v node >/dev/null 2>&1 || fail "node not found — Cloud Shell should have it"
command -v npm  >/dev/null 2>&1 || fail "npm not found"
command -v openssl >/dev/null 2>&1 || fail "openssl not found"
command -v curl >/dev/null 2>&1 || fail "curl not found"
SUB_ID="$(az account show --query id -o tsv 2>/dev/null || true)"
[ -n "${SUB_ID}" ] || fail "not logged in to Azure (Cloud Shell should already be authenticated)"
echo "  OK — subscription: ${SUB_ID}"
echo "  OK — consultant:   ${CONSULTANT_USERNAME} <${CONSULTANT_EMAIL}>"

# =====================================================================
# STEP 2 — register resource providers (incl. the one that broke before)
# =====================================================================
step 2 "Register Azure resource providers and wait"
wait_for_provider "Microsoft.App"
wait_for_provider "Microsoft.OperationalInsights"
wait_for_provider "Microsoft.ContainerRegistry"   # <-- missing this caused the prior failure

# =====================================================================
# STEP 3 — install containerapp CLI extension (non-interactive)
# =====================================================================
step 3 "Install/upgrade containerapp CLI extension"
az config set extension.use_dynamic_install=yes_without_prompt >/dev/null 2>&1 || true
if az extension show --name containerapp >/dev/null 2>&1; then
  az extension update --name containerapp >/dev/null 2>&1 || true
else
  az extension add --name containerapp --yes >/dev/null 2>&1 \
    || fail "could not install containerapp extension"
fi
echo "  containerapp extension ready"

# =====================================================================
# STEP 4 — clone or refresh the repo
# =====================================================================
step 4 "Clone or refresh the repository"
if [ -d "${WORKDIR}/.git" ]; then
  echo "  refreshing existing checkout in ${WORKDIR}"
  git -C "${WORKDIR}" fetch --all --prune >/dev/null 2>&1 || fail "git fetch failed"
  git -C "${WORKDIR}" reset --hard origin/HEAD >/dev/null 2>&1 \
    || git -C "${WORKDIR}" pull --ff-only >/dev/null 2>&1 \
    || fail "git refresh failed"
else
  rm -rf "${WORKDIR}"
  git clone --depth 1 "${REPO_URL}" "${WORKDIR}" >/dev/null 2>&1 || fail "git clone failed"
fi
[ -f "${WORKDIR}/Dockerfile" ] || fail "Dockerfile not found at repo root after checkout"
echo "  repo ready at ${WORKDIR}"

# =====================================================================
# STEP 5 — build container & deploy with 'az containerapp up' (idempotent)
# =====================================================================
step 5 "Build image from source and deploy (az containerapp up)"
echo "  this builds the Docker image and creates RG/env/app if missing (~5-10 min) ..."
az containerapp up \
  --name "${APP_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --environment "${ENVIRONMENT}" \
  --source "${WORKDIR}" \
  --ingress external \
  --target-port "${TARGET_PORT}" \
  || fail "az containerapp up failed"
echo "  deploy command completed"

# =====================================================================
# STEP 6 — set secrets + environment variables
# =====================================================================
step 6 "Set app secrets and environment variables"
SESSION_SECRET="$(openssl rand -hex 32)"
az containerapp secret set \
  --name "${APP_NAME}" --resource-group "${RESOURCE_GROUP}" \
  --secrets "database-url=${SUPABASE_URL}" "session-secret=${SESSION_SECRET}" \
  >/dev/null \
  || fail "could not set secrets"
az containerapp update \
  --name "${APP_NAME}" --resource-group "${RESOURCE_GROUP}" \
  --set-env-vars \
    "DATABASE_URL=secretref:database-url" \
    "SESSION_SECRET=secretref:session-secret" \
    "NODE_ENV=production" \
    "COOKIE_SECURE=true" \
    "PORT=${TARGET_PORT}" \
  >/dev/null \
  || fail "could not set environment variables"
echo "  secrets + env applied (a new revision is rolling out)"

# =====================================================================
# STEP 7 — build locally then run DB migrations + seed against Supabase
# =====================================================================
step 7 "Build app and run DB migrations + seed (against Supabase)"
pushd "${WORKDIR}" >/dev/null
echo "  npm ci ..."
npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1 || fail "npm install failed"
echo "  npm run build ..."
npm run build >/dev/null 2>&1 || fail "npm run build failed (migrate/seed need dist/)"
echo "  applying migrations ..."
DATABASE_URL="${SUPABASE_URL}" node scripts/migrate.mjs --apply || fail "database migration failed"
echo "  seeding consultant ..."
DATABASE_URL="${SUPABASE_URL}" node scripts/seed-consultant.mjs "${CONSULTANT_EMAIL}" "${CONSULTANT_USERNAME}" \
  || fail "consultant seed failed"
popd >/dev/null
echo "  database ready"

# =====================================================================
# STEP 8 — retrieve FQDN
# =====================================================================
step 8 "Retrieve application FQDN"
FQDN="$(az containerapp show \
  --name "${APP_NAME}" --resource-group "${RESOURCE_GROUP}" \
  --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || true)"
[ -n "${FQDN}" ] || fail "could not retrieve ingress FQDN (is ingress external?)"
APP_URL="https://${FQDN}"
echo "  FQDN: ${FQDN}"

# =====================================================================
# STEP 9 — self-verify via /healthz
# =====================================================================
step 9 "Self-verify the live app (/healthz)"
echo "  waiting for the new revision to serve traffic, then probing ${APP_URL}/healthz ..."
HEALTHY="no"
BODY=""
for attempt in $(seq 1 30); do
  CODE="$(curl -s -o /tmp/one_dsd_healthz.txt -w '%{http_code}' --max-time 15 "${APP_URL}/healthz" 2>/dev/null || echo "000")"
  BODY="$(cat /tmp/one_dsd_healthz.txt 2>/dev/null || echo "")"
  if [ "${CODE}" = "200" ] && printf '%s' "${BODY}" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    HEALTHY="yes"
    echo "  attempt ${attempt}: HTTP 200 + status ok"
    break
  fi
  echo "  attempt ${attempt}/30: HTTP ${CODE} (not ready yet) — retrying in 15s"
  sleep 15
done
[ "${HEALTHY}" = "yes" ] || fail "health check never returned HTTP 200 {\"status\":\"ok\"} (last HTTP, body: ${BODY:-<empty>})"

# =====================================================================
# SUCCESS
# =====================================================================
trap - ERR
echo ""
echo "==== DEPLOY OK — YOUR APP IS LIVE: ${APP_URL} ===="
