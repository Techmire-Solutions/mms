# Examinations Domain & Lifecycle Audit — Round 2 (2026-11-11)

**Scope.** The Examinations *domain* layer after migration 0238: grading formulas, eligibility
rules, the exam lifecycle state machine, score invariants, batch transactional boundaries, and the
separation between domain use cases, Fastify route handlers and Drizzle adapters.

**Method.** Read every file under `apps/backend/src/examinations/` (domain, use cases, ports and
adapters), the Drizzle implementations that hold domain rules, the route layer
(`routes/tenant/examinations.ts` and `routes/tenant/examinations/**`), the shared state
machine/DTO/contracts, the marks import worker, the frontend form/grid/publish UI, and the round-1
audit. Re-ran the boundary/structure ratchets read-only and inspected the live `exam_results`
triggers. This round *corrects* two round-1 claims: the audit fix it describes was applied to a
write path no route calls, and "published = locked" is app-level for mark rows (no DB lock).

## State map: what the brief asks for vs. what exists

| Brief state | Implemented today |
|---|---|
| Draft | **No** — new exams default `upcoming` and are immediately visible |
| Scheduled | Yes (`scheduled`) |
| Ongoing | Yes (`ongoing`); it also serves as the informal "marking" phase |
| Marking | **No** — `completed` doubles as delivered/marking; marks stay editable while completed-unpublished |
| Moderated | **No** — moderation is a per-mark field (`grace_marks` + `moderated_*`), not a state or a second-examiner approval |
| Published | **Not a status** — `exams.results_finalized_at` stamp; `completed` is the target status |
| Locked / Archived | **No** first-class state — `completed` reads as locked in lists; `cancelled` is terminal; soft-delete (`deleted_at`) is the archive |

The implemented machine is **5 statuses + a publication stamp + soft-delete**. The 7-state workflow
(Draft/Marking/Moderated/Locked) is deferred as a product decision (R8); the brief's names are mapped
above so no requirement silently disappears.

## What is already sound (verified, no change)

- Routes import no storage (`check-backend-boundaries`: 0 offenders); use cases depend on
  `ExaminationsRepository` / `ExamEligibilityRepository` ports.
- Ordinary illegal transitions are rejected inside the write transaction (`assertExamTransitionAllowed`);
  same-state is an update; unknown persisted states fail closed.
- Published exams refuse bulk edits, soft-delete and marks/moderation writes; archived/cancelled
  refuse marks. The mark row is locked `FOR SHARE` against the publish path's `FOR UPDATE`.
- Marks batch submission is one `withTenant` transaction; audit rows are written in it; 2000-mark /
  1000-exam caps; OCC token + natural-key upsert + all-or-nothing rollback.
- The administrative unlock exists and is audited: reason required (≥3 chars), CAS-guarded, refused
  once an owning session is completed.
- `resolveResultScore` is the shared grading engine; analytics buckets derive from the shared
  `GRADE_BANDS`.

## Findings register

### A. Clean-architecture separation

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| V1 | **P1** | `examinationsUseCases.ts` (10 `getRequestTenant()` sites), `examEligibilityGate.ts`, `examResultsSubmission.ts` | The domain/use-case layer reads ambient request state (ALS) instead of receiving the tenant; use cases cannot run without a request scope and unit tests must mock `lib/tenantContext`. | **Documented** — R1 (mechanical refactor, ~20 call sites) |
| V2 | **P1** | `db/repositories/examinationResultModeration.ts`, `examinationsUseCases.ts` | Moderation validation, effective-score bound and response scoring lived in the Drizzle adapter; the use case was a passthrough. | **Fixed** — rules extracted to [`domain/moderation.ts`:17](../apps/backend/src/examinations/domain/moderation.ts); the use case validates before delegating ([`examinationsUseCases.ts:144`:144](../apps/backend/src/examinations/use-cases/examinationsUseCases.ts)); the adapter keeps only in-transaction persistence + the bound (same domain functions) |
| V3 | **P1** | `examinationExamsPersist.ts`, `examinationsUseCases.ts:160-161` | **The round-1 audit fix ran on a dead path.** `createExam`/`updateExamById` are exported but no route uses them; the live UI save is `bulkSaveExams`, which computed frame changes into a map it never read and never emitted `auditExamCreated`. Exam creates and scoring-frame changes made in the UI were unaudited while the DB tests asserted the opposite by calling `saveExam`. | **Fixed** — bulk path audits creates and every frame change in-transaction ([`examinationExamsPersist.ts:236-252`:236](../apps/backend/src/db/repositories/examinationExamsPersist.ts)); dead map + dead use-case exports removed |
| V4 | **P2** | `routes/tenant/examinations.ts:74` vs `contracts/examinations.contract.ts:130` | The results bulk route registered the full record schema (marks `default(0)`, moderation fields accepted) while the contract advertises `examMarksWriteListSchema`. An omitted `marksObtained` silently recorded **0**; the strict contract was dead enforcement. | **Fixed** — route uses `examMarksWriteListSchema`; missing marks/moderation fields are 400 (route tests) |
| V5 | **P2** | `examinationContractRouter.ts`, `routes/tenant/examinations.ts` | Two registration surfaces: the contract declares `bulkUpdateExams` / `bulkUpdateResults` / `deleteExam` / `restoreExam`, but the legacy bulk router serves them, so guards/permissions must be changed twice. | **Documented** — R3 |
| V6 | P3 | `examWriteGuards.ts`, `examLifecycleUseCases.ts` | Domain modules import transport error classes (`lib/httpErrors`). Consistent with repo convention, but a dependency inversion. | **Documented** — R4 |
| V7 | P3 | `examinationGateHandlers.ts:53-59`, `examinationGateModerationHandlers.ts:110-111` | Route handlers wrap use cases in `withTenant` that the repositories open again, and the moderation handler keeps a dead `if (!result) throw NotFound` after a use case that already throws. | **Documented** (cleanup bundled with R1/R3) |

### B. Lifecycle state machine

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| S1 | **P1** | `examLifecycleUseCases.ts:108`; `examLifecycle.ts:129` | **Publish bypassed the state machine.** No status precondition existed, so an `upcoming`/`scheduled` exam (never sat) could be published, writing `completed` — a move the shared table declares illegal. | **Fixed** — `publishExamRejection` rejects `not_sat` (new 409 `exam_not_sat`) and the target status/edge live in the shared module |
| S2 | **P2** | `examLifecycleUseCases.ts:176`; `examLifecycle.ts:10-13,38` | **Two authorities.** Unpublish wrote `completed → ongoing` while the table marks `completed` terminal and the comment claimed reopening does not rewind the lifecycle. | **Fixed** — the administrative layer (`PUBLISH_TARGET_STATUS`, `UNPUBLISH_TARGET_STATUS`, rejection functions) is the single authority; the comment now states the deliberate rewind |
| S3 | **P2** | `examinationExamsPersist.ts:186`; `examWriteGuards.ts:78` | **Archived exams were editable through the live bulk path.** `loadExamWriteStates` did not select `deletedAt` and `bulkSaveExams` had no archived guard, while the single `updateById` refused archived rows. | **Fixed** — `ExamWriteState.deletedAt` + `assertExamNotArchived` enforced by both save paths (409 `exam_archived`) |
| S4 | **P2** | `examLifecycleUseCases.ts:161` | Unpublish did not refuse an archived exam (publish did). | **Fixed** — `unpublishExamRejection` returns `archived` |
| S5 | **P2** | `examClassMembershipRepository.ts:178-217` | The finalize CAS only asserted the stamp: a concurrent `ongoing → cancelled`/archive could commit first and the publish still stamped; the completed-session unlock guard was a pre-transaction read. | **Fixed** — `require: "publishable"` (archived/status) and `require: "unlockable"` (archived + `NOT EXISTS` completed owning session) evaluated in the same UPDATE |
| S6 | P3 | `examLifecycle.ts:61-70`; `ExaminationFormFields.tsx:37` | Creating an exam in a terminal status (`completed`/`cancelled`) is allowed and the form offers every status. Backfill may be intentional. | **Documented** — R9 (create-status policy decision) |
| S7 | P3 | `examLifecycle.ts:37`; `examLifecycleUseCases.ts` | `ongoing → completed` is legal through a plain edit, so a delivered exam with **no marks** can exist and is terminal; publish then refuses it for having no marks. | **Documented** — R9 (require marks or allow reopen) |
| S8 | P3 | `examLifecycle.ts:38-43` | `cancelled`/`completed` are unrecoverable (no administrative reopen beyond the publication unlock). | **Documented** — R9 |
| S9 | **P2** | status set; `examinationResultModeration.ts` | Missing first-class `marking`/`moderated`/`locked` states and no moderation record/approval, so "moderated" cannot be audited as a transition. | **Documented** — R8 (product workflow) |
| S10 | P3 | `examLifecycle.ts:81-86` | `isExamLocked`/`TERMINAL_EXAM_STATUSES` are test-only; each path re-derives the lock from fields. | **Documented** — fold the predicate into the guards in R3/R8 |

### C. Score invariants & transactional boundaries

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| T1 | **P1** | `examinationsModuleManifest.ts:93-124`; `examinationRepositoryList.ts:182`; `examinationRepositoryAnalytics.ts:27-47` | **Absent/exempt/withheld are not representable.** A blank cell means "not entered" (no row), while an omitted mark on the API became `0`. A 0 counts as an attempted failure in pass rates; absent cannot be distinguished from zero. | **Documented** — R6 (D1 model + denominators) |
| T2 | **P2** | `examinationsMarksImportService.ts:129,138` | The queued CSV import bypassed `assertExamResultsEligible` entirely (attendance gate, overrides, teacher scope); a below-threshold student could be graded by CSV. | **Fixed (attendance/roster/override)** — gate runs per chunk and per fallback row, tenant-explicit. Teacher scope remains **documented** — R2 |
| T3 | P3 | `crudBulkRouteFactories.ts:71`; `examEligibilityGate.ts` | Eligibility/teacher scope run in `beforeSave`, before the write transaction (TOCTOU). The marks bound is DB-backed (trigger); the attendance gate is not rechecked in-tx. | **Documented** (bounded: the exam row lock closes the state race) |
| T4 | **P2** | `examinationMarksLock.ts`; live DB: only `trg_exam_results_bounds` | The publication lock on **mark rows** is application-only. A direct SQL/legacy writer can change a published mark; the DB enforces bounds + certificate freeze only. | **Documented** — R5 (trigger + migration 0239) |
| T5 | P3 | `examinationResultModeration.ts` | Moderation input validation ran before the transaction; the effective bound runs inside. | **Fixed** — validation is domain; the bound stays in-tx |
| T6 | P3 | `examLifecycleUseCases.ts` | Publish is three transactions (`requireState`, `countExamResultsForExam`, CAS). The CAS now closes double-publish and the state race; "has marks" remains a snapshot (no mark-delete path, so benign). | **Documented** |
| T7 | **P2** | `examinationRepositoryReport.ts:83,120`; `examinationRepositoryList.ts:182`; `resultScoring.ts:51-82` | The pass rule (`marks + grace >= passing`) is duplicated in three SQL sites and the TS engine; bands are shared but the predicate is not, so a formula change can drift. | **Documented** — R7 (SQL fragment SSOT + parity test) |
| T8 | P3 | `examinationsModuleSettings.ts:10-31`; `ExaminationsPreferencesSection.tsx` | Lifecycle-adjacent preferences (`autoPublishResults`, `allowRetake`, `showRankings`, `notifyOnResult`) have no consumer — enabling auto-publish does nothing. | **Documented** — R10 |

## What shipped in this change set

- **Shared state machine** ([`examLifecycle.ts`](../packages/shared/src/examinations/examLifecycle.ts)):
  `PUBLISHABLE_EXAM_STATUSES`, `isPublishableExamStatus`, `PUBLISH_TARGET_STATUS`,
  `UNPUBLISH_TARGET_STATUS`, `isExamArchived`, `publishExamRejection`, `unpublishExamRejection`;
  corrected the publication comment. 5 new shared tests (11 total).
- **Domain guards** ([`examWriteGuards.ts`](../apps/backend/src/examinations/domain/examWriteGuards.ts)):
  `ExamWriteState.deletedAt`, `examArchivedError`, `assertExamNotArchived`; both save paths call it.
  New `examWriteGuards.test.ts` (17 cases — the guards previously had no direct spec).
- **Live-path audit** ([`examinationExamsPersist.ts`](../apps/backend/src/db/repositories/examinationExamsPersist.ts)):
  `bulkSaveExams` now emits `auditExamCreated` and `auditScoringFrameChange` in the write
  transaction; the dead `frameChangesByExam` map and the unreachable `createExam`/`updateExamById`
  exports are gone.
- **Publication use case** ([`examLifecycleUseCases.ts`](../apps/backend/src/examinations/use-cases/examLifecycleUseCases.ts)):
  rejections derive from the shared module (`exam_not_sat`, `exam_archived`, `exam_cancelled`,
  `exam_already_published`, `exam_not_published`); a lost CAS re-reads once and reports the real
  reason (`exam_state_changed` if nothing else matches). Unpublish now refuses archived exams.
- **CAS state predicates** ([`examClassMembershipRepository.ts`](../apps/backend/src/db/repositories/examClassMembershipRepository.ts)):
  `require: "publishable" | "unlockable"` applied in the same UPDATE (status/archive; completed
  owning session via `NOT EXISTS`).
- **Strict marks boundary** ([`examinations.ts:74`:74](../apps/backend/src/routes/tenant/examinations.ts)):
  the bulk results route uses `examMarksWriteListSchema`; missing marks and moderation fields are 400.
- **Import gating** ([`examinationsMarksImportService.ts:129`:129](../apps/backend/src/services/examinationsMarksImportService.ts)):
  the attendance/roster/override gate runs per chunk and per fallback row; the gate is
  tenant-explicit and reads the exam through the repository port.
- **Moderation domain** ([`moderation.ts`](../apps/backend/src/examinations/domain/moderation.ts)):
  reason/grace/effective rules extracted and reused by the use case and adapter; the contract's
  grace cap now uses `MAX_GRACE_MARKS`.
- **Tests**: shared lifecycle (11), pure guards (17), lifecycle use cases (14), moderation domain
  (6), import runner (4), route boundary (2 new), DB state-machine/CAS (4 new in
  `examinationIntegrityDb`, 24 total). The test-matrix ratchet pins **47** scenarios.

## Deferred refactors (decision-ready)

### R1 · Tenant-explicit use cases (V1)
Change `examinationsUseCases` and the gate/submission use cases to take `tenant: string`; routes pass
`request.tenant.id`, workers pass `ctx.tenant`; keep a thin request-scoped facade for compatibility;
remove the `lib/tenantContext` mock from unit tests. Mechanical, ~20 call sites; no behaviour change.

### R2 · Import authority (T2)
Teacher section scope is still not evaluated for the queued import (the attendance gate is). Two
options: (a) require coordinator authority (`examinations.delete` / `sessions.delete`) for
`POST /exams/:id/results/import` and gate the UI button, or (b) load the enqueuing user in the worker
and run `authorizeAndStampExamResults` (scope + stamp). Recommendation: (a) — CSV import is a bulk
administrative action, not a marking grid.

### R3 · Single registration surface (V5, V7, S10)
Implement the four missing contract handlers (`bulkUpdateExams`, `bulkUpdateResults`, `deleteExam`,
`restoreExam`) in `examinationContractRouter`, delete the legacy bulk registration for exams, fold the
`isExamLocked` predicate into the guards, and add a contract-coverage test asserting every declared
route has exactly one handler.

### R4 · Domain error types (V6)
`examinations/domain/errors.ts` (`ExamStateError`, `ExamValidationError`) mapped by `mapGateError`;
remove `lib/httpErrors` imports from domain modules.

### R5 · DB publication lock on marks (T4)
Migration 0239 + snapshot/journal, renumbering the deferred phases (D1→0240, D2→0241, D3→0242):

```sql
SET LOCAL lock_timeout = '2s';
CREATE OR REPLACE FUNCTION exam_results_guard_published() RETURNS trigger AS $$
DECLARE finalized timestamptz;
BEGIN
  -- Snapshot restore legitimately replays historical rows under this flag.
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT e.results_finalized_at INTO finalized
    FROM exams e
   WHERE e.workspace_subdomain = COALESCE(NEW.workspace_subdomain, OLD.workspace_subdomain)
     AND e.id = COALESCE(NEW.exam_id, OLD.exam_id);
  IF finalized IS NOT NULL THEN
    RAISE EXCEPTION 'exam_results for published exam % are immutable — unpublish first',
      COALESCE(NEW.exam_id, OLD.exam_id) USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_exam_results_published_lock
  BEFORE INSERT OR UPDATE OR DELETE ON exam_results
  FOR EACH ROW EXECUTE FUNCTION exam_results_guard_published();
```

The unlock clears the stamp first, so edits become legal again without any flag; DB tests: direct
update of a published mark → `23514`, after unlock → allowed, restore under purge → allowed.

### R6 · Absent/exempt/withheld (T1, D1)
`exam_results.score_status` (`scored | absent | exempt | withheld | disqualified`, default scored),
nullable/zeroed mark with a tying CHECK, DTO + three-state grid cell, and pass-rate/ranking
denominators per D1 (absent/disqualified count as failures; exempt/withheld excluded), printed codes
`AB/EX/WH/DQ`.

### R7 · Score-formula SSOT (T7)
Extract the effective-score/pass SQL expressions into one fragment module (or a DB function) used by
the report, metrics and analytics queries; add a DB parity test against `resolveResultScore` at the
band boundaries, including grace and zero-total rows.

### R8 · 7-state workflow (S9)
Draft/Marking/Moderated/Locked model: state table with transitions, a moderation record with an
approval decision (not just `grace_marks`), archive retention, and the UI affordances. Product
decision — the audit records the target, not the implementation.

### R9 · Recovery + create-status policy (S6/S7/S8)
Administrative `reopen` for `cancelled`/`completed` (→ `ongoing`, reason + audit), a decision on
whether `completed` requires at least one mark, and whether creation may start terminal (backfill vs.
data-entry mistake). Requires a product decision.

### R10 · Server-side grade recomputation + preferences (T8)
Recompute the printed grade server-side in the report-card/certificate payload builder (the client
currently computes from stored marks via the shared engine), and either wire `autoPublishResults` to
a defined lifecycle event or remove it.

## Edge cases & failure modes

- Publishing an `upcoming`/`scheduled` exam now returns 409 `exam_not_sat` before the marks count is
  read; the UI surfaces the server message (no new i18n).
- A publish/unlock that loses the CAS writes nothing and no audit row; the re-read maps the precise
  reason (or `exam_state_changed`).
- A stale exam list that still contains an archived row fails the whole bulk save with 409
  `exam_archived` (the active list normally excludes trashed rows).
- The strict marks route rejects legacy callers relying on the default-zero; the grid omits blank
  cells rather than sending zeros, so its payloads are unaffected.
- Import: one blocked row fails the chunk, the fallback re-gates each row, and only the blocked row
  reports an error — the rest import.
- Moderation grace above 9999.99 is rejected by the contract schema (400) before the domain check.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter @mms/shared test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts \
  src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts \
  src/__tests__/db-integration/attendanceSpecializedSubsystemsDb.integration.test.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
node scripts/check-backend-boundaries.mjs
node scripts/check-backend-structure.mjs
node scripts/check-code-norms.mjs
node scripts/check-examinations-test-matrix.mjs
node scripts/check-docs.mjs
```
