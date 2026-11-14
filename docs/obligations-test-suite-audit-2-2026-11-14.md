# Obligations Test Suite — Second Pass (Route Injection & Catalogue Concurrency)

Follow-up to [obligations-test-suite-audit-2026-11-14.md](./obligations-test-suite-audit-2026-11-14.md), covering the same brief. The first pass added the concurrency, cross-tenant and cascade suites and fixed the cascade data-loss path; this pass closes the route-injection gap it could not see and adds the catalogue race.

**Status: audited and closed.** 9 of 20 contract paths had no HTTP test; they now all do, and a CI ratchet keeps it that way.

---

## 1. Re-verification of the first pass

| Artefact | State |
|---|---|
| `db-integration/obligationsConcurrencyDb` (4) | present, green |
| `obligationsCrossTenant.integration` (6) | present, green |
| `db-integration/obligationsCascadeDb` (8) | present, green |
| Cascade guard fix (receipts counted, type replace guarded) | present |
| `docs/obligations-test-matrix.md` + `check:obligations-tests` | present, 30 scenarios before this pass |

---

## 2. Findings

| # | Sev | Finding | Status |
|---|---|---|---|
| **G1** | **HIGH** | **9 of the 20 obligations contract paths had no injection test**: `/types`, `/mujtahids`, `/distributions`, `/reps`, `/wakala` (lists), `/types/bulk`, `/mujtahids/bulk`, `/wakala/bulk`, `/distributions/bulk` (catalogue writes) and `/preferences` (the only route gated on `settings.global.write`). Measured with the accounting ratchet's own matcher. | **Fixed** — 20/20 |
| **G2** | HIGH | **No route-injection ratchet for the module** — accounting and examinations both have one, which is how G1 accumulated unnoticed by a name-based matrix. | **Fixed** — `check:obligations-route-injection` |
| **G3** | MEDIUM | **No catalogue concurrency test.** The receipt race is proven; the wakala aggregate (delete-and-reinsert in one transaction) had only a happy path. | **Fixed** — 3 DB tests |
| **G4** | MEDIUM | **No DB-level proof that archive reverses / restore reposts the journal.** Only mocked unit tests pin the calls; the entries are never asserted. | Deferred (D1) — needs a full posting fixture |
| **G5** | — | Concurrency, cross-tenant, cascade, audit atomicity, RLS, split remainder, blueprint, dates, single-record save | Covered (first pass) |

---

## 3. What was applied

### 3.1 `obligationsCatalogRoutes.integration.test.ts` (25 tests)

Same harness as the cross-tenant suite (mocked workspace/module access + recording use cases):

| Route family | Assertions |
|---|---|
| `GET /types`, `/mujtahids`, `/distributions` (contract handler), `GET /reps`, `/wakala` (generic branch) | 200 for a reader, the loader observes **the caller's workspace**; a role with no obligations grant gets **403** and no loader runs |
| `PUT /types/bulk`, `/mujtahids/bulk`, `/wakala/bulk`, `/distributions/bulk` | writer 200 + tenant captured; read-only **403** before the save; malformed body **400** before the save |
| `GET /preferences` | reader 200 |
| `PUT /preferences` | **403 for `obligations.write`** without `settings.global.write` (accountant), 200 for admin |

The admin path caught a live detail: the update response is **contract-validated** (enabled in an earlier audit), so the test returns the normalized preferences shape rather than `{}` — which is exactly what the runtime does.

### 3.2 `db-integration/obligationsCatalogueConcurrencyDb.integration.test.ts` (3)

Two simultaneous `replaceWakalaAggregateForWorkspace` calls: the committed catalogue is entirely one caller's set (never a mixture), every rule points at a wakala that exists (no orphans), and a replace that fails validation leaves the previous set intact.

### 3.3 `scripts/ci/check-obligations-route-injection.mjs`

Contract paths from `packages/shared/src/contracts/obligations*.ts` vs `/api/obligations…` literals in the backend tests, `:param` segments matched as wildcards. **No baseline file**: the module starts at 20/20, so a new route without a test fails immediately. Wired as `check:obligations-route-injection` in `package.json`, `scripts/ci/local-ci.sh` and the CI workflow.

### 3.4 Matrix growth

`docs/obligations-test-matrix.md` + `scripts/check-obligations-test-matrix.mjs`: **30 → 37** pinned scenarios, adding the catalogue read/write RBAC, the preferences privilege, the mixed-set and rollback invariants.

---

## 4. Verification

| Command | Result |
| --- | --- |
| `obligationsCatalogRoutes.integration` | **25** tests |
| `vitest.db.config` — catalogue concurrency | **3** tests |
| `pnpm run check:obligations-route-injection` | **20/20** paths covered (was 11/20) |
| `pnpm run check:obligations-tests` | **37** required scenarios |
| backend obligations units + API | 107 + 25 |
| `check:code-norms` · `check:docs` · `check:i18n` · prettier | held |

## 5. Deferred

| ID | Item |
|---|---|
| **D1** | **Ledger-lifecycle DB test** (G4): post → archive reverses → restore reposts, asserting `accounting_entries` and a balanced trial. Needs a posting fixture (chart of accounts, posting rules, fiscal year, posting period); `accountingAuditAtomicityDb` shows the shape, which is why it is its own task. |
| **D2** | Obligations E2E spec (`e2e/tests/tenant/obligations.spec.ts`): create, archive/restore, and a read-only role has no delete action. Needs the Playwright stack, not runnable in this session. |
| **D3** | Allocation/waiver concurrency stays in Finance (`financePaymentConcurrencyDb`), which already races both writers. |

## 6. Assumptions

1. The accounting matcher semantics fit obligations: a path is covered when a test source contains a matching URL literal (params as wildcards).
2. Shipping no baseline is deliberate — 20 paths is small enough to cover rather than tolerate.
3. `PUT /preferences` is the module's only `settings.global.write` route; every other route uses `obligations.read|write|delete` (verified in the contract router).
4. The catalogue aggregate replace is atomic, so the committed state after a race is one writer's set — the mixed-set assertion would fail the moment it stopped being transactional.
