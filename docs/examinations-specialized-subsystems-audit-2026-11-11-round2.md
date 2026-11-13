# Examinations Specialized Subsystems — Round 2 (2026-11-11)

**Scope.** The grade/weightage/rank engine, the eligibility gate (attendance + finance/enrollments),
and moderation/supplementary exams, plus the recalculation risks that connect them.

**Method.** Read the shared scoring engine, every frontend surface that scores or ranks (results
grid, reports controller, single/term report card, certificate), the batched eligibility SQL and its
countable-attendance predicate, the gate/submission use cases, the moderation adapter, the analytics
and report SQL, and the trigger definitions from 0236/0237. Re-ran the eligibility and integrity DB
suites against real PostgreSQL. Two claims in the first specialized-subsystems audit are corrected
here: the multi-session threshold was `MIN` (most lenient), not "strictest", and the term report card
printed a single-exam rank as a term position.

## Brief assumptions vs. reality

| Brief | Reality |
|---|---|
| Written/Oral/Hifz/Practical/Coursework weighted into a subject score | **No component/weightage model.** A multi-component subject is several `exams` rows; only the term report card sums them, implicitly weighted by `total_marks`. Question-bank sections are not linked to `exams`. |
| Letter grades | Shared `GRADE_BANDS` + `resolveResultScore`; a failed paper floors to `F`. |
| GPA | **Absent.** `gradingSystem` accepts `"gpa"` in the settings DTO; nothing computes or prints a grade point. |
| Ties in class rank/positions | Competition ranking (`1,1,3`) with a deterministic tie-break; the engine is correct, but the reports controller ranked rounded values (A1) and the term card printed the wrong rank (A3). |
| Attendance threshold gating | Implemented (eligibility view flag, marks-save gate, audited override). The multi-session fallback used `MIN` — most lenient (B1, fixed). |
| Finance/enrollment holds | **No integration.** `finance_invoices` (`status`, `dueDate`) and `enrollments.payment_status` exist; nothing joins them, so no student is ever held. |
| Admit cards | **No surface** — no template, endpoint or payload. |
| Grace marks | Implemented and audited (raw mark preserved, effective bound, OCC, publication lock). |
| Curve adjustments | **Absent** — only per-mark grace. |
| Supplementary re-sit without losing attempt 1 | **No attempt model.** A same-exam re-sit overwrites the single row (unique `(exam,student)`; history only in audit JSON); a new-exam re-sit double-counts in the term card and analytics; `allowRetake` is inert. |

## Verified sound

- The scoring engine is the single source of truth: effective marks (raw + grace), raw-score grading,
  fail floor, 2-dp/display rounding, zero-total guard; analytics buckets come from the same
  `GRADE_BANDS` and pass math uses effective marks; session completion uses `marks + grace >= pass`.
- Ranking: ties share the better rank, the tie-break is deterministic, per-class and overall
  positions are distinct, and the grid ranks by effective marks.
- Moderation: audited grace, required reason, effective ≤ total, version bump, and published /
  archived / cancelled exams refuse the write; scoring-frame changes are audited on the live bulk
  save path.
- Eligibility roster is the seat-holding enrollment set on both the server and the grid; the gate is
  batched; overrides are audited and revocable; unknown attendance fails closed.
- Teacher section scope is batched (no per-row query).

## Findings

### A · Grade, weightage & rank

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| A1 | **P1** | `useAcademicReportController.ts` (pre-fix) | Reports ranked by the 2-dp `percentage`, and the class leaderboard sorted/averaged the integer `displayPercentage` — distinct scores collapsed into artificial ties and averages drifted. | **Fixed** — pure helpers rank/average the unrounded raw percentage ([`academicReportRanking.ts`](../apps/frontend/src/tenant/features/reports/lib/academicReportRanking.ts)); 6 tests pin near-equal/no-tie, ties, grace, raw averages and top student |
| A2 | **P1** | [`reportCardPayload.ts:120`](../apps/frontend/src/tenant/features/examinations/lib/reportCardPayload.ts) | The term card scored each subject with `passingMarks: 0`, losing the fail floor: 55 % on a 60-pass paper printed `D` on the card but `F` in the grid. | **Fixed** — each paper is scored with `exam.passingMarks` and its `score.grade`; test added |
| A3 | **P2** | [`reportCardPayload.ts:156`](../apps/frontend/src/tenant/features/examinations/lib/reportCardPayload.ts); `TermReportCardModal.tsx` | The term card aggregated selected papers but printed the **current single exam's** `classRank`/`classSize`; the "term position" changed with the paper selection. | **Fixed** — the term payload no longer carries rank/classSize; a real cohort term rank is deferred (R6) |
| A4 | **P2** | `reportCardPayload.ts:128-150`; `examinationRepositoryAnalytics.ts:83-92` | Inconsistent weighting definitions: the term card weights by `total_marks` (sum/sum) while analytics averages per-exam percentages unweighted; no component model; no GPA despite `gradingSystem: "gpa"`. | **Documented** — R5 (components + GPA bands) and R7 (analytics weighting definition) |
| A5 | **P2** | `useExaminationsApi.ts:60-93`; `useExaminationsPageController.ts:60` | The client marks walk caps at 20×500 and returned `hasMore: true`, but the page controller discarded it — rankings/averages were presented as complete on a truncated set. | **Fixed** — `resultsTruncated` flows to the view, which shows a notice and hides stats/rankings (i18n in en/ar/ur/fa); test added. The reports page has the same issue (R8) |
| A6 | P3 | [`useResultsViewData.ts:123`](../apps/frontend/src/tenant/features/examinations/hooks/useResultsViewData.ts) | The grid average summed the 2-dp `percentage` while its comment claimed raw percentages. | **Fixed** — sums `rawPercentage`, rounds once |
| A7 | P3 | [`resultScoring.ts:202`](../packages/shared/src/examinations/resultScoring.ts) | Two ordinal implementations (`getRankSuffix`, dead `ordinalPosition`). | **Fixed** — `ordinalPosition` delegates to the single `getRankSuffix` |
| A8 | P3 | `useResultsViewData.ts` (class map) | A student with a result but no active enrollment gets `classId ""` and is ranked in a pseudo-class; overall rank remains correct. | **Documented** |

### B · Eligibility gating

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| B1 | **P1** | [`examEligibilityBatchRepository.ts:46`](../apps/backend/src/db/repositories/examEligibilityBatchRepository.ts) | The multi-session fallback was `MIN(s.min_attendance_pct)` — the **least strict** requirement (60 % let a 65 % student pass even when another owning session required 75 %), and a 0-threshold session diluted it. | **Fixed** — `MAX(NULLIF(session, 0))` (exam's own value wins; 0 disables it); DB test covers a 60/75 multi-session exam and a 0 session |
| B2 | **P1** | eligibility SQL; `finance.ts:26,35-36`; `enrollments.ts:63` | No finance/obligation hold is queried: unpaid or overdue invoices never flag or block a student, and there is no admit-card surface to block. | **Documented** — R1 (holds) and R2 (admit cards); the data needed (`finance_invoices.student_id/status/due_date`, `enrollments.payment_status`) exists |
| B3 | P2 | `useEnterMarksStudents.ts`; `EnterMarks.tsx` | The marks grid shows every seat-holding student without an eligibility badge; the batch save fails wholesale at the end (409 with names) instead of flagging/skipping blocked rows. | **Documented** — R9 |
| B4 | P2 | `attendance/examEligibility.ts:44-64` | "Unknown" attendance (no countable days yet) blocks the whole batch; the only escape is an admin override. | **Documented** (deliberate fail-closed; teacher-facing path is R9) |
| B5 | P2 | [`examEligibilityBatchRepository.ts:103-146`](../apps/backend/src/db/repositories/examEligibilityBatchRepository.ts) | The gate counts the whole enrollment window, not attendance up to the exam date; late-recorded attendance retroactively changes eligibility for an exam already sat. | **Documented** — R10 (product decision) |
| B6 | P2 | eligibility SQL; `examResultsSubmission.ts` | Calculation bottleneck: one `LATERAL` aggregate **per roster row** whose countable predicate runs correlated calendar/leave/working-day subqueries per attendance row, recomputed per exam in a multi-exam batch; the submission loaded the exams twice. | **Fixed** — grouped CTE keyed by distinct enrollment windows (attendance aggregated once, see [`examEligibilityBatchRepository.ts:103`](../apps/backend/src/db/repositories/examEligibilityBatchRepository.ts)) and one shared exam load into the gate. DB suite pins the semantics, including a two-exam shared-class batch |
| B7 | P3 | `finance.ts` | The hold policy has no owner/decision (which dues, whether marks or only admit cards are blocked, whether the override clears it). | **Documented** — R1 |

### C · Moderation, supplementary & recalculation

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| C1 | **P1** | `0236_exams_results_integrity.sql:124-151` | `exams_guard_total_marks` compared `max(marks_obtained)` only: lowering the total below `marks + grace` was accepted (the marks-bounds trigger does not fire on an exam update), leaving a moderated effective score above the total; percentages then clamped to 100. | **Fixed** — migration [`0239_exam_total_guard_effective_score.sql`](../apps/backend/src/db/migrations_drizzle/0239_exam_total_guard_effective_score.sql) compares the effective score; DB test (58 + 5 grace vs total 60 → `23514`; 63 allowed) |
| C2 | P2 | `0048`/`0222` unique index; `examResultUpsert.ts` | No supplementary/attempt model: a same-exam re-sit overwrites the only row; a new-exam re-sit double-counts in the term card/analytics; `allowRetake` is inert. | **Documented** — R3 (attempt schema + resolution rule) |
| C3 | P2 | `examinationResultModeration.ts` | No exam-level curve; a cohort-wide adjustment requires moderating every row. | **Documented** — R4 |
| C4 | P2 | `TermReportCardModal.tsx` (pre-fix) | The default paper selection matched only the exam **name**, so a previous year's identically named exam was preselected into the same "term". | **Fixed** — `initialTermPaperSelection` filters by name **and calendar year** ([`studentExamPapers.ts:52`](../apps/frontend/src/tenant/features/examinations/lib/studentExamPapers.ts)); test added |
| C5 | P3 | — | No stored result snapshot; grades/ranks recompute on read (good for recalculation, but printed artifacts depend on the live exam frame; publication freezes edits). | **Documented** |

## Implemented in this change set

- `academicReportRanking.ts` + rewired `useAcademicReportController` (raw ranking/averages) with 6
  tests.
- Term report card: per-subject pass mark, one scoring pass per paper, no single-exam rank; year-
  scoped initial paper selection (shared helper + tests).
- Grid average uses raw percentages; the reports page keeps its own truncation gap (R8).
- Truncation surfacing: `resultsTruncated` controller→tier→view, notice + hidden stats/rankings,
  `examinations.resultsTruncated` in four locales, view test.
- Single ordinal implementation.
- Eligibility: strictest non-zero session threshold; grouped attendance CTE + one shared exam load;
  DB tests (strictest threshold, zero-session no-dilution, two-exam shared-class parity).
- Migration 0239: effective-score total guard (+ snapshot/journal, roadmap renumber) and a DB test.

## Deferred, decision-ready

### R1 · Finance holds (B2/B7)
Policy `examFinanceHoldPolicy: none | overdue_invoices | any_open_invoice` (workspace setting).
Compute `EXISTS (SELECT 1 FROM finance_invoices fi WHERE fi.workspace_subdomain = … AND
fi.student_id = … AND fi.deleted_at IS NULL AND fi.status NOT IN ('paid','cancelled')
AND fi.due_date < current_date)` (optionally also `enrollments.payment_status = 'pending'`). Expose
`hold: { kind: "finance"; invoiceCount; oldestDueDate; amountDue }` on each eligibility row and a
`state: "blocked"` reason. The existing audited `exam_eligibility_overrides` is the escape hatch
(extend its reason vocabulary). Decide: block marks entry, admit cards, or both (recommend admit-card
only, with a marks warning).

### R2 · Admit cards (B2)
Reuse the eligibility view filtered to `state === "eligible"`, a `GET /exams/:id/admit-cards`
endpoint batched by class, a document-template key and browser print per student / capped server
batch by class (D4 in `examinations-open-decisions.md`). Blocked and finance-held students are
excluded and listed as "not cleared".

### R3 · Supplementary attempts (C2)
`exam_results.attempt_no` + unique `(workspace, exam, student, attempt_no)`, `attempt_status`
(`scheduled | present | absent | void`), `superseded_by_result_id`; a re-sit entry path that creates
a new attempt; resolution rule "highest active attempt is authoritative, every attempt retained";
report/term/analytics resolution dedups by resolved attempt; `allowRetake` gates entry.

### R4 · Curve adjustments (C3)
An audited exam-level curve (additive offset or target-mean scale) on the exam, applied in
`resolveResultScore` after grace, publication-locked, and re-graded on read; per-mark grace remains
for individual cases.

### R5 · Component weightage / GPA (A4)
Subject components (`exam_components`: exam group, component kind, weight, max marks) or weighted
paper groups, plus a workspace grade-band table with `grade_point` and a credit/weight source;
server-side GPA. Ties to the D2/D3 roadmap.

### R6 · Term rank (A3)
A cohort aggregate over the selected paper ids (effective marks / total marks), ranked per class;
the card then prints a true term position. Until then it prints none.

### R7 · Analytics weighting (A4)
Define top performers/section averages as marks-weighted (or document the equal-exam definition) and
align them with the term card's weighting.

### R8 · Reports-page truncation (A5)
Surface `hasMore` in `useAcademicReportController` the same way the examinations view now does.

### R9 · Marks-grid eligibility flags (B3/B4)
Fetch the eligibility view for the selected exam, badge blocked/unknown rows, and exclude them from
the save batch (the backend gate remains authoritative).

### R10 · Attendance window (B5)
Decide "attendance up to the exam date" vs "whole enrollment window"; if the former, bound the
aggregate by `exams.date` and re-run the eligibility DB suite.

### R11 · Server-side rank/aggregate
An endpoint returning per-exam ranks/positions removes the client page walk and the 10k truncation
from the results and reports surfaces.

## Edge cases & failure modes

- A re-sit entered as a new exam and selected with the original double-counts the term totals — R3;
  the rows are visible on the card, not hidden.
- An exam with `passing_marks = 0` keeps band-only grading (the fail floor only changes exams with a
  real pass mark).
- Truncated marks hide stats/rankings but keep the marks table; certificates are reachable only from
  the hidden rankings list.
- The strictest threshold is computed from sessions that own the exam's classes; an exam's own 0
  deliberately disables the gate even when a session requires one.
- Lowering a total below an effective score now fails the whole bulk save (400 via `23514`); the
  moderation must be reduced or the marks corrected first.
- The grouped eligibility CTE keeps zero-attendance students as `unknown` (LEFT JOIN) and withdrawn
  students off the roster.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter @mms/shared test
pnpm --filter mms-frontend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts \
  src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts
node scripts/check-migration-indexes.mjs
node scripts/check-migration-hygiene.mjs
node scripts/check-migrations-forward-only.mjs --base HEAD
node scripts/check-examinations-test-matrix.mjs
node scripts/check-docs.mjs
pnpm check:i18n
```
