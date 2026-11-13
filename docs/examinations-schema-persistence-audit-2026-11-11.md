# Examinations Schema & Persistence Audit — 2026-11-11

> **Round 2 (same day):** the residual gaps after 0237 — restore fidelity and provenance, the
> publish/unpublish CAS race, the marks importer's OCC bypass, paper/section constraints, the
> declared-vs-physical schema drift and the missing database-level published-exam guard — are
> audited and fixed in
> [examinations-schema-persistence-audit-2026-11-11-round2.md](./examinations-schema-persistence-audit-2026-11-11-round2.md)
> (migration 0238).

**Scope:** the Examinations persistence layer — Drizzle table definitions (`exams`, `exam_classes`,
`exam_results`, `exam_eligibility_overrides`), the migration history that shaped them
(0048 → 0236), the unique/partial indexes, the foreign-key graph into sessions, terms, classes,
sections, subjects and students, mark precision, soft-delete coverage, and the marks upsert
(optimistic concurrency, finalization lock, audit trail).

**Method:** read [`examinationExamTables.ts`](../apps/backend/src/db/schema/examinationExamTables.ts),
every migration touching those tables (`0048`, `0068`, `0076`, `0091`, `0104`, `0108`, `0166`,
`0171`, `0207`, `0222`), the `0235` Drizzle snapshot, both repository modules and their callers,
the shared DTOs, the entry grid, and the CI ratchets
(`scripts/check-migration-indexes.mjs`, `scripts/check-migration-hygiene.mjs`). Verified against
PostgreSQL semantics with a new real-Postgres suite
([`examinationIntegrityDb.integration.test.ts`](../apps/backend/src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts), 12 cases).

**Overall finding:** the table *shapes* were sound — composite tenant keys, FORCE RLS, a natural-key
unique index and a partial-index soft-delete trio on `exams`. The defects were at the **seams**:
the marks upsert arbitrated on the surrogate `id` while the integrity index is `(exam, student)`;
mark records had no concurrency token and no audit trail; the unique index could be silently absent
because 0222 only *warned* about duplicates; `marks_obtained` was an integer while the UI asks for
decimals; and the "mark ≤ exam total" invariant lived only in the request that happened to run the
app guard. All P0/P1 items are fixed in migration **0236** plus the persistence rewrite described
below.

## Brief → code mapping

| Brief | Actual schema |
|---|---|
| `tenant_id` | `workspace_subdomain` — composite tenant key + FORCE RLS on every table |
| `student_marks` | `exam_results` |
| `exam_papers` | `tests` (Question Bank module; labelled "Exam Papers" in the UI) |
| `grading_scales` | **no table, no column** — `gradingSystem` is a module-setup preference and the letter table is hardcoded in `@mms/shared` (see the domain/lifecycle audit) |
| `terms` | `session_categories` via `sessions.category_id` — there is no `terms` table |
| `sections` | `session_sections`, `session_classes` |
| exam → session | indirect only: `exams → exam_classes → session_classes → sessions` (an exam with no class rows is invisible to completion) |

## Index inventory

`exams`: `exams_workspace_subject_idx`, `exams_workspace_date_idx`, `exams_workspace_status_idx`,
`exams_workspace_deleted_idx`, `exams_workspace_updated_at_active_idx` (active),
`exams_workspace_active_idx` (active), `exams_workspace_deleted_records_idx` (deleted only).

`exam_results` (after 0236): `exam_results_workspace_exam_student_uidx` (unique),
`exam_results_workspace_student_idx`. Dropped: `exam_results_workspace_exam_idx` — an exact prefix
duplicate of the unique index.

`exam_classes`: PK `(workspace, exam_id, class_id)`, `exam_classes_workspace_class_idx` (FK support).

## Findings

### F1 · **P0** · Mark records had no optimistic concurrency
`exam_results` had no `version` column and the upsert wrote `marks_obtained` unconditionally
([`examinationResultsRepository.ts:95-104`](../apps/backend/src/db/repositories/examinationResultsRepository.ts)).
Two examiners saving the same roster: the later write silently replaced the earlier scores.
**Fixed:** `exam_results.version` (0236) + `setWhere` OCC predicate
([`examResultUpsert.ts`](../apps/backend/src/db/repositories/examResultUpsert.ts)) mirroring the
Attendance pattern; a stale save returns **409 `stale_write`** and writes nothing.
**Verified:** DB suite — "increments version on every write and refuses a stale token",
"writes the whole batch or nothing when one row is stale".

### F2 · **P0** · The upsert arbiter was not the integrity key
[`:96`](../apps/backend/src/db/repositories/examinationResultsRepository.ts) targeted
`(workspace, id)`; the unique index is `(workspace, exam_id, student_id)` (0222). This only worked
because the frontend derives `er_${exam}_${student}`; any other writer (import, repair, legacy
path, a future client) hit `23505` → 500 instead of an update.
**Fixed:** the natural key is the `ON CONFLICT` target; rows are deduped and sorted by it (dedupe
avoids `21000`, ordering avoids `40P01`); a primary-key collision is mapped to
`409 exam_result_id_conflict`.
**Verified:** DB suite — "arbitrates on (exam, student), so a new id updates the existing row".

### F3 · **P0** · The 0222 unique index could be silently absent
[`0222_exam_attendance_gate.sql:75-92`](../apps/backend/src/db/migrations_drizzle/0222_exam_attendance_gate.sql)
created `exam_results_workspace_exam_student_uidx` only when no duplicate groups existed, and
otherwise `RAISE WARNING`. A database that had duplicates therefore kept allowing them, and nothing
since has checked.
**Fixed:** 0236 asserts the index exists and now **fails the migration loudly** (with the duplicate
count) instead of warning, so the guarantee cannot be silently missing.
**Verified:** DB suite — index-presence test.

### F4 · **P0** · Marks stayed editable after results were published
`results_finalized_at` is written by the finalization path and consumed as completion evidence
([`sessionCompletionRepository.ts:65-70`](../apps/backend/src/db/repositories/sessionCompletionRepository.ts)),
yet the marks path never read it. **Fixed:** the marks write takes `FOR SHARE` on the exam row and
refuses published (`409 exam_results_finalized`) and archived (`409 exam_archived`) exams; the
publish path takes `FOR UPDATE` on the same row, so the two cannot interleave.
**Verified:** DB suite — "refuses mark writes once results are published", "…for an archived exam".

### F5 · **P1** · Mark precision: integer column vs. a decimal entry grid
`marks_obtained integer` ([`:109`](../apps/backend/src/db/schema/examinationExamTables.ts)) while
the grid sets `inputMode="decimal"` and the DTO accepts any number — `85.5` reached an `integer`
column and failed with `22P02` (a 500). The sibling scoring column is `numeric(8,2)`
([`examinationTestTables.ts:171`](../apps/backend/src/db/schema/examinationTestTables.ts)).
**Fixed:** `marks_obtained numeric(8,2)`, DTO bound `MAX_MARKS_OBTAINED`, and server-side
normalization that rounds the *decimal text* (matching Postgres) instead of the binary double.
**Verified:** DB suite — "stores marks exactly at numeric(8,2) scale".

### F6 · **P1** · "A mark may not exceed its exam's total" was app-only
The only DB check was `marks_obtained >= 0`; the upper bound lived in
[`examEligibilityGate.ts:47-56`](../apps/backend/src/examinations/use-cases/examEligibilityGate.ts)
with a comment admitting the database cannot compare against another table. Every bypass path
(backup restore, legacy migration 029, a direct repository call) could store an impossible score.
**Fixed:** `trg_exam_results_bounds` (BEFORE INSERT/UPDATE OF marks/exam) compares against
`exams.total_marks`, and `trg_exams_total_marks_guard` refuses to lower a total below a recorded
mark. Both bypass under `app.allow_hard_purge` so a snapshot restore cannot be wedged.
**Verified:** DB suite — both triggers return `23514`.

### F7 · **P1** · `exams` had no range or domain checks
The 0235 snapshot recorded exactly one check (`exams_min_attendance_pct_check`): no positive total,
no `passing_marks <= total_marks`, no positive duration, and no status enum (statuses existed only
in Zod). **Fixed:** four checks added `NOT VALID` and validated only when no legacy row violates
them (a `WARNING` otherwise), so the deploy cannot fail on historical data.
**Verified:** DB suite — "enforces the exams range and status checks" (4 invalid rows rejected).

### F8 · **P1** · Mark writes were not audited
Only `exams` and `exam_eligibility_overrides` emitted audit rows. `exam_results` inserts/updates were
invisible and the replace path deleted every mark in the workspace with no trace. **Fixed:** the
upsert appends one `recordModernAuditEvent` per **changed** mark inside the same transaction
(`CREATE`/`UPDATE`, with the previous score); unchanged rows are skipped so a roster save does not
flood the chain. **Verified:** DB suite — audit-row test.

### F9 · **P2** · Redundant index
`exam_results_workspace_exam_idx` duplicated the prefix of the unique index. **Fixed:** dropped in
0236. Left in place deliberately: `exams_workspace_deleted_idx` (Category A) and
`exam_classes_workspace_exam_idx` (PK prefix) — the write tax is negligible and dropping live
indexes for no query benefit is not worth the lock.

### F10 · **P2** · Index coverage for "exam room / timetable conflict detection"
`exams_workspace_date_idx` covers date scans, which is all the schema can express: `exams` has
**no room and no start/end time**, rooms live on `session_classes`/`session_sections` (unlinked
strings), and timetable periods store `start_time varchar(20)`. No code performs any conflict
check. **Deferred** — see the domain/lifecycle audit §"Target scheduling model".

### F11 · **P3** · `marked_by` has no FK
A composite `SET NULL` would null the NOT NULL tenant column; `NO ACTION` would block tenant-user
purge. Attribution is now covered by the audit trail instead. Documented, not changed.

### F12 · **P3** · `saveExam` wrote client-supplied deletion fields
The bulk upsert copied `deletedAt`/`deletedBy`/`deletionReason` from the request, so a normal save
could archive or revive an exam behind the audited delete/restore routes. **Fixed:** the upsert no
longer writes those columns (the backup restore path still does).

## Delivered

- Migration `0236_exams_results_integrity.sql` (+ `_journal.json` entry + meta snapshot; hand-authored
  because `drizzle-kit generate` is blocked by the 0216/0217 snapshot collision — a documented,
  reviewed exception).
- Drizzle mirror in [`examinationExamTables.ts`](../apps/backend/src/db/schema/examinationExamTables.ts).
- Split persistence: [`examResultUpsert.ts`](../apps/backend/src/db/repositories/examResultUpsert.ts)
  (pure planner), [`examinationResultsPersist.ts`](../apps/backend/src/db/repositories/examinationResultsPersist.ts)
  (tx, OCC, lock, audit), read surface in
  [`examinationResultsRepository.ts`](../apps/backend/src/db/repositories/examinationResultsRepository.ts).
- Shared DTO: `ExamResult.version`, `Exam.resultsFinalizedAt`, `MAX_MARKS_OBTAINED`, batch caps
  (1000 exams / 2000 marks).
- Tests: `examResultUpsert.test.ts` (11), `examinationIntegrityDb.integration.test.ts` (12, real
  Postgres), `EnterMarks.test.tsx` (OCC round-trip + published lock).

## Verification

```bash
node scripts/check-migration-indexes.mjs
node scripts/check-migration-hygiene.mjs
pnpm --filter mms-backend test:db -- src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts
```

Deferred with a specified design: room/time conflict detection, `exams.total_marks` as a decimal,
absent/exempt score status, mark soft-delete (deliberately rejected: marks are audited facts, not
trash — the owner chose audited corrections + OCC).
