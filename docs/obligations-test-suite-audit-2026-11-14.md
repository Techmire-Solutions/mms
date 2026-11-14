# Obligations Test-Suite Audit

Evaluation of the module's tests across unit, database-integration and E2E levels, plus the gaps that
were closed and the ratchet that keeps them closed.

**Status: audited, three suites added, one real data-loss defect found and fixed, one CI ratchet added.**

---

## 0. Scope correction

The brief asks about **payment allocation** concurrency, **waiver approval** races, **installment
splitting** and **overdue sweeps**. None exist for obligations — they are Finance concerns
(`financePaymentConcurrencyDb`, `financeCollectTimeZone` already cover them). The brief's
`crossTenantIsolation.integration.test.ts` is real but audits **Accounting only** (0 obligation
references).

---

## 1. Coverage before this pass

| Level | Files | What it pinned |
|---|---|---|
| Shared unit | 71 files repo-wide mention obligations; the module's own live in `packages/shared/src/{obligations,finance,money}` | split largest-remainder, enums/date schemas, import blueprint, posting, allocation |
| Backend API (`inject`) | `obligations.integration.test.ts` (19), `requireTenantModule`, composition, write-path, audit units | RBAC, 400/403/409/500, unknown query keys, import blueprint, single-record save |
| DB integration | `obligationsPersistenceDb` (8), `obligationsAuditAtomicityDb` (2), `financeEnumParityDb` (2) | OCC **sequential** 409, no-resurrection, restore provenance, audit rollback, parity |
| RLS | `obligationsTenantIsolation` (6, `NOBYPASSRLS`) | all 7 tables, explicit-id read, UPDATE/DELETE, FK rejection, policy inventory |
| E2E | `e2e/tests/features/template-editor.spec.ts` | receipt **template** only |

---

## 2. Gap analysis

| # | Sev | Gap | Closed by |
|---|---|---|---|
| **G1** | HIGH | **No concurrency test.** The 409 was proven with a stale token *in sequence* — which passes even if the guard were `>=` or the upsert stopped bumping `version`. | `obligationsConcurrencyDb` (4 tests) |
| **G2** | HIGH | **No route-level cross-tenant test.** Isolation was proven at the DB and in use-case units, but nothing asserted the request's tenant comes from the token/host rather than a payload id. | `obligationsCrossTenant.integration` (6 tests) |
| **G3** | HIGH | **No cascade coverage** — and writing it exposed a **real data-loss path** (below). | `obligationsCascadeDb` (8 tests) + a fix |
| **G4** | MEDIUM | **No test-inventory ratchet.** Examinations has a matrix doc + CI check; obligations had none, which is how drift survived three previous audits. | `docs/obligations-test-matrix.md` + `check:obligations-tests` |
| **G5** | LOW | **No E2E for the work flows** (create, trash/restore, RBAC-gated actions). | deferred (D1) — needs the Playwright stack |
| **G6** | — | Split remainder, audit atomicity, RLS, parity, single-record save, invalidation, conflict UX | already covered |

---

## 3. The defect the cascade test found

`obligation_collections` has three parent edges (verified from `pg_constraint`):

| Constraint | On delete |
|---|---|
| `obligation_collections_sender_fk` | **RESTRICT** |
| `obligation_collections_rep_fk` | **CASCADE** |
| `obligation_collections_obligation_type_fk` | **CASCADE** |

So a catalogue replace that omits a representative or an obligation type **deletes every receipt that
references it**. The application guard was supposed to prevent that, but:

1. `countCatalogueDependents` counted only **wakala types** and **distribution rules** — receipts were
   invisible, so a rep or type with receipts but no wakala reported "0 dependents" and the guard
   waved the delete through;
2. `replaceObligationTypes` was **not wrapped** in `guardedCatalogueReplace` at all;
3. the guard's `CatalogueDependents` type was **re-declared** in `obligationWriteGuards.ts` instead of
   imported from the counter — the duplication that let the shapes drift.

Fixed:

- `CatalogueDependents.receipts` counts posted receipts for the `representative`, `obligationType` and
  `mujtahid` kinds (via its reps), matched on the FK columns.
- `assertNoCascadingLoss` refuses when `receipts > 0` and reports the count in the 409 details.
- `replaceObligationTypes` now goes through the guarded replace (kind `obligationType`), so a
  shortened types list answers `409 catalogue_in_use` instead of destroying receipts.
- The duplicated type is gone: the domain guard imports the counter's type and re-exports it.

---

## 4. What was added

### 4.1 `db-integration/obligationsConcurrencyDb.integration.test.ts` (4)

Real connections, real rows: two same-version saves → exactly one wins, the other `409 stale_write`,
the stored row carries the winner's amount **and** exactly one version bump; a one-behind token leaves
the row untouched; a **row-lock proof** (a second connection blocks on an uncommitted update, then its
guarded `UPDATE` affects 0 rows after the commit); and a race between the single save and the bulk save.

### 4.2 `obligationsCrossTenant.integration.test.ts` (6)

`inject` over `buildApp()`: the collection list is scoped to the token's workspace; another
workspace's receipt id stays inside the caller's scope (the use case receives *the caller's* tenant and
the id unchanged); delete and restore are audited against the caller's tenant; the voucher lookup runs
under the token's workspace; and a token whose workspace disagrees with the request host is rejected
before any handler runs.

### 4.3 `db-integration/obligationsCascadeDb.integration.test.ts` (8)

Archiving the contributing contact keeps the receipt; hard-deleting that contact is refused by the
`RESTRICT` edge; the FK delete-action matrix is pinned (sender `r`, rep/type `c`) so a future migration
to `RESTRICT` is a deliberate, reviewed change; the counter reports the receipt for both a
representative and an obligation type; and the guarded replace refuses both (409) with the receipt
still present.

### 4.4 The ratchet

- `docs/obligations-test-matrix.md` + `scripts/check-obligations-test-matrix.mjs` — 30 required
  scenarios across 13 files; a renamed `it()` or a deleted suite fails.
- `package.json` → `check:obligations-tests`; wired into `scripts/ci/local-ci.sh` and the
  `.github/workflows/ci.yml` step next to the examinations matrix.

---

## 5. Verification

| Command | Result |
| --- | --- |
| `vitest.db.config` — the four obligations DB suites | **22 tests** (persistence 8, concurrency 4, cascade 8, audit-atomicity 2) |
| `vitest.rls.config` — `obligationsTenantIsolation` | 6 (unchanged, re-run in earlier passes) |
| backend obligations units + API | **107** tests / 13 files |
| `pnpm run check:obligations-tests` | 30 scenarios present |
| `check:code-norms` · `check:backend-structure` · `check-docs` · `check:i18n` | held |

## 6. Recommendations (partly deferred)

| ID | Item |
|---|---|
| **D1** | `e2e/tests/tenant/obligations.spec.ts`: create a receipt, archive/restore, and prove a read-only role has no delete action. Not runnable here (needs the Playwright stack). |
| **D2** | `check:obligations-route-injection`: assert every `/api/obligations/*` route is registered and covered by an injection test — the accounting/examinations precedent. |
| **D3** | Catalogue concurrency: two sessions replacing wakala+distributions simultaneously (the aggregate write is guarded, but not raced in a test). |
| **D4** | Payment-allocation and waiver races belong to Finance, which already covers them. |

## 7. Assumptions

1. `beginLongLivedTenantTransaction` hands out a dedicated pool client, so two transactions genuinely
   race — verified in `dbTransactions.ts` and borne out by the row-lock test.
2. The route-level cross-tenant suite mocks workspace/module access exactly as the existing obligations
   injection suite does; the DB boundary is separately proven by the RLS suite.
3. Pinning `it()` names (not line numbers) is the intended ratchet mechanism, following the
   examinations precedent.
4. The receipt-cascade count matches receipt rows only; wakala/rule dependents keep their existing
   counts, so the guard's other messages are unchanged.
