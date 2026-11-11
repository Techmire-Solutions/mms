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
1. **Route-injection backlog** — close remaining baselined paths; `PUT /exams/bulk` is now covered
   (contract path serves the UI save).
2. **Result status model (D1)** — migration 0238, shared enum/DTOs, engine semantics
   (`countsTowardStats`), persist/audit, analytics denominators, exports/print, grid selector, i18n, tests.
3. **Assessment type metadata (D2)** — migration 0239, form/filter/export, tests.
4. **Workspace grade bands (D3)** — migration 0240, audited setup writes, shared resolver,
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
