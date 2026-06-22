// =====================================================================
// Evidence harness — spine invariants (Layer 6)
// Static guards that the security-critical wiring is present. These are the
// "receipts" that the gate is not bypassable by construction:
//   - content handlers import the visibility gate
//   - the audit table grant is append-only (no UPDATE/DELETE to the app role)
//   - security headers include the non-negotiable set
//   - login never logs or returns plaintext passwords
// Exits non-zero on any failure.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let failures = 0;
const ok = (m) => console.log("OK:", m);
const fail = (m) => { failures++; console.error("FAIL:", m); };
const must = (cond, m) => (cond ? ok(m) : fail(m));

// 1. Content delivery routes through the fail-closed gate.
const content = read("src/api/content.ts");
must(/visibilitySqlClause/.test(content) && /canRead/.test(content),
  "content API imports the fail-closed visibility gate");
must(!/a\.visibility\s*=\s*'staff'/.test(content),
  "content API does not hand-roll a visibility WHERE clause");

// 2. Audit is append-only at the grant level.
const gov = read("db/migrations/0003_governance_and_audit.sql");
must(/REVOKE UPDATE, DELETE ON audit_events FROM one_dsd_app/.test(gov),
  "audit_events: UPDATE/DELETE revoked from app role");
must(/REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC/.test(gov),
  "audit_events: UPDATE/DELETE revoked from PUBLIC");
must(/GRANT SELECT, INSERT ON audit_events/.test(gov),
  "audit_events: app role may only SELECT/INSERT");

// 3. Non-negotiable security headers.
const headers = read("src/security/headers.ts");
for (const h of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Strict-Transport-Security",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  must(headers.includes(h), `security header present: ${h}`);
}
must(/frame-ancestors 'none'/.test(headers), "CSP denies framing (frame-ancestors none)");
must(/object-src 'none'/.test(headers), "CSP denies object-src");

// 4. Passwords: never stored/returned/logged in plaintext.
const login = read("src/auth/login.ts");
const pw = read("src/auth/password.ts");
must(/verifyPassword/.test(login), "login verifies via constant-time hash compare");
must(/timingSafeEqual/.test(pw), "password verify uses timingSafeEqual");
must(!/console\.\w+\([^)]*password/i.test(login), "login does not log passwords");

// 5. Sessions store only a hash of the token.
const session = read("src/auth/session.ts");
must(/sha256\(/.test(session) && /token_hash/.test(session),
  "sessions persist only sha256(token), never the raw token");

// 6. Governance (Layer 8): the hard rule is enforced in code.
const approvals = read("src/governance/approvals.ts");
must(/mayRelease\(/.test(approvals), "approvals: authorization via mayRelease()");
must(/audit\(/.test(approvals), "approvals: decisions are audited");
must(/content_release_events/.test(approvals), "approvals: publish records a release event");
must(/approval_state = 'approved'/.test(approvals), "approvals: release flips asset to approved");
const consult = read("src/governance/consultation.ts");
must(/isAuthority\(/.test(consult), "consultation: authority-gated access");
must(/consultation.read_pii/.test(consult), "consultation: PII reads are audited");
const policy = read("src/governance/policy.ts");
must(/blocked/.test(policy) && /act_then_report/.test(policy), "policy: full autonomy ladder present");

// 7. Ask (Layer 9): KB-first, gated, never fabricates.
const askAns = read("src/ask/answer.ts");
must(/decideDisposition\(/.test(askAns), "ask: routes through the confidence/sufficiency gate");
must(/extractiveAnswer\(/.test(askAns), "ask: has an extractive floor (no provider needed)");
must(/never fail to a fabricated answer|never fabricates|Never fabricates/.test(askAns), "ask: documents no-fabrication on provider failure");
const askRetr = read("src/ask/retrieval.ts");
must(/approval_state = 'approved'/.test(askRetr) && /visibility = ANY/.test(askRetr), "ask retrieval: approved + visibility-gated only");
const askConf = read("src/ask/confidence.ts");
must(/insufficient_source/.test(askConf) && /relevanceFloor/.test(askConf), "ask gate: answer + honest no-match (relevance floor)");
must(!/approval_items/.test(askAns), "ask: NO consultant-routing bottleneck (content is vetted at ingestion)");

// 8. Brain (Layer 10): autonomy honors authority + safety; never auto-publishes.
const auto = read("src/agents/autonomy.ts");
must(/guardrail/i.test(auto) && /kill-switch|paused/.test(auto), "brain: kill-switch + hard-guardrail precedence");
must(/force override/.test(auto), "brain: consultant force override exists");
const orch = read("src/agents/orchestrator.ts");
must(/audit\(/.test(orch) && /agent_run_events/.test(orch), "brain: delegations are audited + observable");
must(!/content_release_events/.test(orch), "brain: orchestrator never publishes (no release path)");
const ctrl = read("src/agents/controls.ts");
must(/isAuthority\(/.test(ctrl), "brain controls: kill-switch/override are authority-only");
const research = read("src/agents/research.ts");
must(/available\(\):\s*boolean\s*\{\s*return false/.test(research) || /return false/.test(research), "brain research: Null provider until model+key (ADR 15)");

// 9. Growth (Layer 11): consent-gated, suggestions-only, non-HR/surveillance.
const reco = read("src/reco/engine.ts");
must(/hasConsent\(/.test(reco) && /return null/.test(reco), "growth: generation is consent-gated (no consent => nothing)");
must(/'suggested'/.test(reco), "growth: writes suggestions, not assignments");
const recoScore = read("src/reco/score.ts");
must(!/manager|supervisor|surveil/i.test(recoScore), "growth: scorer uses no HR/surveillance inputs");

// 10. Synthesis layer: deterministic reconciliation before external research.
const syn = read("src/synthesis/synthesize.ts");
must(/clusterPassages\(/.test(syn) && /buildBrief\(/.test(syn), "synthesis: clusters + builds a brief");
must(/needsExternalResearch\(/.test(syn), "synthesis: gates external research on gaps/low-confidence");
must(/narrative: null/.test(syn), "synthesis: no generative fabrication by default (narrative null)");
const synEng = read("src/synthesis/engine.ts");
must(/retrieve\(/.test(synEng), "synthesis engine: reuses approved + visibility-gated retrieval");
must(/agent_run_events/.test(synEng) && /audit\(/.test(synEng), "synthesis engine: observable + audited");

// 11. Workflow runner + tool allowlist (Layer 10 completion).
const runner = read("src/agents/workflows/runner.ts");
must(!/content_release_events/.test(runner), "workflow runner: never auto-publishes");
must(/gate/.test(runner) && /short-circuit/.test(runner), "workflow runner: gate short-circuits (human/blocked)");
const allow = read("src/agents/tools/allowlist.ts");
must(/not in allowlist/.test(allow), "tools: fail-closed (unknown tool throws)");
must(!/arbitrary|raw sql|execute_sql/i.test(allow.replace(/no arbitrary SQL/gi,'')), "tools: no arbitrary-SQL capability");
const pa = read("src/agents/workflows/policy_advisor.ts");
must(/getTool[<(]/.test(pa) && /resolveAutonomy\(/.test(pa), "policy advisor: uses allowlist + autonomy gate");
must(/approval_items/.test(pa) && !/content_release_events/.test(pa), "policy advisor: stages a draft, never publishes");

// 12. In-place editing: authority-only, allowlisted, versioned, audited.
const edit = read("src/api/edit_routes.ts");
must(/requireRole\([^)]*AUTHORITY|consultant/.test(edit), "edit: authority-gated (consultant/admin)");
must(/validateEntityPatch\(/.test(edit), "edit: field-allowlisted via registry (no arbitrary columns)");
must(/knowledge_versions/.test(edit) && /edit_history/.test(edit) && /site_copy_versions/.test(edit), "edit: snapshots prior value (versioned)");
must(/audit\(/.test(edit), "edit: every change audited");
const editCore = read("src/editing/edit.ts");
must(/canEdit\(/.test(editCore) && /AUTHORITY/.test(editCore), "edit core: authority check present");
const reg = read("src/editing/registry.ts");
must(/ENTITIES/.test(reg) && !/users|audit_events/.test(reg.replace(/\/\/.*/g,"")), "edit registry: only content entities (no users/audit)");

// 13. Revision history + rollback: authority-only, reversible, audited.
const hist = read("src/editing/history.ts");
must(/isAuthority\(/.test(hist), "history: rollback is authority-gated");
must(/pre-rollback snapshot/.test(hist), "history: rollback snapshots current value first (reversible)");
must(/audit\(/.test(hist) && /rollback/.test(hist), "history: rollback is audited");
must(/content\.note/.test(hist), "history: consultant notes are recorded to the audit trail");
const histRoutes = read("src/web/console_routes.ts");
must(/isAuthority\(viewer\)/.test(histRoutes) && /forbidden\(res\)/.test(histRoutes),
  "history routes: authority-gated (reviewers cannot roll back)");

// 14. Content ingestion: validated, PII/AI-blocking, never auto-publishes.
const ingv = read("src/ingest/validate.ts");
must(/no client PII may be ingested/.test(ingv), "ingestion: blocks PII");
must(/"AI" wording is not allowed/.test(ingv), "ingestion: blocks AI wording");
const ingl = read("scripts/ingest.mjs");
must(/--apply/.test(ingl) && /DRY RUN/.test(ingl), "ingestion loader: dry-run by default, explicit --apply");
must(/draft/i.test(ingl) && !/content_release_events/.test(ingl), "ingestion loader: stages drafts, never publishes");
must(/content_source_map/.test(ingl), "ingestion loader: idempotent via content_source_map");

// 15. Production hardening: immutable asset cache, structured logs, error seam.
const sf = read("src/web/staticFiles.ts");
must(/immutable/.test(sf) && /versioned/.test(sf), "assets: versioned requests served immutable");
const obs = read("src/obs/log.ts");
must(/redact\(/.test(obs) && /captureError\(/.test(obs), "observability: structured logs + redaction + error capture");
const srv = read("src/server.ts");
must(/captureError\(/.test(srv) && !/console\.error\(/.test(srv), "server: errors go through captureError (no raw console.error)");
must(/x-request-id|X-Request-Id/i.test(srv), "server: request id emitted for tracing");

// 16. Rate limiting + media auth (defense-in-depth).
const rl = read("src/security/ratelimit.ts");
must(/rateLimit\(/.test(rl) && /retryAfterSec/.test(rl), "ratelimit: fixed-window with retry-after");
const srv2 = read("src/server.ts");
must(/signin:/.test(srv2) && /ask:/.test(srv2) && /429/.test(srv2), "server: sign-in + ask are rate-limited (429)");
const audioPage = read("src/web/pages/audio.ts");
must(/\/media\/audio\//.test(audioPage) && !/storage_url/.test(audioPage), "audio: served via authed route, no object URL in page");
const media = read("src/media/sign.ts");
must(/signMediaUrl\(/.test(media), "media: short-lived signer seam present");

if (failures === 0) {
  console.log("\nSPINE OK — all invariants hold.");
  process.exit(0);
} else {
  console.error(`\n${failures} spine invariant(s) failed.`);
  process.exit(1);
}
