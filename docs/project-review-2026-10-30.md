# MMS Project Review — 2026-10-30

Read-only whole-repository review at `main` (`84516ad04`), followed by targeted fixes for the
findings below (branch `fix/project-review-2026-10-30`). This is a
point-in-time review: it complements [`open-items.md`](./open-items.md) (the running debt register)
and the same-day subsystem reviews ([backend 2026-10-30](./backend-review-2026-10-30.md),
[frontend deep 2026-10-30](./frontend-review-2026-10-30-deep.md),
[UI/UX 2026-10-30](./ui-ux-review-2026-10-30/README.md)).

**Verdict: healthy, unusually well-gated codebase, with one production-only functional regression.**
All 21 blocking pre-PR gates pass, 7,736 unit tests pass across the three packages, the app builds
inside its bundle/PWA budgets, and the security architecture (tenant isolation, module gates, CSRF,
CSP, uploads, SSRF, audit chains) is deliberate and tested. No Critical or cross-tenant defect was
found. The findings below were all fixed in this pass: an inline-script/CSP conflict that disabled
automatic printing in production (Major), a coverage-denominator gap that survived the frontend basis
correction (Major, measurement), and three minor hardening items. The dominant residual risk remains
**operational**: production still runs with tenant RLS in `warn` mode behind `MMS_ALLOW_RLS_WARN=1`.

---

## 1. Snapshot

| Item | Value |
| --- | --- |
| Branch / HEAD | `main` · `84516ad04` (clean tree, `0/0` vs `origin/main`) |
| Review date | 2026-10-30 (Asia/Karachi) |
| Toolchain | Node `26.7.0` local (CI runs Node 24), pnpm `11.15.1` (matches `packageManager`) |
| Source size | backend 1,649 `.ts` · frontend 3,848 `.ts(x)` · shared 883 · e2e 20 specs |
| Migrations | 198 forward-only SQL migrations (`apps/backend/src/db/migrations_drizzle`) |
| Journal head | `0197_backend_review_hardening` |
| Tests | 1,600 files · 7,736 executed at review time (2,235 backend + 3,757 frontend + 1,744 shared), 2 skipped; 7,746 after the resolution tests |
| Standards | 49 skills · 23 rules · 19 ADRs · DeepSeek Harness `.dsh` mirror in sync |
| Delta since 10-29 review | 18 commits (`ee5cffefd`…`2b7c16d18`) plus e2e-only `84516ad04` (#238) |

The plan snapshot named `2b7c16d18`; one e2e-only commit (`84516ad04`, three files under `e2e/`)
landed during the session. The review was re-anchored to the new HEAD; nothing else changed.

## 2. Verification evidence

All commands were run on 2026-10-30 against this workspace; results are measured, not quoted from
prior reports. The resolution pass added 10 regression tests (8 frontend across 3 files, 2 backend),
so the post-fix suite is 7,746 tests across 1,601 files and the full `ci:local:full` run is green.

| Check | Result |
| --- | --- |
| `pre-pr-review.sh` (full scope) | **21/21 blocking gates pass**, plus the advisory TDD-pairing check (no backend domain files in scope) |
| Backend unit suite | 320/320 files · 2,235/2,235 tests · 30.9 s |
| Frontend unit suite | 1,047/1,047 files · 3,757 passed, 2 skipped · 70.2 s |
| Shared unit suite | 233/233 files · 1,744/1,744 tests · 5.4 s |
| `turbo run build --force` | 3/3 packages · 39.4 s, zero cache hits |
| Bundle budget | 637 chunks · 14.67 MB raw / 4.18 MB gzip (budgets 15 / 4.5) · largest 1.40 MB `elk` (budget 2.5) |
| PWA precache | 34 entries · 2.16 MB (budgets 50 / 3.5) |
| `pnpm audit` | 1 moderate (`ts-deepmerge`) + 1 low (`deepmerge`) — both documented reviewed exceptions, 0 high/critical |
| Code norms | 0 explicit `any` · 0 arbitrary-colour expressions · 26 raw hex (baseline 26) · 4 files > 300 LOC (the four i18n dictionaries, baseline 4) |
| Frontend ESLint (`--no-cache`) | 0 errors · 149 warnings (82 `react-hooks`, 67 `jsx-a11y`) |
| i18n | 9,434 English keys · 517 unreferenced (baseline 518, 5.5 %) across 6,529 scanned files |
| Coverage floors (config) | backend 46/43.5/41/33 · frontend 42/41/34/40 with whole-tree `include` · shared 79/75/72/57 |
| Assertion-specificity ratchet | baseline 288, unchanged |

Not executed here: `test:db`, `test:rls` (no disposable Postgres), the Playwright suites (no seeded
servers), and any deploy. See §7.

## 3. Findings

### 3.1 Verified still fixed since the prior reviews

Each claim was re-read in code and/or covered by a test that ran in this pass.

| Prior finding | Evidence |
| --- | --- |
| Print-window title XSS (10-29 project review §3.1) | [`printHtmlDocument.ts`](../apps/frontend/src/lib/ui/printHtmlDocument.ts#L21) and [`printWindowHtml.ts`](../apps/frontend/src/lib/printWindowHtml.ts#L33) still run titles through `escapeHtml`; both popups also null their `opener`. |
| Executable social URL schemes (10-29 §3.2) | [`socialPlatformUtils.ts`](../packages/shared/src/messaging/socialPlatformUtils.ts#L33) rejects any explicit scheme outside `http(s)`/`mailto`/`tel`. |
| Backend F1/F12 audit trail | [`auditTrailService.ts`](../apps/backend/src/services/auditTrailService.ts#L66) joins the active transaction; shard append takes `pg_advisory_xact_lock(hashtext(...))` at L122. |
| Backend F4/F5 finance | Invoice replay check → `409 conflict` ([`financeInvoiceMutationOperations.ts`](../apps/backend/src/finance/financeInvoiceMutationOperations.ts#L129)); settlement row lock `forUpdate: true` ([`financeMutationOperations.ts`](../apps/backend/src/finance/use-cases/financeMutationOperations.ts#L116)). |
| Backend F37/F45 | Revocation TTL `Math.max(60, remainingSeconds)` ([`authSessionRoutes.ts`](../apps/backend/src/routes/common/auth/authSessionRoutes.ts#L83)); 2FA challenge tenant match ([`twoFactorService.ts`](../apps/backend/src/services/auth/twoFactorService.ts#L89)). |
| Backend F39/F40 | Uploads and tenant files send `Cache-Control: private, no-store`; 5xx upload errors return a request reference ([`staticAssets.ts`](../apps/backend/src/plugins/staticAssets.ts#L43), [`uploads.ts`](../apps/backend/src/routes/common/uploads.ts#L43)). |
| Backend F6/F17 | Erasure requires `X-Confirm-Erasure` ([`auditPrivacyRoutes.ts`](../apps/backend/src/routes/tenant/audit/auditPrivacyRoutes.ts#L37)); worker shutdown budget `JOB_EXECUTION_TIMEOUT_MS + 10_000` ([`worker/index.ts`](../apps/backend/src/worker/index.ts#L181)). |
| Frontend F-01 pagination keys | `common.pagination.*` exists ×4 locales; `ListPagination` compares `value !== key` instead of `??`, with explicit namespace → shared → English fallback ([`ListPagination.tsx`](../apps/frontend/src/components/app/ListPagination.tsx#L41)). |
| Frontend F-02 settings deep links | One validated contract in [`settingsDeepLink.ts`](../apps/frontend/src/lib/config/settingsDeepLink.ts#L9). |
| Frontend tranche 3/4 | `apiContractErrorUsage.test.ts`, `retryPolicy.ts`, `RouteAnnouncer.tsx`, `calendarLocale.ts` all present; retry policy skips 401/403/404/409/422/429 and honours `Retry-After`. |
| Coverage basis correction (frontend) | `coverage.include: ["src/**/*.{ts,tsx}"]` + floors 42/41/34/40 ([`vitest.config.ts`](../apps/frontend/vitest.config.ts#L111)). |
| UI/UX date corruption | [`DateText.tsx`](../apps/frontend/src/components/app/DateText.tsx#L13) renders dates in an isolated `bdi dir="ltr"` run. |
| `packages/ui` types | Now a real private package (`packages/ui/package.json`) and covered by the code-norm ratchets; register updated. |

### 3.2 New findings

#### P-01 — Major — Automatic printing is dead in production (inline script vs CSP)

**Where:** [`printWindowHtml.ts:50`](../apps/frontend/src/lib/printWindowHtml.ts#L50) and
[`paperBuilderUtils.ts:161`](../apps/frontend/src/tenant/features/question-bank/lib/paperBuilderUtils.ts#L161)
write an inline `<script>` into a `window.open("")` document; consumers are the accounting payment
voucher ([`usePaymentVoucherPrint.ts:129`](../apps/frontend/src/tenant/features/accounting/hooks/usePaymentVoucherPrint.ts#L129)),
the obligations/invoice print controller
([`usePrintInvoiceModalController.ts:69`](../apps/frontend/src/tenant/features/obligations/components/invoice/usePrintInvoiceModalController.ts#L69)),
and the question-bank paper builder
([`usePaperBuilderHandlers.ts:73`](../apps/frontend/src/tenant/features/question-bank/hooks/usePaperBuilderHandlers.ts#L73)).

**Evidence:** the app sends a nonce-only CSP (`script-src 'self' 'nonce-…'`, no `'unsafe-inline'`)
on every response ([`security.ts:47`](../apps/backend/src/plugins/security.ts#L47)). An `about:blank`
document created by `window.open` inherits that policy container, so the written inline script is
blocked. Reproduced directly with Playwright against a server sending `script-src 'self' 'nonce-abc123'`:

```json
{ "title": "", "body": "content",
  "logs": ["Executing inline script violates the following Content Security Policy directive
            'script-src 'self' 'nonce-abc123''. … The action has been blocked."] }
```

**Impact:** in production (SPA served by Fastify, CSP active) these print windows render content but
never call `window.print()` and never register `onafterprint`, so they neither open the print dialog
nor close themselves. Dev is unaffected — the Vite server (:5173) sends no CSP — which is why local
use and the e2e suite do not catch it: [`print-documents.spec.ts`](../e2e/tests/features/print-documents.spec.ts#L1)
asserts print-media CSS only. Unit tests assert the HTML string and never execute it.

**Fixed:** the inline scripts are gone. `printWindowHtml.ts` now exports `autoPrintWindow(win)`,
which prints from the opener once fonts settle and closes the window on `afterprint`; the voucher,
invoice-modal, receipt, certificate, and paper-builder call sites all use it. `buildPaperPrintHtml`
replaces the hand-built document in `paperBuilderUtils.ts`. New/extended tests assert the generated
markup contains no `<script>` (they failed before the fix), that `autoPrintWindow` prints after fonts
resolve, prints immediately without a font set, still prints when font loading rejects, and closes on
`afterprint`. A Playwright test against the CSP-protected server is still the stronger future guard
and remains a follow-up (the unit assertion is the change-time ratchet).

#### P-02 — Major (gate integrity) — backend and shared coverage still measure only loaded files

**Where:** [`apps/backend/vitest.config.ts:45`](../apps/backend/vitest.config.ts#L45) and
[`packages/shared/vitest.config.ts:17`](../packages/shared/vitest.config.ts#L17) define `coverage`
exclusions and thresholds but no `coverage.include`; the frontend added one on 2026-10-30 after
discovering that 715 of 2,820 source files never entered its denominator.

**Impact:** the backend `46/43.5/41/33` and shared `79/75/72/57` floors are still computed over the
subset of files a test happened to import. Untested modules are invisible to the gate, and the
figures are not comparable with the frontend's whole-tree basis. This is the same defect the
frontend review called a "basis correction", left unfixed in the other two packages.

**Fixed:** both configs now declare `coverage.include: ["src/**/*.{ts,tsx}"]` (with their existing
exclusions) and floors re-based on the measured whole-tree values:

| Package | Measured 2026-10-30 (stmts / branches / funcs / lines) | New floors (lines / stmts / funcs / branches) |
| --- | --- | --- |
| Backend (4 shards merged) | 43.06 / 33.96 / 41.41 / 45.19 | 44 / 42 / 40 / 32 |
| `@mms/shared` | 74.96 / 56.17 / 71.89 / 78.24 | 77 / 74 / 71 / 55 |

The drop is ~1 point per metric, not the frontend's 14 — backend and shared tests already loaded
almost every module, so this is a basis correction rather than a coverage change. The rule snapshot in
`.cursor/rules/mms-testing-observability.mdc` and all four mirrors were regenerated with
`sync-all.sh`; `verify-rules-integrity.mjs` (including its "coverage floors match the rule snapshot"
check) passes, and both coverage gates were re-run green under the new floors.

#### P-03 — Minor — CI-built source maps are shipped and publicly served

**Where:** [`vite.config.ts:111`](../apps/frontend/vite.config.ts#L111) emits `hidden` source maps
whenever `CI=true`; [`package-dist.sh:7`](../scripts/ci/package-dist.sh#L7) tars the whole
`apps/frontend/dist`; [`frontendSpa.ts:27`](../apps/backend/src/plugins/frontendSpa.ts#L27) serves
that tree at `/` with no extension filter.

**Evidence:** a `CI=true` local build wrote **590 `*.map` files** under `dist/assets`. No workflow or
script uploads them to Sentry or deletes them, despite the config comment describing them as "safe to
upload to Sentry without exposing them publicly". Because hidden maps are not referenced by the
bundle but keep the chunk filename, `/assets/<chunk>.js.map` is discoverable from the public chunk
list.

**Impact:** full frontend source (unminified code, comments, internal module structure) is
downloadable in production. No credentials are exposed, hence Minor, but it contradicts the stated
intent and the repository's proprietary posture.

**Fixed:** `package-dist.sh` now tars with `--exclude='*.map'` and fails the build if
`tar tzf | grep '\.map$'` finds one. Verified against the 590 maps left by a `CI=true` build: zero
maps in the tarball, normal assets present. Maps stay on disk (so a future Sentry upload can use
them) but never reach the server.

#### P-04 — Minor — Initial admin password generated with `Math.random()`

**Where:** [`create-tenant-admin.ts:14`](../apps/backend/src/scripts/create-tenant-admin.ts#L14) chooses
the generated password with `Math.random()`; the same file already imports `randomBytes` for the user
id.

**Impact:** an operator relying on the generated password gets a non-cryptographic value from a
predictable PRNG. Script-only path, so Minor, but trivially avoidable. **Fixed:** the generator now
uses `randomInt` from `node:crypto`.

#### P-05 — Minor — E2E seed helpers interpolate values into shell commands

**Where:** [`tenantOperations.ts:386`](../e2e/helpers/tenantOperations.ts#L386) (and L420, L449, L477)
build `execSync` command strings from a template that includes `subdomain`, and fall back to a
hardcoded `JWT_SECRET` when the env var is missing.

**Impact:** test-only, and current call sites pass constants, so there is no live injection path — but
a future spec that passes a generated name would execute shell metacharacters. **Fixed:** every
`execSync` in `e2e/helpers/` is now `execFileSync` with an argv array (`runBackendSeedScript` for the
seven seed scripts, `process.execPath` for the temp seeder, argv for the platform reset); the
`JWT_SECRET` fallback is centralized in one helper.

#### P-06 — Minor (advisory) — OTP and email are logged in non-production

**Where:** [`tenantPasswordOtpDispatch.ts:178`](../apps/backend/src/services/auth/tenantPasswordOtpDispatch.ts#L178)
logs `{ email, code }` when `NODE_ENV !== "production"` and neither channel delivered.

**Impact:** deliberate dev convenience, but any non-production deployment (staging keeps
`NODE_ENV=development`) writes password-reset OTPs into logs. **Fixed:** the echo now requires
`MMS_DEBUG_OTP=1` (and still never runs in production); a unit test covers flag-off, flag-on, and
production.

#### Reviewed, no action

- Two mutation contracts type their bodies as `z.unknown()` (`students.contract.routes.ts:177`,
  `enrollments.contract.ts:188`). Runtime validation exists: the GR-migration handler ignores the
  body, and field-config bodies are parsed with the per-module `*FieldConfigPutBodySchema` before
  persistence. Type-contract drift only.
- `.passthrough()` on module setup-preference schemas is the documented forward-compatibility choice
  (unknown keys survive future field additions); not widened here.
- The single `dangerouslySetInnerHTML` ([`ErdMermaidDiagram.tsx:184`](../apps/frontend/src/platform/components/erd/ErdMermaidDiagram.tsx#L184))
  renders Mermaid output with `securityLevel: "strict"` from schema-derived ERD source.
- Sampled `catch {}` blocks are deliberate best-effort paths (faculty sequence sync, JSON citation
  parsing). One handler returns a generic 500 without logging
  ([`studentOperationRoutes.ts:196`](../apps/backend/src/routes/tenant/students/studentOperationRoutes.ts#L200)),
  which is consistent with the error envelope but weakens triage.

### 3.3 Residual register re-confirmed

Still open and accurately described in [`open-items.md`](./open-items.md):

- **Production RLS** runs with `MMS_DB_ROLE_ENFORCEMENT=warn` + `MMS_ALLOW_RLS_WARN=1`. The repo
  default is `strict` and the deploy policy fails closed
  ([`rls-deploy-policy.mjs`](../scripts/ci/rls-deploy-policy.mjs#L21)), so this is an environment
  decision, not a code defect — but until the operator provisions `mms_app` and flips the variable,
  tenant isolation in production is not enforced by RLS. **Highest residual risk.**
- Snapshot chain stops at `0133`; 144 live timezone-naive timestamp columns (311 declarations across
  migration history); 143 historical migrations without `lock_timeout` (immutable, forward-only).
- i18n dead keys: 517 (ratcheted against 518).
- Legacy client store: 94 non-test `localStorage` references in 42 files — no new non-test call site
  landed since 10-29; the additions in the delta are test setup and comments.
- Deferred by the 10-30 frontend review and unchanged: widget-toggle full-record PUT, shared-contract
  chunking/`modulePreload`, service-worker update UX, `useGlobalSettings` fan-out, dead-code deletion,
  288 loose assertions, WS half-open heartbeat, template-editor save UX.
- E2E keeps three conditional `test.skip`s (platform admin management, platform console critical,
  contacts import/export).

## 4. Architecture & security assessment

What this pass found strong, with the evidence that makes it strong:

- **Gates are real, not decorative.** 21 blocking gates plus `check-ratchet-baselines` (which rejects a
  baseline raised to exactly the new violation count, not just a stale one), path-aware local CI that
  escalates to full on tooling changes, a `changes`-job failure check, and a gate policy that fails a
  ready PR whose matched DB/E2E/RLS job was skipped.
- **Module access is fail-closed at three layers.** `registerModuleAccess` stamps every route in its
  scope and `moduleAccessGuard` denies a route whose config is missing; the coverage test enumerates
  every registered route and requires amending an explicit allowlist (with exact paths) for non-module
  routes, so a broad prefix cannot hide a new endpoint.
- **Auth/session:** HttpOnly session cookie, readable double-submit CSRF token by design, `SameSite=Lax`,
  `Secure` from config, per-request authoritative role lookup, revocation checks, tenant-scoped 2FA
  challenges, and a dynamic revocation TTL.
- **CSP is genuinely strict** — nonce-only `script-src`, `script-src-attr 'none'`, `object-src 'none'`,
  `frame-ancestors 'none'`, restricted `connect-src`. It is strict enough to have broken the app's own
  print flow (P-01), which is itself evidence the policy is not ceremonial.
- **Outbound traffic** goes through `fetchSafeExternal`/`fetchWithTimeout` with private-range and
  DNS-rebinding rejection plus a 15 s timeout; the FX worker uses the same timeout model.
- **Uploads** are authenticated, tenant-matched, AVIF/WebP only, and served `private, no-store`; dotfiles
  are denied.
- **Money/ledger** mutations are transaction-bound with row locks, and the audit chain is
  transaction-bound, shard-locked, and timestamp-clamped.
- **Changed-file coverage** is enforced in CI for both frontend and backend
  (`check-changed-coverage.mjs`), closing the "PR adds untested source to a changed-scope run" hole.

## 5. Adversarial vectors evaluated

- **Edge cases & payload integrity:** ISO date validation is in place for sessions/classes; `z.unknown()`
  bodies are validated or ignored handler-side (see §3.2); money remains decimal-string end to end.
  No new boundary defect found in the delta.
- **Failure modes & silent failures:** P-01 *was* a silent failure — a blocked inline script with no
  user-visible error; the fix removes the script entirely and adds a change-time ratchet. Sampled
  `catch {}` blocks are intentional fallbacks; the one unlogged generic 500 is noted but not escalated.
- **Security, authorization & multi-tenancy:** no new route was added in the delta; the route
  enumeration and allowlist tests pass; no raw `fetch("/api…")`, `eval`, `document.write` with
  unescaped tenant data, or new `dangerouslySetInnerHTML` was introduced. The one disclosure is P-03
  (source maps).
- **Concurrency & resource management:** no new mutation path in the delta. Existing ledger
  row-locks, fiscal-year advisory lock, audit shard lock, and worker shutdown budget were re-read and
  remain in place.

## 6. Recommendations — status

1. **P-01 — DONE.** Inline scripts removed; printing is opener-driven through `autoPrintWindow`, with
   unit ratchets on both builders.
2. **P-02 — DONE.** Backend and shared switched to the whole-tree basis, re-measured via four shards +
   merge (backend) and a direct coverage run (shared), floors re-based and rule mirrors resynced.
3. **P-03 — DONE.** `package-dist.sh` excludes maps and self-checks the tarball.
4. **P-04, P-05, P-06 — DONE.** `randomInt`, `execFileSync` argv everywhere in `e2e/helpers/`, and the
   `MMS_DEBUG_OTP` opt-in.
5. **Operator action, not code:** provision `mms_app`, run `db:check-rls`, set
   `MMS_DB_ROLE_ENFORCEMENT=strict`, remove `MMS_ALLOW_RLS_WARN`. This remains the largest gap between
   the repository's security model and its production reality.
6. Keep burning down the residual register; none of those items regressed in this pass.

## 7. What this review could not verify

- **Database integration and RLS suites** (`test:db`, `test:rls`) — require a disposable Postgres.
- **Full Playwright suite**, including the a11y project — requires seeded servers and a database. The
  prior review's 16/16 a11y result was not reproduced; no UI change landed in the delta beyond the
  e2e-only commit.
- **Coverage percentages** were re-measured for the two re-based packages only (backend via the CI
  4-shard + merge procedure, shared via a direct run); the frontend's whole-tree percentage was not
  re-measured because no frontend source coverage change landed.
- **Production environment variables** (RLS mode, `MMS_ALLOW_RLS_WARN`) — not readable from the repo;
  the residual register's claim is taken as accurate.
- **Deploy execution, rollback, Apache/PM2 topology, live CWV** — out of scope for a local review.
- **Visual/RTL rendering** — findings rely on code and tests, not screenshots; the 10-30 UI/UX
  screenshot review remains the visual source of record.

---

## Appendix — commands run

```bash
git rev-parse HEAD && git status --porcelain && git rev-list --left-right --count origin/main...HEAD
bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh          # 21/21 gates + advisory TDD
pnpm --filter mms-backend test                                       # 2,235 tests
pnpm --filter mms-frontend test                                      # 3,757 passed, 2 skipped
pnpm --filter @mms/shared test                                       # 1,744 tests
pnpm exec turbo run build --force && pnpm run check:bundle && pnpm run check:pwa
pnpm audit
node scripts/check-code-norms.mjs --json
pnpm run check:i18n-unused
cd apps/frontend && node -r ../../scripts/eslint-ts-compat.cjs \
  node_modules/eslint/bin/eslint.js . --no-cache -f json             # warning census
cd apps/frontend && CI=true pnpm exec vite build                     # 590 *.map in dist/assets
node -e '…Playwright CSP about:blank experiment…'                    # P-01 reproduction

# Resolution pass (fixes)
pnpm --filter mms-frontend exec vitest run <print-pipeline specs>
pnpm --filter mms-backend exec vitest run src/__tests__/tenantPasswordOtpDispatch.test.ts
bash .agent/scripts/sync-all.sh && node scripts/verify-rules-integrity.mjs
# backend whole-tree coverage: 4 shards + merge (thresholds zeroed per shard)
for i in 1 2 3 4; do pnpm --filter mms-backend exec vitest run --shard=$i/4 --coverage \
  --coverage.include='src/**/*.{ts,tsx}' --coverage.thresholds.*=0 \
  --reporter=blob --outputFile=.vitest-reports/blob-$i.json; done
pnpm --filter mms-backend exec vitest run --merge-reports=.vitest-reports --coverage
pnpm --filter @mms/shared test:coverage
bash scripts/ci/package-dist.sh && tar tzf mms-dist.tar.gz | grep -c '\.map$'
```

Read-only inspection covered: the three `vitest.config.ts` files, `vite.config.ts`,
`scripts/ci/{local-ci,check-ratchet-baselines,check-changed-coverage,ci-gate-policy,rls-deploy-policy}.mjs`,
`.github/workflows/ci.yml`, deploy scripts, `staticAssets`/`frontendSpa`, auth middleware and session
routes, module-access policy/guard/tests, print helpers and their consumers, e2e specs/helpers,
schema/migration metadata, and the residual register.
