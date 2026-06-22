# Deploy One DSD vNext → Azure Container Apps (with Supabase as the database)

Decisions locked: **database = your existing Supabase**, **repo = `Gary-design63/one-dsd-web`** (its static app is replaced by vNext). Everything below is copy‑paste, in order. Fill the few `<…>` placeholders.

The repo is already committed locally with the Dockerfile, deploy pipeline, and scripts. You only run commands that need your sign‑in.

---

## 0. Push vNext to the repo (one time)
From the `one-dsd-vnext` folder:
```
git remote add origin https://github.com/Gary-design63/one-dsd-web.git
git push -u origin main --force
```
(`--force` because vNext replaces the old static app, as agreed.)

## 1. Get your Supabase connection string
Supabase dashboard → your project → **Project Settings → Database → Connection string → URI**.
It looks like `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`.
Add `?sslmode=require` to the end. Keep it handy as `<SUPABASE_URL>` below.

## 2. Create the Azure home (paste into Azure Cloud Shell at portal.azure.com, or local `az`)
```
az login
RG=one-dsd-rg; LOC=centralus; ACR=onedsdacr$RANDOM; ENVN=one-dsd-env; APP=one-dsd-vnext
az group create -n $RG -l $LOC
az acr create -n $ACR -g $RG --sku Basic --admin-enabled true
az containerapp env create -n $ENVN -g $RG -l $LOC
echo "ACR_NAME=$ACR  RESOURCE_GROUP=$RG  CONTAINERAPP_NAME=$APP"   # note these
```

## 3. Build the image and create the app
```
az acr build -r $ACR -t one-dsd-vnext:init .
az containerapp create -n $APP -g $RG --environment $ENVN \
  --image $ACR.azurecr.io/one-dsd-vnext:init \
  --registry-server $ACR.azurecr.io \
  --target-port 8080 --ingress external \
  --secrets database-url="<SUPABASE_URL>" session-secret="<LONG_RANDOM_STRING>" \
  --env-vars NODE_ENV=production COOKIE_SECURE=true PORT=8080 \
             DATABASE_URL=secretref:database-url SESSION_SECRET=secretref:session-secret
az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
```
The last line prints your live URL.

## 4. Set up the database (run once, from the `one-dsd-vnext` folder)
```
npm ci && npm run build
DATABASE_URL="<SUPABASE_URL>" node scripts/migrate.mjs --apply
DATABASE_URL="<SUPABASE_URL>" node scripts/seed-consultant.mjs <you@org> <username>
```
The seed prints a one‑time password — change it at first sign‑in.

## 5. Turn on push‑to‑deploy (so you never touch this again)
```
az account show --query id -o tsv     # this is <SUB_ID>
az ad sp create-for-rbac --name one-dsd-deploy --role contributor \
  --scopes /subscriptions/<SUB_ID>/resourceGroups/one-dsd-rg --sdk-auth
```
Copy the JSON it prints. Then in GitHub → repo **one-dsd-web** → Settings → Secrets and variables → Actions:
- **Secret** `AZURE_CREDENTIALS` = that JSON
- **Variables**: `ACR_NAME`, `RESOURCE_GROUP` (=`one-dsd-rg`), `CONTAINERAPP_NAME` (=`one-dsd-vnext`)

From now on, every `git push` to `main` runs the checks and auto‑deploys (`.github/workflows/deploy-azure.yml`).

---

## What needs you vs. what's done
- **Done (in the repo):** the app, container, deploy pipeline, migration + seed scripts.
- **Yours (one‑time, needs your sign‑in):** the `git push`, the Azure commands in steps 2–3 and 5, the two secret values, and the GitHub secret/variables. I can't run these — they require your Azure/GitHub login.

## Notes
- vNext's migrations enable `pgvector`, `pg_trgm`, `pgcrypto` — all available on Supabase.
- No model/API key is required to launch; the "smart" features stay dormant (zero spend) until you add one later.
- Rollback: Container Apps keeps the previous revision; `az containerapp revision list/​activate` switches back. The database is unaffected by an app rollback.
