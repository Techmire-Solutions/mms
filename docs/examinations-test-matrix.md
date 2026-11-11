# Examinations Test Matrix

The examinations suite is only complete when each row below has at least one pinning spec. Rows are
grouped by the invariant they protect; **Status** records what exists today, **Where** names the spec.

## Grading & boundaries

| Invariant | Status | Where |
|---|---|---|
| Raw-score grading; `passed` and grade can never disagree | ✅ | `packages/shared/src/examinations/resultScoring.test.ts` |
| Exam-specific pass mark (not a hardcoded 50) | ✅ | same |
| Grace adds to the effective score without rewriting the raw mark | ✅ | same + `examinationSubsystemsDb` |
| Zero/negative total never yields Infinity/A+ | ✅ | same |
| Display rounding only (raw kept for grading) | ✅ | same |
| Grade-band boundary sweep (49.99/50/59.99/60/69.99/70/79.99/80/89.99/90/100) | ✅ | same (`grade bands`) |
| Fail floors to F even above 50% when the pass mark is higher | ✅ | same |
| Grace turns a fail into a pass only via grace | ✅ | same |
| `numeric(8,2)` scale incl. `85.555`, `0.005`, `99.995`, ceiling | ✅ | `examResultUpsert.test.ts` |
| Competition ranking `1,1,3`, deterministic ties, per-class ranks | ✅ | `resultScoring.test.ts` |
| Multi-component weightages / failing-component rules | ⛔ capability absent | no components model — do not fake coverage |

## Concurrency & lifecycle

| Invariant | Status | Where |
|---|---|---|
| OCC version increments; stale token → 409 | ✅ | `examinationIntegrityDb` |
| Batch is atomic when one row is stale | ✅ | same |
| **Two simultaneous same-token writes: exactly one wins** | ✅ | same (`serialises two simultaneous writes`) |
| Published / archived / cancelled exams refuse writes | ✅ | `examinationIntegrityDb`, `examinationSubsystemsDb` |
| DB trigger rejects over-total marks and lowering the total | ✅ | `examinationIntegrityDb` |
| Publish/unpublish guards (twice, cancelled, archived, nobody sat, completed session) | ✅ | `examLifecycleUseCases.test.ts` |
| Completion gated on attendance + finalised exams | ✅ | `sessionCompletionDb` |
| Archived enrollment leaves the roster but keeps historical marks; restore re-includes it | ✅ | `examinationSubsystemsDb` (`drops the student from the roster but keeps their marks`) |
| Soft-deleting a **session** keeps exams+marks and a hard purge is blocked by `exam_classes` RESTRICT | ✅ | `examinationIntegrityDb` (`keeps exams and marks when the session is archived`) |
| Archived session **hides** its exams from lists/reports (D5) | ⚠️ deferred | `examinations-open-decisions.md` D5 — model not implemented |
| Session rollover × finalized exams | ⚠️ **required next** | no test; `findOwningSessionStatuses` only unit/DB-adjacent |
| Restore stamps `restored_at`/`restored_by` and round-trips publication + the attendance gate | ✅ | `examinationIntegrityDb` (`stamps restore provenance`, `round-trips publication`) |
| Restore round-trips grace marks and moderation attribution | ✅ | `examinationIntegrityDb` (`round-trips grace marks`) |
| Publish/unpublish is a compare-and-set (a lost race writes nothing) | ✅ | `examLifecycleUseCases.test.ts` + `examinationIntegrityDb` (`writes a publish once`) |
| A published exam cannot be trashed or re-weighted in the database | ✅ | `examinationIntegrityDb` (`rejects trashing or re-weighting`) |
| CSV marks import participates in OCC (echoes stored id/version) | ✅ | `examinationsMarksTransfer.test.ts` |
| Publish requires a sat exam (`ongoing`/`completed`); upcoming/scheduled → 409 `exam_not_sat` | ✅ | `examLifecycleUseCases.test.ts` |
| Publish/unpublish rejections come from the shared state machine, not the use case | ✅ | `examLifecycle.test.ts`, `examWriteGuards.test.ts` |
| The admin unlock refuses archived exams and a completed owning session (CAS predicate) | ✅ | `examLifecycleUseCases.test.ts`, `examinationIntegrityDb` |
| Archived (soft-deleted) exams are read-only through both save paths | ✅ | `examWriteGuards.test.ts`, `examinationIntegrityDb` |
| Exam create + scoring-frame changes are audited on the live bulk path | ✅ | `examinationIntegrityDb` (`audits exam creation and scoring-frame changes`) |
| Marks body requires `marksObtained`; moderation fields are rejected | ✅ | `examinations.integration.test.ts` |
| CSV marks import applies the attendance/roster/override gate | ✅ | `examinationsMarksTransfer.test.ts` |
| Moderation validation/effective bound lives in the domain module | ✅ | `examinationModerationDomain.test.ts` |
| Strictest non-zero session attendance threshold (multi-session exam) | ✅ | `examinationSubsystemsDb` (`strictest non-zero session threshold`) |
| Eligibility batch aggregates attendance once per enrollment window (shared class) | ✅ | same (`returns one view per exam from a single seat-holding roster`) |
| Lowering a total below a moderated effective score is rejected | ✅ | `examinationIntegrityDb` (`below a moderated effective score`) |

## Paper (exam-paper) integrity

| Invariant | Status | Where |
|---|---|---|
| `tests` total/duration checks; `questions.marks` and `assessment_answers.score` non-negative | ✅ | `questionBankPersistenceDb` |
| `test_section_questions.section_id` FK; deleting a section cascades its links | ✅ | same (`cascades question links`) |
| One **active** paper result per `(test, student)`, recyclable after soft delete | ✅ | same (`rejects a duplicate active result`) |
| `submitted_at` cannot hold text the reports cannot cast | ✅ | same (`rejects a malformed submitted_at`) |
| Declared indexes/FKs really exist (`submitted_at` index, `tests_class_fk`, section unique) | ✅ | same (`has the submitted-at index`) |

## Security & routes

| Invariant | Status | Where |
|---|---|---|
| 401 unauthenticated; 403 without module grant | ✅ | `examinations.integration.test.ts` |
| JWT workspace ≠ request host rejected (403) | ✅ | same (`tenant binding`) |
| Reader gets published-only marks; writer keeps full scope | ✅ | same (`publication scope`) |
| Read-only projection strips `markedBy`/`version`/moderation notes | ✅ | same |
| Only controllers (`examinations.delete`) may moderate | ✅ | same (teacher 403) |
| Unknown/cross-tenant eligibility id → 404 | ✅ | same |
| Teacher scope: no faculty link / wrong section refused | ✅ (unit) | `teacherExamScope.test.ts` |
| Locked-exam write through `fastify.inject` (409 `exam_results_finalized`) | ✅ | `examinations.integration.test.ts` (`maps a locked (published) write to 409`; submission gate stubbed) |
| Cross-tenant RLS proof (reads/writes/insert/audit) | ✅ (CI) | `rls/examinationsTenantIsolation` |
| Test-matrix ratchet (required scenarios cannot silently disappear) | ✅ | `scripts/check-examinations-test-matrix.mjs` (part of `pre-pr-review.sh` / `ci:local`) |
| Tenant-scope enforcement through the real route + DB | ⚠️ next | route tests mock use-cases |
| `GET /exams` strict query: unknown key / `limit=101` / `page=0` / bogus status → 400 | ✅ | `examinations.integration.test.ts` (`strict request validation`) |
| Path params validated: overlong `:studentId` → 400 before the handler | ✅ | same |
| Gate/override/finalisation/setup routes have `app.inject` coverage | ✅ | same (`gate, override and publication routes`) |
| Publication rejection serializes `details.examId` | ✅ | same; domain unit tests too |
| Guardian token → 403 on the marks list and the broadsheet export | ✅ | same (`serialization privacy`) |
| Reader analytics are published-only | ✅ | same + `examinationSubsystemsDb` (`published-only analytics read`) |
| Bulk marks gate 409 carries `details.students` | ✅ | same (`bulk writes keep structured errors`) |
| Bulk exam upsert rejects bad date / passing>total / blank name (400) | ✅ | same; shared `examinationsApiSchemas` |
| Non-grader export is published-only and omits the grace column | ✅ | `examinationsMarksTransfer.test.ts` |
| Contract/gate handlers map PostgreSQL constraints (23505→409, 23514→400) | ✅ | `contractError.test.ts`, `examEligibilityGate.test.ts`, `errorHandler.test.ts` |

## Gaps to close before CI-hardening

1. ~~**Cascade / orphan DB test**~~ — closed for the session-archive and enrollment paths
   (`examinationIntegrityDb`, `examinationSubsystemsDb`); the rollover path is item 2.
2. **Session-rollover × exams DB test** — promote with finalised exams; results preserved, completion
   still gated, completed session cannot be re-opened.
3. **Route-level lock test** — real eligibility + persist behind `fastify.inject` (409), and a
   route-level wrong-section 403 (unit mock today).
4. **E2E smoke** — enter marks → save → publish → grid locked → print preview has `dir="rtl"`.
5. **CI ratchets** — coverage floor (`packages/shared/src/examinations/**` ≥90% lines), and
   `check:tdd-pairing --strict` for `use-cases/`.

## Non-goals

Result status enums (Present/Absent/Exempted/Disqualified/Withheld), assessment types and
multi-component weightages are **not modelled**; their tests belong to the change that introduces the
model, not to this suite.
