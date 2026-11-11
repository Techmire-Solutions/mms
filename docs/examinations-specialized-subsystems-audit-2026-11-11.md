# Examinations Specialized Subsystems & API Audit — 2026-11-11

**Scope:** the grade/weightage/rank engine, exam eligibility gating (attendance + money), moderation
and supplementary exams, the Fastify/ts-rest API layer, error mapping, and serialization/privacy of
marks.

**Method:** read every surface that computes a score or a decision (results grid, reports
controller, report card, certificate, marks row), the eligibility SQL and gate, the contract and
legacy route factories, the module-access and RBAC maps, and the bulk/soft-delete routers. Verified
against PostgreSQL with two real-DB suites
([`examinationIntegrityDb`](../apps/backend/src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts),
[`examinationSubsystemsDb`](../apps/backend/src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts)).

**Overall finding:** the individual screens were each internally consistent, but **the same result
was scored four different ways**, eligibility used **three different roster definitions**, a re-sit
necessarily **overwrote the only mark row**, and the API layer returned **500 for domain conflicts**
while silently **truncating broadsheets at 500 rows**. All P0/P1 items are fixed; attempts and
finance holds are designed, not built.

---

## A · Grade, weightage & rank

| # | Severity | Finding | Status |
|---|---|---|---|
| A1 | P0 | Four independent score computations, two rounding policies: the grid rounded to an integer before grading but compared raw marks for pass/fail; the report card graded the **unrounded** percentage. `89.5%` was `A+` on screen and `A` on paper. | **Fixed** — one `resolveResultScore` |
| A2 | P0 | Pass/fail had two definitions: `getGrade` puts F below 50 (hardcoded) while `passed` used `exams.passing_marks`; reports hardcoded 50 outright. A 45% student on a 40-mark pass was "passed, grade F". | **Fixed** — grade floor: a fail is F |
| A3 | P0 | Rank ignored ties: sorted by marks then `rank = index + 1`, tie order followed `exam_results.id`. | **Fixed** — competition ranking (1, 1, 3) + deterministic tie-break |
| A4 | P0 | "Class rank" was the exam-wide rank; the drawer and certificate printed it as a class position. | **Fixed** — `rankInExam` returns overall + per-class |
| A5 | P1 | Reports ranked every result across all exams by a rounded percentage; a 90% quiz outranked an 89% final. | **Fixed** — rank per exam |
| A6 | P1 | Printed report cards had no position field. | **Fixed** — `rank`/`classSize` on the payload |
| A7 | P1 | No weightage/component model: `exams` is flat; Written/Oral/Practical exist only in the Question Bank with no link. | **Documented** (§deferred) |
| A8 | P1 | Division by `totalMarks` was unguarded → `Infinity` → grade `A+`. | **Fixed** — zero total scores 0/F |
| A9 | P2 | Class average was a mean of already-rounded percentages. | **Fixed** — averaged raw, rounded once |

**Engine:** [`resultScoring.ts`](../packages/shared/src/examinations/resultScoring.ts) —
`resolveResultScore` (raw-score percentage, 2-dp + integer display values, grade, pass/fail, grace),
`rankResults`, `rankInExam`, `ordinalPosition`. Every surface now calls it: results grid
(`useResultsViewData`), marks row, reports controller, report card (single + term), certificate,
term report card.

## B · Eligibility gating

| # | Severity | Finding | Status |
|---|---|---|---|
| B1 | P0 | Three rosters: the grid listed every live enrollment, the `notEnrolled` check ignored status, and the eligibility view excluded withdrawn students — so a withdrawn student could be graded while having **no eligibility row**, and the gate silently `continue`d. | **Fixed** — one seat-holding roster (`enrollmentHoldsSeat`), missing row ⇒ `exam_student_not_enrolled` |
| B2 | P0 | No finance/obligation hold integration anywhere. | **Documented** (§deferred) |
| B3 | P1 | No admit-card surface (no template, endpoint or payload). | **Documented** |
| B4 | P1 | The gate ran only in the bulk route's `beforeSave`. | **Documented** — single-row `saveExamResult` is not routed |
| B5 | P1 | `exams.min_attendance_pct` was `smallint` while the API accepted decimals and attendance is one-decimal — a configured **74.5 was stored as 75**. | **Fixed** — `numeric(5,2)` (0237), DB-tested |
| B6 | P1 | N+1: `assertExamResultsEligible` issued ≈6–7 queries **per exam** on every marks save. | **Fixed** — 2 queries per batch |
| B7 | P2 | A multi-session exam took an arbitrary `LIMIT 1` session threshold. | **Fixed** — `MIN` (strictest) |

## C · Moderation & supplementary

| # | Severity | Finding | Status |
|---|---|---|---|
| C1 | P0 | No grace marks, curve or moderation anywhere. | **Grace fixed**; curve documented |
| C2 | P0 | A re-sit overwrites the only mark: unique `(exam, student)` + natural-key upsert. Historical attempts are only recoverable from audit JSON. | **Documented** — attempt model below |
| C3 | P1 | No moderation metadata on a mark. | **Fixed** — `grace_marks`, `moderation_reason`, `moderated_by/at`, audited |
| C4 | P1 | Changing `total_marks` / `passing_marks` re-grades every student and emitted **no audit event**. | **Fixed** — scoring-frame delta audited in the same transaction |
| C5 | P2 | No stored result snapshot; grade thresholds are code constants. | **Documented** |

**Grace model:** `marks_obtained` is never rewritten. `grace_marks` is stored beside it, bounded by
`marks_obtained + grace_marks ≤ exams.total_marks` (app check **and** the 0237 trigger), requires a
reason, carries the moderator, bumps `version` (so a stale gradebook save 409s), and is refused on
published/archived exams. Every pass computation uses effective marks: session completion, report
comparisons, monthly report, command metrics.

**Endpoint:** `POST /api/examinations/exams/:id/results/:studentId/moderation`.

## D · API layer, error mapping & privacy

| # | Severity | Finding | Status |
|---|---|---|---|
| D1 | P0 | Five contract handlers swallowed every domain error into `500` (including the new "published exam cannot be deleted" 409). | **Fixed** — `handleContractError` everywhere |
| D2 | P0 | No module route-action rules for examinations: trash/restore resolved to `write` (a `delete`-only role could not trash, any writer could), publication required only `write`, and `POST /export/csv` required `write`. | **Fixed** — explicit rules |
| D3 | P0 | `GET /results` was unpaginated and **silently truncated at 500 rows**; every rank/average/certificate used an arbitrary subset. | **Fixed** — `examId`/`studentId` filters + keyset `cursor`/`limit` + `hasMore`; the client pages through |
| D4 | P0 | No publication gate on the marks read; the DTO exposes `markedBy`/`version` (and now moderation fields). | **Fixed for read-only audiences** — anyone who cannot grade only receives marks from published exams (`publishedOnly` join), DB-tested; a student/guardian projection without internal fields remains deferred |
| D5 | P1 | Contract `bulkIds` was uncapped/unstrict while the enforced shared schema caps at 500. | **Fixed** — `bulkStringIdsBodySchema` |
| D6 | P1 | Constraint rejections returned `500 database_error` (`23514`, `23503`, `22001`, `22P02`). | **Fixed** — mapped to 400/409 |
| D7 | P1 | Exam permissions were mapped to `students.read/write`, so every handler required a **students** grant. | **Fixed** — `examinations.read/write/delete` |
| D8 | P1 | Contract declared `getLookups`/`getLookupKind` with `z.unknown()` responses and no implementation. | **Fixed** — removed |
| D9 | P2 | `listResults` query was `z.object({})`; path params inferred without constraints. | **Fixed** for results; gate params still inferred |

## Delivered

- `packages/shared/src/examinations/resultScoring.ts` (+ 8 tests), moderation DTO/contract route,
  results page envelope + query schema, capped bulk ids, module permissions.
- Migration `0237_exam_scoring_moderation.sql` (+ snapshot/journal): attendance threshold `numeric(5,2)`,
  moderation columns/checks, effective-score bounds trigger.
- Batched eligibility (`loadExamEligibilityBatch`) + seat-holding roster on both sides.
- Effective-mark pass computations; scoring-frame audit; PG error mapping; route-action rules;
  contract error preservation; paginated marks; grace UI (drawer) + badge; class positions.

## Deferred (designs in this document)

1. **Attempts / supplementary re-sits** — `exam_results.attempt_no` + unique
   `(workspace, exam, student, attempt_no)`, `superseded_by_result_id`, `attempt_status`, and the
   rule "highest active attempt is authoritative, every attempt retained". Requires a re-sit entry
   path and report resolution.
2. **Finance holds** — a `holdsForStudent` policy over open invoices/obligations surfaced as a flag
   in the eligibility view/gate, with the existing audited override as the escape hatch. Needs a
   product decision on which dues block admission.
3. **Admit cards** — document template key + roster endpoint reusing the batched eligibility view.
4. **Student/guardian projection** — publication-filtered, no `markedBy`/`version`/moderation fields.
5. **Component weightage** — needs a component table or weighted papers; today a multi-component
   subject is several exam rows summed by total marks.
6. **Server-authoritative rank/transcript** — rank/grade stay client-computed from the shared engine.

## Verification

```bash
pnpm typecheck
pnpm --filter @mms/shared test -- resultScoring examLifecycle
pnpm --filter mms-backend test -- examEligibilityGateBatch examModeration examLifecycleUseCases examResultUpsert
pnpm --filter mms-backend test:db -- src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts
node scripts/check-migration-indexes.mjs && node scripts/check-migration-hygiene.mjs
node scripts/check-code-norms.mjs && node scripts/check-docs.mjs && pnpm check:i18n
```
