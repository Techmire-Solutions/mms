# Examinations Test Suite — Audit & CI Hardening (2026-11-11)

**Scope.** Unit (shared/backend), real-Postgres integration, RLS and E2E coverage for the
Examinations module, plus the ratchets that keep it from silently shrinking.

## Inventory before this round

- Shared units: `resultScoring` (12), `examLifecycle` (11), contract schemas (17), marks-write schema;
  attendance eligibility boundaries.
- Backend units: eligibility gate, lifecycle use cases, marks-import scope, result-upsert rounding,
  moderation domain, write guards, analytics mapping, job runners.
- Real Postgres: `examinationIntegrityDb` (31, OCC/batch race/publication CAS/audit/restore),
  `examinationSubsystemsDb` (19, eligibility/grace/analytics/session+enrollment archive),
  `examinationsTenantIsolation` (9, CI non-bypass role).
- `fastify.inject`: 45 route/RBAC/tenant/publication tests.
- E2E: **no Examinations spec** (only responsive/a11y shell visits).

## Gaps found

### Grading & boundary
- Multi-component weightages and per-component fail rules **do not exist** (D3); no test can cover
  them until the product model exists.
- `rankInExam` had no tie case (overall/per class), null class, empty list or missing tie-break;
  `rankResults` had no empty/no-tieBreak case.
- `roundPercentage` lacked cent-half/negative/NaN/Infinity cases; `resolveResultScore` lacked
  exact-pass, NaN/Infinity, negative grace/pass-mark and over-total marks.
- Shared `gradeUtils` had no direct test (only a frontend re-export smoke test).
- Lifecycle transitions were spot-checked, not exhaustive.

### Concurrency & cascade
- One OCC race existed inside the integrity suite, run once; no repeated concurrency suite, no
  overlapping-batch opposite-order (deadlock), concurrent publish, or moderation-vs-save race.
- Student archive/purge and exam archive effects on marks/analytics/roster were untested; the
  student FK cascade can destroy marks on a hard purge (retention decision still pending).
- No exam DB coverage gate/manifest entry; `test:db:concurrency` excluded exams.
- Session rollover interaction remains uncovered beyond the existing "archive blocks purge" and
  "unlock blocked after session completion" cases.

### Security / injection
- Missing: teacher editing a locked/published definition, teacher bulk-marks section denial,
  guardian denial on moderation/finalization/gate/override, draft-payload hiding (only the query flag
  was asserted), cross-tenant tokens on mutating routes.
- No role×route matrix; route-injection only checked URL presence.
- RLS lacked eligibility/override cross-tenant cases.

### E2E
- No browser coverage of marks entry, inline validation, unsaved discard or publication lock.

### Ratchets
- `check:examinations-tests`, `check:examinations-route-injection` and the shared scoring coverage
  script were not invoked by CI or `ci:local --full`; no exam DB coverage ratchet/manifest entry;
  exam files were absent from the concurrency runner/shuffle; `backend_db` path filters skipped
  exam route/use-case-only PRs.

## Implemented in this round

- Units: exact-pass/clamp/cent-half/negative/NaN cases; rank ties/null/empty/missing tie-break;
  shared `gradeUtils.test.ts`; exhaustive lifecycle pair matrix.
- DB: new `examinationsConcurrencyDb.integration.test.ts` (disjoint batches, opposite-order
  overlapping batches with no `40P01`, one-winner publication CAS, moderation-vs-save coherence);
  student archive/restore, student hard-purge FK behaviour pinned, exam archive analytics/restore,
  enrollment hard-purge evidence; cross-tenant eligibility-override RLS case.
- Injection: teacher bulk-marks section denial, guardian privileged-route denials, reader
  draft-payload absence, cross-tenant mutation tokens.
- Ratchets: checked-in `scripts/ci/examinations-route-security.json` + checker (22/22 contract
  routes classified, every write has admin+denial); exam DB coverage script/floors (lines 60 /
  statements 58 / functions 60 / branches 45, initial floor); manifest entries for the three exam DB
  suites; exam file in the repeated concurrency runner; exam DB files in the shuffled run; CI steps
  for matrix/route-injection/route-security/shared coverage and DB coverage; `ci:local --full`
  wiring; `backend_db` path filters include `src/examinations/**` and exam routes.
- E2E: `seed-exam-e2e.ts` + `seedExamForE2e` helper + `examinations-marks-entry.spec.ts`
  (API-bootstrapped isolated tenant; keyboard entry, inline over-range error, save, dirty-discard
  confirm, published lock). CI-runnable (no `@local-only`).

## Remaining / decisions

- **Weightage/failing components**: blocked on D3; no fabricated tests.
- **Student hard purge**: FK cascade currently deletes exam marks; test documents this. A retention
  guard (block or archive-copy) is a product/DDL decision; update the test when adopted.
- **Session rollover**: only archive/completion interactions are pinned; promote-specific behaviour
  has no exam surface to test.
- **E2E**: authored and typechecked; it runs in the chromium CI project (not locally in this audit
  environment without the web server/browser).
- **Coverage floors** are initial; raise as the suite grows (ratchet policy).

## Verification

Current local results: shared **270 files / 2160 tests**, backend unit **498 / 3560**, real Postgres **84 files / 443 passed (1 skipped)**, examinations DB coverage **lines 63.2% / functions 64.2% / branches 46.7%** (floors 60/60/45, statements 58), exam matrix **135 scenarios**, route injection **20/20**, route-security matrix **22/22**, E2E spec discovered in the chromium project. RLS requires the CI `mms_app` role; the two RLS additions typecheck but cannot run as the local superuser.

```bash
pnpm typecheck
pnpm --filter @mms/shared test
pnpm --filter mms-backend test
pnpm --filter mms-backend test:db
pnpm --filter mms-backend run test:db:coverage:examinations
node scripts/ci/check-examinations-coverage.mjs --coverage apps/backend/coverage-examinations-db
pnpm run check:examinations-tests
pnpm run check:examinations-route-injection
pnpm run check:examinations-route-security
pnpm run check:db-test-manifest   # via scripts/ci
pnpm --filter mms-backend run test:db:concurrency
pnpm test:e2e --project=chromium e2e/tests/features/examinations-marks-entry.spec.ts
# CI-only: pnpm --filter mms-backend test:rls (non-bypass role)
```
