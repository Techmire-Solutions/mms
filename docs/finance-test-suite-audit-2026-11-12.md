# Finance test suite audit — concurrency, FX/domain, security and CI ratchets

Scope: the Finance/Accounting test suite at all three levels — unit, real-Postgres DB integration and Playwright E2E — with focus on concurrent postings/payments/closes, FX/hedge/IAS 29 edges, RBAC/tenant isolation/audit atomicity, and the CI gates that keep those tests honest.

Method: inventoried every finance/accounting test file, read the named concurrency/counter/FX/hedge/IAS 29/tenant suites, traced the production guards they assert against, and reviewed the CI DB job, manifest/hygiene gates, concurrency-repeat runner and coverage scripts.

---

## 1. Verified baseline (existing coverage)

| Area | Evidence |
|---|---|
| Concurrent journal writes | `accountingConcurrencyDb`: stale draft save after another transaction posts (real advisory-lock wait), same-new-ID conflict, duplicate active ref, dedupe PL/pgSQL |
| Voucher numbering | `accountingVoucherCountersDb`: 8-way distinct allocation, disjoint concurrent ranges, numeric seeding, hand-typed/trashed refs, rollback returns the number (transactional), calendar/fiscal restarts, per-format counters |
| Period locks | `accountingPeriodLockDb`: posting into closed month rejected at app + DB, year-end closing entry exception, reopen, year-save closes periods, tenant scoping |
| FX | `accountingFxDb` (rates precedence, backfill, isolation), `accountingFxRevaluationDb` (revalue/reverse/idempotent + concurrent one-run + precision 422), `accountingFxExchangeabilityDb`, `financeFxDb` (booked rate, cross-currency payment realized FX), `financeGeneratedInvoiceFxDb` (SPOT billing, balanced entry, no double billing) |
| Hedges / IAS 29 | `accountingHedgesDb` (OCI/P&L split, next-day reversal, settlement guard, reclassification, schema, overflow 422, one-per-date), `accountingIas29Db` (math, reversal, chain, schema, account-type 422, one-per-date) |
| Security | `financeRbacRoutes`/`financeRbacCapabilities` (manage gates + capability matrix), `finance.integration`/`accounting.integration` (inject 401/403 on several routes), `financeSecurityDb` (repo-level tenant isolation + journal/credit-note/archive audit rollback) |
| CI | DB job runs all `db-integration` files; manifest pins enrollments/attendance/hasanat/workshops/exams; hygiene bans conditional skips in those modules; concurrency-repeat runner for five modules; coverage gates for four modules |

## 2. Gaps found and closed

### P1 — concurrency

- **G1/G2 — no DB test for concurrent invoice payments or parallel fiscal-year closes.** The production guards exist (`FOR UPDATE` + cents overpayment check; row lock + advisory lock in close) but were only unit-tested.
  *Closed:* new **`financePaymentConcurrencyDb`** — two concurrent payments that fit both commit with exact `paidAmt`, one payment journal each and a balanced ledger; three concurrent payments over the balance give exactly two wins and one 422 with no orphan row/journal/audit. New **`accountingCloseConcurrencyDb`** — two racing closes produce one closed year, one closing entry, one audit row; a posting racing the close either commits and is swept into retained earnings or is rejected with no leftover row, never a half-closed year.
- **G3 — no N-way posting/duplicate reversal test.** *Closed:* `accountingConcurrencyDb` now posts 8 concurrent balanced entries (unique refs, DB-level sum(debit − credit) = 0) and races two reversals of one voucher (exactly one reversal row, one conflict).
- **G4 — no concurrent counter rollback case.** *Closed:* `accountingVoucherCountersDb` races an allocating-then-rolling-back transaction with a committing one and asserts the freed range is reused without ever duplicating a ref.

### P2 — FX/domain edges

- **G6 — generated-invoice FX had no missing-rate path.** *Closed:* `financeGeneratedInvoiceFxDb` removes the USD→PKR SPOT rate, expects generation to fail 422 and persist **zero** invoices for the billing period, then restores the rate for the happy-path tests.
- **G8 — IAS 29 had no missing-price-index case at DB level.** *Closed:* `accountingIas29Db` deletes the January index point, expects preview **and** post to reject with 422 (“price index”), asserts no run row was written, then restores the index for later cases.
- Remaining FX gaps documented below (payment FX partial/archive, hedge missing-rate, revaluation closed-period) stay as explicit follow-ups rather than silently assumed.

### P2 — security and audit

- **G10 — audit atomicity was not tested for payment posting.** *Closed:* `financeSecurityDb` posts a payment whose id cannot fit the audit `record_id`, and asserts the transaction rolls the payment row, the invoice `paidAmt`, the ledger entry and the audit row back together.
- **G11 — finance write-route matrix was incomplete.** *Closed:* new **`financeRoutesRbac.integration.test.ts`** (fastify inject) — unauthenticated 401, teacher/auditor 403 on invoice create, payment create, collect, remind and generate, and the accountant 201 for invoice/payment creation; invoice deletion refused to auditor.
- **G5 — `crossTenantIsolation.integration.test.ts` is users-only.** Finance tenant isolation remains verified at the repository/use-case layer (`financeSecurityDb`) and no route-level cross-tenant suite exists yet; documented as a follow-up (see §4).

## 3. CI ratchets changed

| Gate | Before | After |
|---|---|---|
| `check-db-test-hygiene.mjs` | enrollments/attendance/hasanat only | also **finance/accounting/fiscalYearOverlap**; `requireDatabaseConnection` mandatory |
| Silent skips | `accountingReportDb`, `accountingPersistDb`, `accountingPersistSoftDeleteDb`, `accountingListFiltersDb`, `accountingConcurrencyDb`, `accountingVoucherCountersDb` used `dbAvailable`/env-load + conditional skips | all migrated to `requireDatabaseConnection` (a missing DB fails loudly); zero `dbAvailable` in finance/accounting DB suites |
| `check-db-test-manifest.mjs` | 5 modules, 371 cases | + **30 finance/accounting suites** (401 cases total); deleting/emptying one fails CI |
| Concurrency repeat (`run-concurrency-suite.mjs`) | enrollments/attendance/hasanat/workshops/exams | + accountingConcurrency, accountingVoucherCounters, financeCollectConcurrency, financePaymentConcurrency, accountingCloseConcurrency, accountingFxRevaluation, accountingIas29 (5 runs default) |
| Coverage | sessions/enrollments/attendance/examinations | + **`test:db:coverage:finance`** + `check-finance-coverage.mjs` (measured baseline: statements 50.25%, functions 56.14%, branches 38.59%; floors 48/54/36, only raiseable) |
| CI job | finance suites ran once, no coverage/manifest/hygiene/repeat gate | hygiene + manifest already run, now include finance; new finance coverage + ratchet steps; concurrency step renamed and extended |
| E2E | only accounting roles/sub-tabs | new **`finance-accounting-page-states.spec.ts`**: Finance Work/Reports/Setup and Accounting ledger/reports render (loading/empty states) for a fresh tenant |

## 4. Remaining recommendations (not implemented here)

1. **Route-level cross-tenant suite**: inject tests with a second bootstrapped tenant calling foreign invoice/entry/account ids via HTTP (repository-level isolation is covered; HTTP layer is not). Requires a real-DB app harness or an authenticated two-tenant Playwright API flow.
2. **Payment FX edges**: partial settlement then overpayment rejection, payment archive/restore restoring the invoice in its currency and reversing realized FX; concurrent foreign-currency payments.
3. **Hedge missing-market-rate 422** and zero-valuation settlement; **FX revaluation inside a closed fiscal year** (period lock is covered for journal/invoice paths only).
4. **E2E financial lifecycle** (invoice → payment → paid status → ledger/aging), which needs a finance seeding helper (student/enrollment/fee structure) in `e2e/helpers`.
5. Raise the finance coverage floors once the new concurrency/E2E suites land, and add the finance DB files to the CI shuffle step (currently enrollments-only).

## 5. Evidence

- New suites: `financePaymentConcurrencyDb` (2), `accountingCloseConcurrencyDb` (2).
- Extended: `accountingConcurrencyDb` (6, +2), `accountingVoucherCountersDb` (13, +1), `financeGeneratedInvoiceFxDb` (6, +1), `accountingIas29Db` (9, +1), `financeSecurityDb` (8, +1), new `financeRoutesRbac.integration` (7).
- Ratchets: `check-db-test-hygiene` (49 files), `check-db-test-manifest` (401 cases), finance coverage ratchet held, concurrency runner extended.
- Gates: full DB suite (all `db-integration` files), backend unit, typecheck, and the standard ratchets — see the change summary.
