# One DSD — vNext (the new build)

**This is the separate, clean rebuild** of the One DSD consultant operating system — its own repository, schema, deployment, and governance. The existing live Vercel app (`live-clean-content-proxy`) is **reference only**; nothing here depends on its implementation, schema, or routing.

- **Target path:** Azure-oriented production (Postgres + pgvector, Blob, Key Vault, Container Apps), per the planning package.
- **Method:** layered build (see `One-DSD-Refactor-Plan/06_Build_Layers_CANONICAL.md`), each layer finished + evidenced before the next.
- **Identity:** consultant operating system; staff surfaces are output channels.
- **Hard rule:** AI may draft/recommend/flag; it may not approve/publish/send/decide under the consultant's authority without explicit human sign-off.

## Layout
```
one-dsd-vnext/
  README.md
  db/migrations/        # canonical schema (Layer 5) — applied in order
    0001_identity_access.sql
    0002_content_and_taxonomy.sql
    0003_governance_and_audit.sql
    0004_calendar_observances.sql
    0005_learning.sql
    0006_audio.sql
    0007_assistant.sql
  src/                  # technical spine (Layer 6) — auth, gate, API, audit
  scripts/              # evidence harness, migration verify
  (infra/               # added in Layer 12)
```

## Status
- Layer 4 (IA): defined in the plan; this schema realizes it.
- Layer 5 (Schema): **✅ migrations 0001–0007 written + parse-valid (libpg_query, 122 statements).** Runtime apply (up/down on Postgres) is captured when the DB target is provisioned.
- Layer 6 (Technical Spine): **in progress** — see `src/` (auth, fail-closed visibility gate, content API, append-only audit, security headers) and `scripts/` (evidence harness).
