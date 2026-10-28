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
| Dependency audit | 0 high / 0 critical · 7 moderate / 5 low (details §3.3) |
| Frontend static lint (`--no-cache`) | 0 errors · 256 warnings (188 `react-hooks`, 68 `jsx-a11y`) |

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

### 3.3 OPEN — Dependency advisories: 7 moderate / 5 low (Medium)

`pnpm audit` reports **no high or critical** issues. All are patch-level fixes:

| Package | Severity | Installed → patched | Path |
| --- | --- | --- | --- |
| `nodemailer` | moderate ×3 | 10.1.2 → ≥10.1.4 | direct (email delivery) |
| `fast-uri` | moderate ×2, low ×2 | 4.2.0 → ≥4.2.3 | `fastify` → `ajv` / `fast-json-stringify` |
| `ip-address` | moderate | 10.7.3 → ≥10.7.4 | `@fastify/rate-limit` |
| `ts-deepmerge` | moderate | → ≥8.0.0 | dev: `@ts-rest/open-api` |
| `serialize-javascript` | low ×2 | → ≥7.1.2 | dev: `vite-plugin-pwa` → `workbox-build` |
| `deepmerge` | low | → ≥4.3.2 | dev: `vite-plugin-pwa` → `workbox-build` |

No high/critical advisories and CI runs `dependency-review` on every PR plus `pnpm audit
--audit-level high` in `typecheck-lint`, so this is maintenance, not an incident. `nodemailer` is
the only runtime one; bump it (and the two transitive ranges) in a dedicated dependency PR, then
re-run the backend suite and the email tests.

### 3.4 OPEN — Coverage floors are modest relative to the surface (Medium, ratcheted)

Thresholds are global and enforced (`apps/backend/vitest.config.ts:57`, `apps/frontend/vitest.config.ts:114`,
`packages/shared/vitest.config.ts:24`): backend 45 lines / 43.2 statements / 37.5 functions / 27
branches; frontend 55 / 54 / 45 / 50; shared ≈72 / 68. This is honest but low for a finance/tenancy
system: roughly half of backend lines are unexecuted by unit tests. Mitigations already in place
are strong — changed-file coverage gating per PR, a real-Postgres suite for DB-touching paths, and
an accounting test-coverage audit. The recommendation is to ratchet lines +2/quarter starting with
money and authorization modules rather than a big-bang target.

### 3.5 OPEN — Accessibility coverage beyond the axe sweep (Low/Medium)

The executable axe gate (`e2e/tests/a11y/a11y-shell.spec.ts`) covers the shell, Contacts and
Settings at 375/1440 px plus RTL, and fails on any serious/critical violation (baseline is empty).
That is good, but it samples three surfaces out of ~20 modules. Static lint reports 68 `jsx-a11y`
warnings — triaged in ADR-017 as mostly correct interaction patterns — with 0 errors, and the
semantics-only rules (roles, labels, `aria-role`) are already gated at `error`. Consider extending
the axe sweep to one dense Work surface and one modal-heavy surface per release; no baseline entry
should be added to unblock a change (see [`a11y-baseline.md`](./a11y-baseline.md)).

### 3.6 OPEN — React Compiler readiness backlog (Low)

A fresh `--no-cache` lint reports 256 warnings, of which 188 are `react-hooks` compiler-readiness
rules — `set-state-in-effect` (106), `refs` (45), `incompatible-library` (13), `immutability` (11),
plus smaller buckets. The compiler is opt-in (`MMS_REACT_COMPILER=1`) and currently costs +12.8%
raw bundle (documented in [`frontend-performance-baseline.md`](./frontend-performance-baseline.md)),
so leaving it off is the right call. Before flipping it, triage `set-state-in-effect` first: it is
the largest bucket and the one most likely to hide behaviour changes.

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

## 5. Recommendations (in order)

1. **Land §3.1 + §3.2** (already implemented here) and keep the tests — both are one-line
   defences at a rendering boundary where tenant data meets HTML.
2. **Patch dependencies** (§3.3) in a dependency-only PR: `nodemailer ≥10.1.4`, plus overrides for
   `fast-uri ≥4.2.3` and `ip-address ≥10.7.4`; run backend + frontend suites.
3. **Ratchet coverage** on money/authorization modules first (§3.4); raise thresholds only after
   the tests exist, never by lowering the denominator.
4. **Extend the axe sweep** to one Work + one modal surface per release (§3.5); keep the baseline
   empty.
5. **Triage `set-state-in-effect`** (106 sites) before considering the React Compiler default
   (§3.6).
6. **Close the localStorage migration** for settings/reports when the missing endpoints land
   (§3.7); the ESLint baseline stays empty so new raw transport is blocked meanwhile.
7. **Keep the data-layer debt ratcheted** (§3.8) — do not let naive timestamps or snapshot drift
   grow while the planned passes are pending.

## 6. What this review could not verify

- **Database integration suite** (`pnpm --filter mms-backend test:db`) and **E2E/Playwright**
  including the axe gate — both need a running Postgres/Redis and the app stack; not run here.
- **Full-history secret scan** (`gitleaks detect`) — only the staged-file gate ran.
- **Production deploy** (`deploy.yml`, Apache/PM2 on Hetzner) and live performance/CWV.
- **Runtime behaviour of the print popups in a real browser** — the XSS fixes are covered by
  string-level unit tests; a browser-level regression test would need Playwright.

No claim above is based on a check that was not run; the coverage figures in §3.4 are the
configured thresholds (the full coverage run was not re-executed in this pass).

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
