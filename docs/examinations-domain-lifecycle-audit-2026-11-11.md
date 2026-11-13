# Examinations Domain & Lifecycle Audit — 2026-11-11

> **Round 2 (same day):** re-verified this audit against the live code and corrected two claims — the
> create/scoring-frame audit fix ran on a write path no route calls, and "published = locked" is
> app-level for mark rows. The state-machine gaps (publish bypassing the transition table, the unlock
> rewinding a terminal status, archived exams being editable, the finalize CAS missing state
> predicates) and the import/route boundary defects are audited and fixed in
> [examinations-domain-lifecycle-audit-2026-11-11-round2.md](./examinations-domain-lifecycle-audit-2026-11-11-round2.md).


**Scope:** the Examinations *domain* layer — grading formulas, eligibility rules, the exam
publication lifecycle, score invariants, batch transactional boundaries, and the separation between
domain use cases, Fastify route handlers and Drizzle repositories.

**Method:** read every file under `apps/backend/src/examinations/` (use cases + repository ports),
the route layer (`routes/tenant/examinations*`), the shared DTO/settings/grade utilities, the
frontend call sites, and the RBAC permission catalogue. Cross-checked the SQL rules in
`sessionCompletionRepository.ts` / `examinationRepository*.ts` against the TypeScript use cases.

**Overall finding:** the *ports-and-adapters* seam is in good shape (use cases depend on
`ExaminationsRepository` / `ExamEligibilityRepository`, never on Drizzle), but the **lifecycle had no
state machine at all**, publication was a write-only boolean written from the route layer, and two
grading rules (the letter table and the pass mark) live outside the domain and are never applied by
the server.

---

## 1. Clean-architecture separation

| Finding | Evidence | Status |
|---|---|---|
| **F1 · P1 — Domain logic in the route layer.** Eligibility + teacher class scope + server stamping were composed in `routes/tenant/examinations/examResultsWriteGuard.ts`. | `examResultsWriteGuard.ts` (deleted) | **Fixed:** moved to [`examResultsSubmission.ts`](../apps/backend/src/examinations/use-cases/examResultsSubmission.ts); the route keeps one `beforeSave` reference. |
| **F2 · P1 — A state transition was orchestrated in a handler**, and the *repository* chose the resulting status (`status: input.finalized ? "completed" : before.status`). | `examinationGateHandlers.ts:142-190`, `examClassMembershipRepository.ts:70-118` | **Fixed:** [`examLifecycleUseCases.ts`](../apps/backend/src/examinations/use-cases/examLifecycleUseCases.ts) decides the next state; the repository persists an explicit `{ resultsFinalizedAt, status }`. |
| **F3 · P2 — Write guards lived where they could be bypassed.** `beforeSave` runs *before* the transaction, so a publish racing the save could still be overwritten. | `crudBulkRouteFactories.ts:70-73` | **Fixed for the invariants that matter:** the publication/archived lock and OCC are enforced inside the write transaction ([`examinationResultsPersist.ts`](../apps/backend/src/db/repositories/examinationResultsPersist.ts)). The eligibility *evaluation* still runs pre-transaction — documented residual TOCTOU, harmless now because the exam row lock closes the state race. |
| **F4 · P2 — Two registration surfaces.** The contract declares `bulkUpdateExams`, `bulkUpdateResults`, `deleteExam`, `restoreExam`; the contract router's implementation object omits all four and the legacy bulk router serves those paths. | `examinations.contract.ts:98-126`, `examinationContractRouter.ts:15-176` | **Documented, not refactored** (see §5). |
| **F5 · P1 — Grading is UI-only and config-blind.** `getGrade` hardcodes 90/80/70/60/50 and is consumed only by the frontend; the server never recomputes a grade, so printed report cards carry a client-supplied grade. Tenant settings `gradingSystem`, `passMark`, `maxMark`, `autoPublishResults`, `allowRetake` have **no consumer** outside the settings screen. | `gradeUtils.ts:14-62`, `useResultsViewData.ts:94`, `reportCardPayload.ts:104`, `examinationsModuleSettings.ts:10-31` | **Documented** (§3). |
| **F6 · P2 — Permission semantics for publication.** Publishing/unpublishing results is gated on `examinations.delete` (`canDeleteCollection`), i.e. the delete right is standing in for "publish". | `examinationGateHandlers.ts:150` | **Documented** (§3) — deliberately not changed in a remediation, because swapping the check either tightens or loosens authorization with no product decision. |

## 2. Lifecycle state machine

### What the brief asked for vs. what existed

| Requested state | Represented? |
|---|---|
| Draft | **No** — new exams default to `upcoming` and are immediately visible/bookable |
| Scheduled | Yes (`scheduled`) |
| Ongoing | Yes (`ongoing`) |
| Marking | **No** — no state separates "sat" from "being marked" |
| Moderated | **No** — no second-examiner/moderation record exists |
| Published | Not a status: `exams.results_finalized_at` |
| Locked / Archived | **No** — `completed` doubles as locked; `cancelled` is terminal; soft-delete is the only archive |

**F7 · P0 — There was no state machine.** `status` was copied verbatim from the request in every
write path (`saveExam`, `bulkSaveExams`); no transition table, guard or DB check existed (grep for
`allowedTransitions|canTransition|transition` in the module returned nothing). Illegal transitions
were not *rejected* — they were not *detected*.

**F8 · P0 — Publication and status disagreed.** Finalising forced `status = 'completed'`; re-opening
cleared the stamp but kept `'completed'`, so an unpublished exam still read as completed in lists
and metrics.

**F9 · P0 — Publication had no preconditions.** It succeeded for a cancelled exam, for an exam
nobody sat, and twice; there was no reason and no unlock workflow.

### What is enforced now

- A pure, shared transition table ([`examLifecycle.ts`](../packages/shared/src/examinations/examLifecycle.ts)):
  `upcoming → scheduled | ongoing | cancelled`, `scheduled → ongoing | cancelled`,
  `ongoing → completed | cancelled`, `completed`/`cancelled` terminal; a no-op is an update, not a
  transition; unknown states fail closed.
- The backend rejects an illegal move with **409 `illegal_exam_transition`** inside the write
  transaction ([`examWriteGuards.ts`](../apps/backend/src/examinations/domain/examWriteGuards.ts)),
  and the form only offers legal options (`ExaminationFormFields.tsx`).
- **Published = locked.** A published exam rejects changes to name, subject, totals, date, duration,
  status and class membership (**409 `exam_published_immutable`**), rejects marks writes
  (**409 `exam_results_finalized`**) and rejects soft-delete (**409 `unpublish_first`**).
- `publishExamResults` requires a non-archived, non-cancelled exam with at least one mark, and always
  lands on `completed`; `unpublishExamResults` is the explicit administrative unlock: it **requires a
  reason** (audited), refuses when an owning session is already `completed`, and always lands on
  `ongoing` — never leaving the stale `completed` status behind.
- Publication state is now readable: `Exam.resultsFinalizedAt` is projected by
  `examRowToRecord`/`findExamById`/list reads, so the grid can lock itself and the drawer can show
  "published". Before this, publication was write-only and no client could enforce it.

**Not enforced (by design, this change set):** `draft`, `marking`, `moderated`, `locked/archived`
as first-class states. Building them is a product workflow (moderation approval, archive
retention), not a remediation — see §5 for the target model.

## 3. Score invariants & transactional boundaries

| Invariant | Before | Now |
|---|---|---|
| Negative score | 400 from `assertExamResultsEligible` | 400 from the domain validator + `CHECK (marks_obtained >= 0)` |
| Score above `max_marks` | app-only, bypassable | 400 from the validator + **DB trigger** `trg_exam_results_bounds` (23514), restore-path bypass documented |
| Decimal score | crashed with `22P02` (500) | `numeric(8,2)`, normalized to column scale, DTO-bounded |
| Absent / exempt flag | **not representable** — absent is stored as `0` and counted as a fail in pass-rate math (`examinationRepositoryList.ts:181-183`, `examinationRepositoryReport.ts:68-76`) | **Deferred** (§4) |
| Batch atomicity | one `withTenant` transaction (`withTenant` joins an existing tx) — already correct | unchanged, plus all-or-nothing OCC (`RETURNING` compared against input) |
| Batch size | unbounded array → unbounded transaction | `examResultListSchema.max(2000)`, `examListSchema.max(1000)` |
| Save payload | every save re-sent **all** results in the workspace (`[...otherExams, ...newRows]`) | only the rows being saved — required for OCC (a stale token on an untouched exam used to refuse the whole batch) and for a bounded payload |
| Finalization vs. marking race | none (both last-write-wins) | exam row `FOR SHARE` (marks) vs `FOR UPDATE` (publish); consistent lock order |
| Mark-write audit | none | one audit row per changed mark, in the same transaction |

## 4. Deferred, decision-ready

1. **Absent / exempt scores.** Required fix: an `exam_results.score_status` column
   (`scored | absent | exempt`, default `scored`) with `marks_obtained` nullable or zeroed for
   non-scored rows and a `CHECK` tying the two; DTO + grid support (a three-state cell); pass-rate
   denominators must exclude `exempt` and (by policy choice) `absent`. Deferred because excluding
   absentees from the denominator changes published pass rates — a product decision, not a bug fix.
2. **Grading configuration.** Make `passing_marks` the single exam-level threshold, seed it from the
   module `passMark` preference (requires making the DTO fields optional so "unset" is
   distinguishable), pass the tenant `gradingSystem` into `resolveGrade`, and recompute the grade
   **server-side** in the report-card/certificate payload builder so a printed grade cannot diverge
   from the stored mark.
3. **Publication permission.** Proposed keys `examinations.publish` and
   `examinations.override_lock` (mirroring `sessions.override_lock`), mapped to module actions in
   `packages/shared/src/auth/permissionRules.ts`, with the publish/unlock handlers switched over.
4. **Room/time conflict detection.** Needs `exams.room`, `exams.starts_at`, `exams.ends_at`
   (`timestamptz`), nullable `session_id`, and a `btree_gist` exclusion constraint on
   `(workspace_subdomain, room, tstzrange(starts_at, ends_at)) WHERE deleted_at IS NULL`.
   No such columns exist today, so exam-room conflicts are not detectable, let alone indexed.
5. **Two registration surfaces.** Implement the four contract write endpoints in the contract router
   (with the same permission checks the legacy router applies) and delete the legacy registration —
   deferred because it changes the module's write routing and needs its own review.

## 5. Delivered

- [`examLifecycle.ts`](../packages/shared/src/examinations/examLifecycle.ts) + 6 unit tests.
- [`examWriteGuards.ts`](../apps/backend/src/examinations/domain/examWriteGuards.ts) (pure guards).
- [`examLifecycleUseCases.ts`](../apps/backend/src/examinations/use-cases/examLifecycleUseCases.ts) + 10 unit tests.
- [`examResultsSubmission.ts`](../apps/backend/src/examinations/use-cases/examResultsSubmission.ts)
  (moved route guard); route layer reduced to transport + authorization + error mapping.
- `resultsFinalizedAt` on the exam DTO and every exam projection; publish/unpublish UI with a required
  unlock reason; read-only marks grid while published; status options filtered by the transition table.
- 8 new i18n keys across en/ar/ur/fa.

## 6. Verification

```bash
pnpm --filter mms-backend test -- examLifecycleUseCases examResultUpsert
pnpm --filter @mms/shared test -- examLifecycle
pnpm --filter mms-frontend test -- EnterMarks ExaminationFormFields
pnpm --filter mms-backend test:db -- src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts
node scripts/check-backend-structure.mjs
```
