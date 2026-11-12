# Workshops Test Suite Audit — 2026-11-12

**Scope:** unit, real-Postgres integration, `fastify.inject` route and Playwright E2E coverage for
the Workshops module, plus CI ratchets. Tenth in the series; companions:
[schema](workshops-schema-persistence-audit-2026-11-12.md),
[lifecycle](workshops-domain-lifecycle-audit-2026-11-12.md),
[subsystems](workshops-subsystems-audit-2026-11-12.md),
[API](workshops-api-layer-audit-2026-11-12.md),
[security](workshops-security-audit-2026-11-12.md),
[async queues](workshops-async-queues-audit-2026-11-12.md),
[printables/analytics](workshops-printables-analytics-audit-2026-11-12.md),
[shared contracts](workshops-shared-contracts-audit-2026-11-12.md),
[frontend/state](workshops-frontend-state-audit-2026-11-12.md).

## 1. Coverage matrix

| Level | Before | After | Notes |
|---|---|---|---|
| Shared unit | completion/lifecycle/date/registration rules, contracts | unchanged | Boundary math, phase/status parity, six-state resolver |
| Backend unit | guards, schema, contract coverage, PII, import runner, report rates, dead letter, queue seams | unchanged | Error mapping/validation |
| DB integration | 9 files / 71 cases | **11 files / 83 cases** | Added lifecycle journey, completion concurrency, final-seat/batch races, waitlist promotion race, real import runner |
| Route (`inject`) | 31 cases | **34 cases** | Added update/scores/evaluate RBAC and archive/bulk/restore success |
| E2E | none | **1 local-only spec** | API-seeded workshop + roster drawer + cancelled phase; form dialog remains component-tested |
| CI | concurrency capacity+waitlist; no workshop manifest | **completion concurrency repeated; 11 workshop DB suites pinned** | `check-db-test-manifest` now floors 249 cases |

## 2. Gap analysis and resolution

| # | Gap | Resolution |
|---|---|---|
| G1 | No single create → register → attendance/scores → evaluate → complete → certify → report journey | `workshopsJourneyDb.integration.test.ts` test 1 |
| G2 | No completion concurrency (evaluate/issue/transition/attendance/cancel) | `workshopsCompletionConcurrencyDb.integration.test.ts` (5 cases) |
| G3 | Final-remaining-seat and batch-vs-single races | `workshopsCapacityConcurrencyDb` +2 cases |
| G4 | Concurrent attendance vs evaluation | Completion concurrency case 4 |
| G5 | `updateWorkshop` has no OCC token (lost update possible) | **Deferred D1** — would require contract/FE token; documented, not masked by a test |
| G6 | Soft-delete test did not prove children survive archive/restore | Journey test 3 |
| G7 | Missing route RBAC for update/scores/evaluate/archive/bulk/restore | `workshops.integration.test.ts` +3 cases (34 total) |
| G8 | No `crossTenantIsolation.integration.test.ts` | Premise correction: `workshopsTenantIsolationDb` is the cross-tenant proof (6 cases); no rename |
| G9 | No E2E | `e2e/tests/tenant/workshops-lifecycle.spec.ts`, tagged `@local-only` |
| G10 | Completion/certificate E2E needs a deterministic past-date seed | **Deferred D2**; DB/route tests cover it, E2E covers registration/cancellation |
| G11 | Import runner only mocked; chunk repo only direct | Real-repo runner case added to `workshopsImportDb` |
| G12 | Completion concurrency not repeated; no workshop DB manifest | Added to `run-concurrency-suite.mjs`; 11 suites pinned in `check-db-test-manifest.mjs` |
| G13 | E2E never ran in nightly | Spec added to `LOCAL_ONLY_SPECS`; nightly `E2E_FULL_SUITE=1` runs it |
| G14 | No endpoint matrix ratchet | Partially covered by RBAC tests + contract-coverage status tests; a route-name matrix remains a future nicety |

## 3. What the new tests prove

### Lifecycle journey (`workshopsJourneyDb`)

- A future workshop is registered, rescheduled into the past (legitimate admin edit), marked
  present/absent over two days, scored, evaluated, completed, certified, and reported with
  `seatUtilizationPct`/`completionPct`.
- Certificate issuance blocks later withdrawal (`certificate_issued`) and cancellation after
  completion is rejected by the state machine (`illegal_workshop_transition`).
- Cancelling a workshop with a seated participant and a waitlisted participant archives **both**
  with cascade provenance and reason, leaves no live seat, and blocks re-registration
  (`workshop_not_open`).
- Soft-deleting a workshop keeps its roster/attendance/score rows live (no child soft-delete), hides
  it from the active list, and restores the exact roster/marks. The detail read intentionally serves
  archived rows for trash/restore, so the test asserts `deletedAt` rather than a false 404.

### Completion concurrency (`workshopsCompletionConcurrencyDb`)

- Two concurrent evaluations settle on one coherent standing; `completedAt` is identical.
- Two concurrent issue requests certify each completed participant exactly once (union = roster, no
  duplicates).
- Completion transition and certificate issuance race without a lost award/status update.
- Attendance save and evaluation serialize; a later evaluation counts the committed mark.
- Cancel and evaluation race: cancel wins, participants are archived, and no certificate survives.

### Capacity / waitlist

- Explicit final seat (capacity−1) with six contenders: one winner, typed conflicts for the rest.
- Atomic batch vs single registration for the last seat: the batch cannot partially fill, and
  capacity holds.
- Withdrawal/promotion races a newcomer: the oldest queued row gets the seat, the newcomer queues,
  and the cap is never exceeded.

### Route security

- Assistant teacher (read-only) is forbidden from update, scores, evaluation, archive and bulk
  archive; admin succeeds and the use cases receive the expected arguments.
- Restore success path is exercised alongside the existing module-gate denial.
- Response validation remains enabled for every success fixture.

## 4. Test-quality findings

1. The completion tests confirm `completedAt` is transaction-consistent; they do not assert audit
   row counts under concurrency (audit has its own suite) to avoid coupling to write-amplification.
2. `updateWorkshop` remains last-write-wins: a concurrent PATCH can overwrite another admin's fields.
   This is a product/API gap (D1), not a test gap; no test pretends it is protected.
3. `getWorkshop` serves archived rows by ID (needed by restore/trash); the journey test documents
   that rather than asserting the old assumption of a 404.
4. E2E is API-seeded so it can use an admin token and future dates without a date-travel fixture; the
   creation form itself stays covered by component tests. Completion E2E needs D2.

## 5. CI ratchets

- `scripts/ci/run-concurrency-suite.mjs`: capacity, waitlist **and completion** concurrency, repeated
  5×.
- `scripts/ci/check-db-test-manifest.mjs`: all 11 workshop DB suites pinned (249 total cases across
  the tracked modules); deleting a case fails CI.
- `check-db-test-hygiene.mjs`: new suites contain no conditional skips.
- Playwright: `workshops-lifecycle.spec.ts` is `@local-only` and listed in `LOCAL_ONLY_SPECS`; PR CI
  skips it, nightly `E2E_FULL_SUITE=1` runs it.
- No workshops DB coverage-percentage ratchet yet; deferred until a measured baseline (D3).

## 6. Verification

- Workshop DB suites: **11 files / 83 cases** green.
- Backend full suite: **521 files / 3689 cases** (route +3); shared/frontend unchanged and green.
- Workshop route/unit: `workshops.integration` 34, contract coverage 5, schema 12, write guards 10.
- Concurrency runner: 7 files × 3 repeats green (including completion).
- DB manifest/hygiene: 249 cases / 19 files, no skips.
- Backend typecheck green; E2E typecheck green. E2E execution is local-only (requires the dev
  servers).

## 7. Deferred

- **D1** OCC on `updateWorkshop` (contract/FE token, stale-409 test).
- **D2** deterministic E2E seed/date override for completion/certificate flows.
- **D3** workshop DB coverage-percentage ratchet after measuring a baseline.
