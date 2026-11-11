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
| Soft-delete of a **session** hides/keeps exam data predictably | ⚠️ **required next** | behaviour unproven (no cascade on `exams`) |
| Session rollover × finalized exams | ⚠️ **required next** | no test; `findOwningSessionStatuses` only unit/DB-adjacent |

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

## Gaps to close before CI-hardening

1. **Cascade / orphan DB test** — archive a session, student and enrollment; assert what happens to
   exams, marks, overrides and eligibility, and that every read filters or cascades deliberately.
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
