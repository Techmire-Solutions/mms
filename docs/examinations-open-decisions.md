# Examinations — Open Decisions & Remaining Plan

Decisions taken 2026-11-11 for the deferred work; each phase is implemented and verified before the
next starts.

## Decided

| ID | Decision |
|---|---|
| D1 | Result statuses `present/absent/exempt/withheld/disqualified`; **absent & disqualified count as failures** in pass rates and rankings; **exempt & withheld are excluded** from pass rates, rankings and averages; codes `AB/EX/WH/DQ` print on cards. |
| D2 | Assessment type is **metadata only** (`exam/quiz/assignment/project/oral/practical`); no weighted components. |
| D3 | Grading bands are **workspace-wide configurable**, consumed by the scoring engine, analytics and imports (default = current `GRADE_BANDS`). |
| D4 | Documents: **browser print per student**; **server batch admit cards by class** in capped chunks. Transcripts reuse the report-card template. |
| D5 | Trashing a **session hides** its exams from lists/reports; marks and exams are retained and re-shown on restore. |
| D6 | Commit the applied work first, then phases **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7**. |

## Phases

0. **Housekeeping** — this document, commits of the applied work, local-DB 0217 note.
   Migrations `0238` (persistence round 2: paper checks, section FK, paper-result uniqueness,
   published-exam guard, index truth-up) and `0239` (effective-score total guard) are taken; the
   phases below shift up so the journal stays monotonic.
1. **Route-injection backlog** — close remaining baselined paths; `PUT /exams/bulk` is now covered
   (contract path serves the UI save).
2. **Result status model (D1)** — migration 0240, shared enum/DTOs, engine semantics
   (`countsTowardStats`), persist/audit, analytics denominators, exports/print, grid selector, i18n, tests.
3. **Assessment type metadata (D2)** — migration 0241, form/filter/export, tests.
4. **Workspace grade bands (D3)** — migration 0242, audited setup writes, shared resolver,
   parameterised analytics SQL, editor validation, tests.
5. **Admit cards (D4)** — payload/mapper/field catalog/default layout, per-student print, capped
   batch job; transcripts stay on the report-card template. Spike first on batch PDF mechanics.
6. **Session-archive hiding (D5)** — shared visibility predicate in list/page/report/widget/completion
   reads, tests with archived/restored session.
7. **Hardening** — DB-backed route harness for tenant scope, E2E smoke, backend coverage
   thresholds, repository TDD pairing once specs pair by name.

## Acceptance per phase

`pnpm typecheck`, targeted unit + DB suites, `ci:local` (ratchets, prettier, structure), docs updated,
test-matrix and route-injection ratchets extended where applicable, no new baseline entries.

## Open after the persistence round-2 audit (2026-11-11)

These are recorded, **not decided**; each is referenced by an F-number in
[`examinations-schema-persistence-audit-2026-11-11-round2.md`](./examinations-schema-persistence-audit-2026-11-11-round2.md).

| ID | Open question | Notes |
|---|---|---|
| O1 | Exam room / timetable conflict detection (F14) | The schema cannot express it: `exams` has no room or start/end time and timetable periods store `start_time`/`end_time` as `varchar(20)` with no room/date. Target DDL (rooms on exams, a `tstzrange` exclusion, `time` + date/room on periods) is in the round-2 audit; it needs an exam-scheduling UI and a normalized room scope before it is worth applying. |
| O2 | Paper attempts (F8) | `assessment_results` is now limited to one **active** result per `(test, student)`. There is no attempt column anywhere; if retakes become a product requirement, add `attempt_no` to the unique key and the DTOs rather than dropping the guard. |
| O3 | `assessment_results.submitted_at` retype | Currently `varchar(30)` with a 0238 ISO-shape check. Convert to `timestamptz` with a 0172-style reject table once every writer emits a parseable timestamp. |
| O4 | Redundant index removal (F16) | `assessment_results_workspace_subdomain_idx` and `exam_results_workspace_subdomain_idx` duplicate their PK prefixes. Drops are recorded in the round-2 audit; left in place to keep that change additive. |

## Decided in the domain/lifecycle round 2 (2026-11-11)

| ID | Decision |
|---|---|
| DL1 | Publication requires the exam to have been sat (`ongoing`/`completed`); an `upcoming`/`scheduled` exam is refused with `exam_not_sat`. |
| DL2 | The administrative unlock clears the stamp **and** returns the status to `ongoing`, so an unpublished exam never reads as finalized. |
| DL3 | Soft-deleted (archived) exams are read-only through every save path until restored. |
| DL4 | The finalize compare-and-set evaluates the publishable/unlockable state (archived, status, completed owning session) in the same `UPDATE`. |
| DL5 | The marks bulk route uses the strict `examMarksWriteListSchema` — no default-zero, no moderation fields. |
| DL6 | The queued marks import runs the attendance/roster/override gate; teacher section scope for imports remains open (R2). |
| DL7 | Moderation validation and the effective-score bound live in `examinations/domain/moderation.ts`, not the Drizzle adapter. |

## Open from the domain/lifecycle round 2

R1 (tenant-explicit use cases), R2 (import authority), R3 (single registration surface), R4 (domain
error types), R5 (DB publication lock on mark rows), R6 (absent/exempt/withheld), R7 (score-formula
SQL SSOT), R8 (7-state workflow), R9 (recovery + create-status policy) and R10 (server-side grade +
dead preferences) are recorded with concrete steps in
[`examinations-domain-lifecycle-audit-2026-11-11-round2.md`](./examinations-domain-lifecycle-audit-2026-11-11-round2.md).

## Decided in the specialized-subsystems round 2 (2026-11-11)

| ID | Decision |
|---|---|
| DS1 | Ranking and class averages compare the **unrounded** raw percentage; display integers are never used for comparisons. |
| DS2 | A term report card scores each paper with the exam's own pass mark (fail floor) and prints **no** rank/classSize until a real cohort term rank exists. |
| DS3 | The term report card's default paper selection is the current exam's name **within the same calendar year**. |
| DS4 | A multi-session exam without its own attendance gate uses the **highest non-zero** session requirement; a session's 0 does not dilute it. |
| DS5 | Lowering `exams.total_marks` may not fall below the highest **effective** score (`marks + grace`); migration 0239. |
| DS6 | A truncated marks walk (>10,000 marks) hides rankings/averages behind a notice instead of presenting them as complete. |

## Open from the specialized-subsystems round 2

R1 (finance holds), R2 (admit cards), R3 (supplementary attempts), R4 (curves), R5 (component
weightage/GPA), R6 (term rank), R7 (analytics weighting), R8 (reports-page truncation), R9 (marks-grid
eligibility flags), R10 (attendance window) and R11 (server-side rank/aggregates) are recorded with
concrete designs in
[`examinations-specialized-subsystems-audit-2026-11-11-round2.md`](./examinations-specialized-subsystems-audit-2026-11-11-round2.md).

## Decided in the API/serialization audit (2026-11-11)

| ID | Decision |
|---|---|
| DS7 | Every examination path declares `pathParams`; ids are trimmed and length-capped (`id` ≤128, `studentId` ≤64) before a handler runs. |
| DS8 | `GET /exams` uses a strict query schema: comma-separated status enum, sort-field enum, page/limit bounds; unknown keys are a 400. |
| DS9 | `PUT /exams/bulk` validates the mutable surface (ISO date, name, positive totals, passing ≤ total, class cap); read-only metadata is accepted for the list→save round-trip and never written, and an invalid date is a 400 (never a silent NULL). |
| DS10 | One error-mapping seam (`mapDomainError` + `mapConstraintError`) is used by contract, gate and legacy routes; domain errors carry `details`/`violations` and PostgreSQL constraints map to 400/409. |
| DS11 | The broadsheet export obeys the marks list's publication boundary: a non-grader exports published exams only, without the grace column; an unpublished exam is a 404. |
| DS12 | Report aggregates apply `publishedOnly` for callers who cannot grade, matching the results list. |

## Open from the API/serialization audit

R12 (exam timetable/room allocation), R13 (student/guardian results endpoint) and R14 (finish moving
plain handlers into the ts-rest router with a parity ratchet) are recorded in
[`examinations-api-serialization-audit-2026-11-11.md`](./examinations-api-serialization-audit-2026-11-11.md).
