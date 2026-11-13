# Accounting test-suite gap analysis & CI ratchet hardening

Scope: the Accounting module's test estate — concurrency/sequence locking, standards and lifecycle DB
integration, route-level security and tenant isolation, audit atomicity, E2E, and the CI ratchets that
keep all of it honest.

Method: enumerated every accounting suite and case, traced each contract route to an inject test, and
probed the ratchets (manifest/hygiene/concurrency runner/examinations-style trio) for blind spots.

## 1. Verified coverage before this change

| Area | Evidence |
|---|---|
| Posting races | `accountingConcurrencyDb` (6): stale draft save after a post → 422 while the winner holds the advisory lock (asserted through `pg_locks`), same-ID creation serialised, duplicate active refs rejected, dedup PL/pgSQL, concurrent balanced postings (8 writers, distinct refs, zero net), double-reversal race → exactly one reversal |
| Sequence generation | `accountingVoucherCountersDb` (14): 4 concurrent transactions × 2 numbers get disjoint `JE-0001…0008`, numeric seeding past `JE-9999`, hand-typed ref skipping, rollback reuse, per-year/per-fiscal restart, one counter per format, trashed refs never reissued, index-backed allocation probe |
| Close / reopen / FX / IAS 29 | `accountingCloseConcurrencyDb` (2), `accountingPeriodReopenRaceDb` (2), `accountingFxRevaluationDb` (8), `accountingIas29Db` (9) — one-per-date serialisation; the repeated runner replays 13 concurrency files ×5 in `ci:local --with-db` |
| Standards / lifecycle | 28 accounting DB suites (8,075 lines) covering FX (9 + exchangeability 3), hedges (12), IAS 29 (9), reports (10 suites incl. precision and index-plan), ledger controls/period locks/posted-ledger guards/opening balances/CSV import/seed/soft delete |
| Security | `accounting.integration.test.ts` 401/403 cases; exchange-rate, hedge, IAS 29 and contract-route inject suites; DB-level `accountingTenantIsolationDb` (5) and `accountingRlsCoverageDb` (3); static `moduleAccessCoverage`; `accountingAuditAtomicityDb` (8) forced-audit-failure rollbacks for posting/COA/opening/rate/period-close/reversal |
| Ratchets | `check-db-test-hygiene` (58 files, no conditional skips), `check-db-test-manifest` (431 cases), `run-concurrency-suite` (13 files ×5) |

## 2. Gaps found

- **G1 — no deadlock/opposite-order test.** `lockJournalEntries` sorts advisory keys in SQL to avoid a
  `40P01`, but nothing pinned that. → Added a race where two writers save the same entry set in
  opposite order; both must commit with a balanced ledger.
- **G2 — the reopen-vs-close race was not replayed.** `accountingPeriodReopenRaceDb` existed but was
  absent from `run-concurrency-suite.mjs`. → Registered it (now 14 files ×5).
- **G3 — audit atomicity omitted four money mutations.** FX revaluation, IAS 29 restatement, hedge
  valuation and posting-rules save append audit rows but were never forced to fail. → Added rollback
  tests in each owning suite (with the probe extracted to `auditFailureProbe.ts`, reused by the
  audit-atomicity suite).
- **G4 — no HTTP-level cross-tenant probe.** Isolation was only proven at the DB layer; the file named
  in the request (`crossTenantIsolation.integration.test.ts`) did not exist. → Created it: token for
  tenant A on tenant B's host is 403 on every accounting family, unauthenticated is 401, missing
  subdomain is 403, platform/refresh tokens are 401, and no response echoes the other tenant's id.
- **G5 — 12/47 contract paths had no inject test** (entries bulk-delete/restore, setup field-config/
  preferences, FX + IAS 29 previews, hedge valuations/reclassify, opening-balances PUT,
  bank-reconciliations, report PDF, ledger export). → Added inject tests for every one; the injection
  ratchet now reports **0 uncovered paths**.
- **G6 — no behavioural RBAC matrix.** → Added `accountingRouteSecurityMatrix.test.ts` driving
  `accounting-route-security.json` (62 routes: 29 read, 16 write, 8 manage, 5 setupWrite, 4 delete):
  every route answers 401 unauthenticated, and every role the matrix denies gets 403 before any
  handler runs.
- **G7 — the manifest managed only 20 of 28 accounting suites.** → Added the missing eight and a rule
  that an unlisted `accounting*Db.integration.test.ts` fails the gate (now 71 suites / 492 cases).
- **G8 — no accounting parity with the Examinations CI trio.** → Added route-injection,
  route-security and accounting-only coverage ratchets, wired into `pre-pr-review.sh` gates,
  `pnpm run check:…` and the GitHub workflow.
- **G9 — E2E was read-only.** → Added an `@local-only` voucher flow spec: unbalanced voucher is
  blocked in the modal, balanced one posts, and the Trial Balance reflects it.

## 3. New guards (semantics)

| Guard | What it enforces | Current state |
|---|---|---|
| `check:accounting-route-injection` | every accounting contract path appears (as any literal/template) in a backend test | 47 paths, **0 baselined gaps** (`accounting-route-injection-baseline.txt`) |
| `check:accounting-route-security` | every contract route is classified with its module action + required denials; stale/unknown entries fail | 62 routes, matrix regenerated with `--write-matrix` |
| `check:accounting-coverage` | accounting-only statements/functions/branches floor from `coverage-finance-db` | floors 56 / 63 / 44 against measured 58.67 / 65.64 / 46.02 |
| `check-db-test-manifest` | accounting suite list + non-decreasing case counts + no unlisted suite | 71 suites / 492 cases |
| `run-concurrency-suite` | replays the accounting races (added the reopen race) | 14 files ×5 |
| `test:scripts` | unit tests for the classification/matcher lib and the checked-in matrix | 7 new node:test cases |

CI wiring: the two DB-free gates sit next to the Examinations gates; the coverage check sits next to
`check-finance-coverage.mjs` in the Postgres job (it reuses the same report — no extra DB run); the
route-injection/security gates also run in the local `pre-pr-review.sh` gate list.

## 4. Files
- Tests: `crossTenantIsolation.integration.test.ts`, `accountingRouteSecurityMatrix.test.ts`,
  `accountingSetupRoutes.test.ts`, `accountingReportDocumentsRoutes.test.ts`,
  `auditFailureProbe.ts`; extended `accountingConcurrencyDb`, `accountingAuditAtomicityDb`,
  `accountingFxRevaluationDb`, `accountingIas29Db`, `accountingHedgesDb`, `accounting.integration`,
  `accountingResponseContractRoutes`, `accountingHedgeRoutes`; E2E `accounting-voucher-flow.spec.ts`.
- Ratchets: `scripts/ci/check-accounting-route-injection.mjs` (+ empty baseline),
  `check-accounting-route-security.mjs` (+ matrix JSON), `check-accounting-coverage.mjs`,
  `scripts/lib/accountingRouteClassification.mjs`, `accounting-route-ratchets.test.mjs`; updated
  `check-db-test-manifest.mjs`, `run-concurrency-suite.mjs`, `package.json`, backend `package.json`,
  `ci.yml`, `pre-pr-review.sh`.
- No production code, DTO, schema or migration changes.

## 5. Verification
```bash
pnpm typecheck
pnpm --filter mms-backend test
pnpm run test:scripts
node scripts/ci/check-db-test-manifest.mjs && node scripts/ci/check-db-test-hygiene.mjs
pnpm run check:accounting-route-injection && pnpm run check:accounting-route-security
DATABASE_URL=… pnpm --filter mms-backend test:db -- accounting
DATABASE_URL=… pnpm --filter mms-backend test:db:concurrency
DATABASE_URL=… pnpm --filter mms-backend run test:db:coverage:finance && pnpm run check:accounting-coverage
bash .agent/scripts/sync-all.sh && node scripts/verify-rules-integrity.mjs
DATABASE_URL=… bash scripts/ci/local-ci.sh --with-db
```

## 6. Assumptions & deviations
1. The accounting coverage floor reuses the existing `test:db:coverage:finance` report (it already
   instruments `src/accounting/**`, accounting repositories and accounting routes) instead of adding a
   second long coverage run; a dedicated `test:db:coverage:accounting` script exists for local use.
2. The route-security matrix classifies routes from the module-gate defaults plus
   `moduleRouteActionRulesFinance.ts`, the setup-write routes and the read-shaped POSTs; the inject
   matrix proves the denials, while allowed-role happy paths stay in the per-family suites.
3. Concurrency tests use polling and never sleep; the deadlock test fails fast on a real `40P01`.
4. The E2E spec is `@local-only` and is exercised with `--with-e2e`; it is not part of the default PR
   gate.
