# MMS Project Review — 2026-10-29

Read-only review of the whole repository at `main` (`3aedc509e`), followed by two targeted
security fixes. This is a point-in-time review: it complements
[`open-items.md`](./open-items.md) (the running debt register) and the
[2026-10-28 review](./open-items.md#2026-10-28-project-review--fixed-vs-still-open).

**Verdict: healthy, unusually well-gated codebase.** All 19 pre-PR gates pass, all 7,457 unit
tests pass, the app builds inside its bundle budget, and the security architecture (tenant
isolation, CSRF, CSP, SSRF, uploads, module gates) is deliberate and tested. Two stored-XSS
vectors were found and fixed in this pass; the remaining findings are managed debt, not defects.

---

## 1. Snapshot

| Item | Value |
| --- | --- |
| Branch / HEAD | `main` · `3aedc509e` (clean tree at review start) |
| Source size | 6,471 `.ts`/`.tsx` files · backend 196,817 LOC · frontend 365,104 · shared 131,900 · e2e 5,339 |
| Stack | React 19 / Vite 8 / TanStack Query v5 · Fastify 5 / Node 24 · PostgreSQL 16 + Drizzle · Redis 7 + BullMQ |
| Migrations | 197 forward-only SQL migrations (`apps/backend/src/db/migrations_drizzle`) |
| Tests | 288 backend files (2,098 tests) · 1,015 frontend files (3,639 tests, 2 skipped) · 232 shared files (1,720 tests) |
| CI | 14 jobs incl. dependency review, gitleaks, sensitive-file guard, sharded unit/DB/coverage, nightly full E2E |

## 2. Verification evidence

Run on 2026-10-29 against the local workspace; exact commands in the appendix.

| Check | Result |
| --- | --- |
| `pre-pr-review.sh` (full scope, 19 gates) | **19/19 pass** — rules/skills integrity, i18n parity + unused keys, shared purity/structure, faculty legacy surface, migration index/hygiene/forward-only, work-directory, frontend structure, shared UI, docs, DB projections, backend boundaries/structure, code norms, typecheck, ESLint |
| Backend unit suite | 288/288 files · 2,098/2,098 tests pass |
| Frontend unit suite | 1,015/1,015 files · 3,639 passed, 2 skipped |
| Shared unit suite | 232/232 files · 1,720/1,720 tests pass |
| Backend module-access coverage | `moduleAccessCoverage.test.ts` passes (1 test enumerates every registered route) |
| Frontend route-access | `routeAccess.test.ts` 11/11 pass (unknown app paths fail closed) |
| Prior-review regression tests | `tenantScopeGuards` 17/17 · `uploadsAuth` 10/10 pass |
| Build | `pnpm build` — 3/3 packages |
| Bundle budget | 14.65 MB raw / 4.17 MB gzip (budgets 15 MB / 4.5 MB) · largest chunk 1.40 MB `elk` (budget 2.5 MB) |
| Dependency audit | 0 high / 0 critical · 1 moderate + 1 low, both reviewed exceptions (details §3.3) |
| Coverage gates | backend 46 / 43.5 / 41 / 33 (measured 46.8 / 44.46 / 42.1 / 33.91) · frontend 56 / 55 / 46 / 51 (56.63 / 55.31 / 46.54 / 51.49) · shared 79 / 75 / 72 / 57 (80.25 / 76.86 / 73.23 / 58.63) |
| A11y Playwright project | 16/16 pass — all 20 tenant routes at 375/1440, RTL, populated data, overlay audits |
| Frontend static lint (`--no-cache`) | 0 errors · 150 warnings (82 `react-hooks` — none `set-state-in-effect`, 68 `jsx-a11y`) |

**Note on test execution.** The suites were run package-by-package. An earlier attempt to run
the backend suite while another vitest process was already running against `apps/backend` failed
4 suites at import with `Cannot find module …/.vite/…/@mms_shared.js` — the two processes share the
package's Vite dependency cache. All four suites pass standalone and the full suite passes on a
clean cache, so this is a local-execution artifact, not a repository defect (and a reason to run
package suites sequentially when debugging).

## 3. Findings

### 3.1 FIXED — Stored DOM XSS via unescaped print-window titles (High)

**Where:** [`printHtmlDocument.ts`](../apps/frontend/src/lib/ui/printHtmlDocument.ts) (line 18) and
[`printWindowHtml.ts`](../apps/frontend/src/lib/printWindowHtml.ts) (line 33).

Both helpers interpolated `title`/`windowTitle` directly into `<title>${title}</title>` inside a
`document.write` document. Titles are built from tenant data:

| Print flow | Title source |
| --- | --- |
| Certificate preview | `t("examinations.certificatePreview.windowTitle", { name: result.student?.name })` — student name |
| Accounting voucher | `t("…voucher.windowTitle", { title, ref: entry.ref })` — journal entry reference (`ref: z.string()` in `accountingModuleManifest`) |
| Obligation receipt | `t("obligations.print.windowTitle", { number: collection.receipt_no })` — receipt number |

A value such as `</title><script>…</script>` closes the title element and executes in the print
popup. The popup is `about:blank` opened from the app, so it inherits the app origin: script can
read the non-HttpOnly `csrf_token` cookie and call the authenticated API as the victim (the JWT
itself is HttpOnly). In practice a user with write access to a journal/obligation/student record
can execute script in an administrator's session when that administrator prints the record —
a privilege-escalation path, not just self-XSS. The same class was already solved correctly in
[`paperBuilderUtils.ts`](../apps/frontend/src/tenant/features/question-bank/lib/paperBuilderUtils.ts)
(`escapeHtml(title)`), so this was an inconsistency rather than a missing capability.

**Fix:** both helpers now run the title through
[`escapeHtml`](../apps/frontend/src/lib/escapeHtml.ts) before interpolation. New tests:
[`printHtmlDocument.test.ts`](../apps/frontend/src/lib/ui/printHtmlDocument.test.ts) and
[`printWindowHtml.test.ts`](../apps/frontend/src/lib/printWindowHtml.test.ts) (4 tests, pass).

### 3.2 FIXED — Executable URL schemes accepted for social links (High)

**Where:** [`socialPlatformUtils.ts`](../packages/shared/src/messaging/socialPlatformUtils.ts) (the new scheme guard, line 34).

`formatSocialPlatformUrl` passed through `http(s)`, `mailto` and `tel` untouched, but for an
unknown platform fell back to returning the raw input. Callers use the result directly as a link
target:

- [`contactMetadataCollections.tsx`](../apps/frontend/src/tenant/features/contacts/components/contactMetadataCollections.tsx) renders `<a href={formatSocialPlatformUrl(...)} target="_blank">`.
- [`ContactDetailSocialsSection.tsx`](../apps/frontend/src/tenant/features/contacts/components/detail/ContactDetailSocialsSection.tsx) passes it to `window.open(row.href, "_blank", "noopener,noreferrer")`.

A stored social URL of `javascript:alert(document.domain)` or `data:text/html,<script>…` therefore
became a clickable script target in the app origin — another tenant-user → tenant-admin escalation
path. (`ContactLinkAction` already prefixed `https://`, so the two surfaces disagreed.)

**Fix:** the formatter now rejects any explicit scheme outside `http(s)`/`mailto`/`tel`, returning
`""` so callers fall back to a non-link badge. Case-insensitive URLs such as `HTTPS://…` are
preserved. Tests added in
[`socialPlatformUtils.test.ts`](../packages/shared/src/messaging/socialPlatformUtils.test.ts)
(4 new cases; 11/11 pass).

### 3.3 FIXED — Dependency advisories: 12 findings → 2 (one reviewed, one unpatchable)

`pnpm audit` reported 7 moderate / 5 low and **no high or critical** issues. All
patchable findings were resolved in the follow-up dependency pass:

| Package | Before → after | How |
| --- | --- | --- |
| `nodemailer` | 10.1.2 → 10.2.1 | direct dependency bump |
| `fast-uri` | 4.2.0 → 4.2.3 | `overrides` `^4.2.3` |
| `ip-address` | 10.7.3 → 10.7.5 | `overrides` `>=10.7.4` |
| `serialize-javascript` | 7.1.1 → 7.1.4 | `overrides` `>=7.1.2` (build tooling) |
| `deepmerge` | 4.3.1 | **no patched release exists** — the advisory names `>=4.3.2`, which was never published (4.3.1 is the latest 4.x). Dev-only workbox path; recorded as a reviewed exception. |

`ts-deepmerge@6` remains the other reviewed exception: the advisory is not
reachable here and the `>=8` override breaks `/api/openapi.json` (both documented
in `pnpm-workspace.yaml`). Current audit: **1 moderate + 1 low, 0 high/critical**.
The backend suite (2,098 tests) passes on the new graph.

### 3.4 FIXED — Coverage floors raised to the measured floor (ratcheted)

Thresholds are global and enforced (`apps/backend/vitest.config.ts:57`,
`apps/frontend/vitest.config.ts:114`, `packages/shared/vitest.config.ts:24`). Measured on
2026-10-29 and now the floors (each ~1 point below the measurement):

| Package | Thresholds (lines / stmts / funcs / branches) | Measured |
| --- | --- | --- |
| backend | 46 / 43.5 / 41 / 33 | 46.8 / 44.46 / 42.1 / 33.91 |
| frontend | 56 / 55 / 46 / 51 | 56.63 / 55.31 / 46.54 / 51.49 |
| shared | 79 / 75 / 72 / 57 | 80.25 / 76.86 / 73.23 / 58.63 |

The money/fx suite gained edge cases (`divideRounded` ties and negatives, malformed and
over-precision amounts, zero/three/four-decimal currencies, allocation errors, rate validation,
same-currency preview). Backend coverage was reproduced with the CI procedure (four shards +
merged report); a single-process coverage run segfaults on this machine's Node 26, while CI runs
Node 24. Floors only rise from here — never lower one to unblock a change.

### 3.5 FIXED — A11y sweep now covers all 20 tenant routes

Correction to the original finding: the gate already audited **6** routes (dashboard, contacts,
students, finance, accounting, settings), not three. It now audits **all 20** `TENANT_PATHS` at
375/1440 px, split into four route groups so the two CI shards stay balanced, plus the existing
RTL pass, populated-data specs and dialog/drawer overlay audits on seven desktop Work routes.
The extension found and fixed two serious violations (Hasanat progress-bar accessible name;
Profile avatar-change label/visible-text mismatch) — see
[`a11y-baseline.md`](./a11y-baseline.md). The baseline remains empty; the 68 static `jsx-a11y`
warnings stay triaged in ADR-017.

### 3.6 FIXED — `set-state-in-effect` burned down; rule promoted to `error`

All 106 flagged sites in 97 files were removed without changing behaviour: state is
derived during render, lazily initialised, or reset with React's documented
render-phase adjustment, and one-shot actions moved into the event that causes them.
A single documented disable remains (`useIdleTimer`, whose deadline lives in refs and
is re-synced synchronously). `react-hooks/set-state-in-effect` is now `error`, so the
backlog cannot regrow; the other compiler rules stay advisory (82 findings: `refs` 45,
`incompatible-library` 13, `immutability` 11, plus small buckets). The compiler remains
opt-in (`MMS_REACT_COMPILER=1`, +12.8% raw bundle). The refactor also surfaced and fixed
a pre-existing render loop in `useRolesPermissionsController` (its effect depended on
the per-render `useWorkspaceRoles()` array). Total frontend lint warnings: 256 → 150.

### 3.7 OPEN — Legacy localStorage client store (Low/Medium, documented)

90 non-test `localStorage` references remain, concentrated in the documented
[`@/lib/db` legacy store](./open-items.md#8-legacy-client-state-store-libdb-localstorage--apidb-sync)
(settings/branding drafts, reports/KPI config, backups history). The rule "TanStack Query + REST
first" is enforced by an ESLint ratchet with an empty baseline, so new raw client transport is
blocked — the remainder is blocked on missing object endpoints. Keep the migration item open; do
not treat the count as a defect. Note that this store is one more reason the print-title XSS in
§3.1 mattered (same-origin script could read cached client state).

### 3.8 OPEN — Known data-layer debt (Low, ratcheted)

Already recorded and deliberately left: 311 timezone-naive `timestamp` columns vs 72
`timestamptz`; 143 historical migrations without `lock_timeout` (immutable, forward-only);
Drizzle snapshot chain stops at `0133`; `packages/ui` has no `package.json` (alias-only). Each has
a ratchet or an explicit migration plan in [`open-items.md`](./open-items.md) — no action needed
beyond not letting the counts grow.

## 4. Architecture & security assessment

What the review found strong, with the evidence that makes it strong:

- **Tenant isolation is enforced at the data layer, not just the router.** `withTenant` /
  `runInTransaction` share `resolveTenantScope` and fail closed without an explicit global scope;
  `db/rlsRoleGuard.ts` asserts `current_user` at boot (strict in production). Covered by
  `tenantScopeGuards.test.ts` and `tenantContextGuards.test.ts`.
- **Module access is a three-layer gate** — shared policy (`moduleAccessPolicy.ts`), backend
  `registerModuleAccess` + `MODULE_ROUTE_ACTION_RULES`, frontend `TENANT_APP_ROUTE_ACCESS` — and
  a coverage test enumerates every Fastify route so a new endpoint cannot silently skip the gate.
  Explicitly allowlisted non-module routes must list their exact paths, so a broad prefix cannot
  hide a new one.
- **Auth**: scrypt password hashing with uniform work for unknown accounts
  (`passwordService.ts`), HttpOnly session cookie + double-submit CSRF token, revocation checks
  batched in one Redis round-trip before every tenant request, authoritative role lookup per
  request (`middleware/authenticate.ts`).
- **CSRF**: origin/Referer + `Sec-Fetch-Site` + JSON media-type enforcement, fail-closed for
  cookie-auth mutations with no origin signal (`plugins/csrfOriginGuard.ts`).
- **CSP**: per-request nonce, no `'unsafe-inline'` for scripts, `script-src-attr 'none'`, websocket
  origins restricted to same-origin + explicit `MMS_WS_ORIGINS` (`plugins/security.ts`).
- **SSRF**: outbound URLs validated against private/link-local ranges with DNS-rebinding protection
  and a fetch timeout (`lib/outboundUrl.ts`).
- **WebSocket**: origin + JWT + 2FA + tenant-match + revocation checks on upgrade
  (`routes/common/websocket.ts`).
- **Uploads**: AVIF/WebP only (no SVG), authenticated tenant paths, `private, no-store` for tenant
  files (`config/uploadConfig.ts`, `uploadsAuth.test.ts`).
- **CSV injection**: formula-prefix neutralisation with a numeric exception
  (`packages/shared/src/core/csvUtils.ts`), used by every export service.
- **Money**: integer/BigInt money layer in `packages/shared/src/money`, with invoice settlement
  row-locked (`findInvoiceById(..., { forUpdate: true })`).
- **Audit**: RFC 8785 canonical JSON, sharded hash chains, monthly partitions, retention/purge
  schedulers — plus verification scheduling and anomaly detection services.
- **CI ratchets, not vibes**: wildcard projections, migration index lock safety, 300-LOC ceiling,
  `any`, hex colours, backend route→storage boundaries, docs links, mirror sync, sensitive-file
  guard, gitleaks, and a nightly full E2E workflow for the `@local-only` flows.

## 5. Recommendations — status

1. **§3.1 + §3.2 XSS fixes — DONE** (commits `f39505870`, `9e9f24b1b`/`5e7a00f96`), with regression tests.
2. **Dependency patch — DONE** (§3.3): `nodemailer 10.2.1`, `fast-uri 4.2.3`,
   `ip-address 10.7.5`, `serialize-javascript 7.1.4`; audit now 1 moderate + 1 low,
   both reviewed exceptions. Backend suite re-run green.
3. **Coverage ratchet — DONE** (§3.4): floors raised to ~1 point below measured in
   all three packages; money/fx edge cases added.
4. **A11y sweep extension — DONE** (§3.5): all 20 tenant routes at 375/1440 + RTL +
   populated + 7 overlay surfaces; two violations found and fixed.
5. **`set-state-in-effect` triage — DONE** (§3.6): 106 → 0, rule promoted to `error`,
   one documented disable; total warnings 256 → 150.
6. **LocalStorage migration — deferred, blocked** (§3.7): requires new
   settings/branding/report-config/backups REST endpoints and a product decision. The
   raw-transport ratchet keeps new call sites out meanwhile.
7. **Data-layer debt — no action needed** (§3.8): already ratcheted.

## 6. What this review could not verify

- **Database integration suite** (`pnpm --filter mms-backend test:db`) — needs a disposable
  Postgres; not run here.
- **Full chromium E2E suite** — the `a11y` Playwright project was run locally (16 tests, four
  route groups, RTL, populated + overlays); the mutation-heavy `chromium` specs were not.
- **Full-history secret scan** (`gitleaks detect`) — only the staged-file gate ran.
- **Production deploy** (`deploy.yml`, Apache/PM2 on Hetzner) and live performance/CWV.
- **Runtime behaviour of the print popups in a real browser** — covered by string-level unit
  tests; a Playwright print test was not added.

Coverage figures in §3.4 are measured (backend via the CI 4-shard + merge procedure), not just
configured thresholds. Every claim above is backed by a command that was actually run.

---

## Appendix — commands run

```bash
bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh          # 19/19 gates
pnpm --filter mms-backend test                                       # 2,098 tests
pnpm --filter mms-frontend test                                      # 3,639 tests
pnpm --filter @mms/shared test                                       # 1,720 tests
pnpm --filter mms-backend test src/__tests__/moduleAccessCoverage.test.ts
pnpm --filter mms-frontend test src/lib/config/routeAccess.test.ts
pnpm --filter mms-backend test src/__tests__/tenantScopeGuards.test.ts \
  src/__tests__/uploadsAuth.test.ts
pnpm build && pnpm run check:bundle
pnpm audit
node scripts/check-code-norms.mjs --json
cd apps/frontend && node -r ../../scripts/eslint-ts-compat.cjs \
  node_modules/eslint/bin/eslint.js . --no-cache -f json    # warning census
```
