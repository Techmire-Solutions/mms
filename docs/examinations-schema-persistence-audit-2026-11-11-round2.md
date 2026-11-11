# Examinations Schema & Persistence Audit — Round 2 (2026-11-11)

**Scope.** The Examinations persistence layer after migrations 0236/0237 — `exams`, `exam_classes`,
`exam_results`, `exam_eligibility_overrides`, and the "exam paper" tables `tests`, `test_sections`,
`test_section_questions`, `assessment_results`, `assessment_answers`. This round re-verifies the
brief's four asks (foreign keys/cascades, the compound marks key, room/timetable index coverage,
soft-delete/OCC) against the **materialised** schema and closes the residual defects.

**Method.** Read every exam/paper Drizzle module, the migrations that shaped them
(`0048`, `0051`, `0068`, `0090`, `0104`, `0108`, `0166`, `0171`, `0207`, `0222`, `0236`, `0237`,
`0238`), the `0238` snapshot, both repository layers, the marks importer, the shared DTOs and the
error mapping — then introspected a live PostgreSQL database (237 migrations applied) for
`pg_constraint`, `pg_indexes`, `pg_trigger`, `pg_class.relforcerowsecurity` and
`information_schema.columns`. The drift findings below are proven by that introspection, not
inferred from the source.

> Environment caveat: the live database's stored hash for migration `0207` differs from the current
> file (it was amended after being applied there), so the certified-evidence trigger exists in the
> migration file but not in that database. `0236`/`0237`/`0238` hashes match. Re-provision before
> asserting that trigger's behaviour locally.

## Brief → actual schema

| Brief | Reality |
|---|---|
| `tenant_id` | `workspace_subdomain` — composite tenant key, composite FKs, FORCE RLS on every table |
| `student_marks` | `exam_results` (`numeric(8,2)` mark, `version`, no `deleted_at`) |
| `exam_papers` | `tests` (+ `test_questions`, `test_sections`, `test_section_questions`); the UI labels them "Exam Papers" |
| `grading_scales` | **no table, no column.** Bands are the hardcoded `GRADE_BANDS` constant in [`gradeUtils.ts`](../packages/shared/src/examinations/gradeUtils.ts); `gradingSystem` is a write-only module preference (D3 plans a workspace band table) |
| `terms` | no `terms` table — `sessions.category_id → session_categories` |
| `sections` | `session_class_sections` / `session_classes`; exams never reference a section directly |
| exam → session/term | **indirect only**: `exams → exam_classes → session_classes → sessions` (an exam with no class row is invisible to completion) |

## Materialised object inventory (verified live)

**Foreign keys.** `exams.subject_id → subjects` RESTRICT (0166, validated);
`exam_classes → exams` CASCADE, `exam_classes.class_id → session_classes` RESTRICT (0171,
validated); `exam_results → exams|students` CASCADE; `exam_eligibility_overrides →
exams|students` CASCADE (0222); `tests.class_id → session_classes` RESTRICT (`tests_class_fk`,
0171, validated); `test_sections → tests` CASCADE; `test_section_questions.question_id →
questions` CASCADE — and, since 0238, `test_section_questions.section_id → test_sections`
CASCADE; `assessment_results → tests|students` CASCADE; `assessment_answers → assessment_results|
questions` CASCADE.

**Uniqueness.** `exam_results_workspace_exam_student_uidx` on
`(workspace_subdomain, exam_id, student_id)` — full, not partial (marks have no `deleted_at`);
`test_sections_ws_id_uidx` on `(workspace_subdomain, id)` (0238, needed as the section FK target);
`assessment_results_ws_test_student_uidx` on
`(workspace_subdomain, test_id, student_id) WHERE deleted_at IS NULL` (0238, recyclable).

**Indexes.** `exams`: subject, date, status, deleted, active partial, updated-at partial,
deleted-records partial, **unfinalized partial** (`(workspace, status) WHERE results_finalized_at IS
NULL AND deleted_at IS NULL`). `exam_results`: the unique business key + `(workspace, student_id)`.
`exam_classes`: `(workspace, exam_id)` + `(workspace, class_id)`. `exam_eligibility_overrides`:
`(workspace, student_id)`. Papers: `tests (workspace, category_id)`, `(workspace, class_id)` and
the soft-delete trio; `assessment_results` `(workspace, test_id)`, `(workspace, student_id)`,
`(workspace, submitted_at)`, the test-active partial and the soft-delete trio.

**Triggers.** `exams`: `trg_exams_forbid_hard_delete`, `trg_exams_total_marks_guard`,
`trg_exams_published_guard` (0238); `exam_results`: `trg_exam_results_bounds` (047/0237),
`exam_results_certified_evidence_guard` (0207 — see caveat); `tests`, `questions`,
`assessment_results`: `forbid_hard_delete`. **Marks have no `deleted_at` and no delete trigger by
design** — they are audited facts corrected through OCC + the audit trail, and no route deletes a
mark.

**Checks.** `exams`: min attendance 0–100, positive total, passing ≤ total, positive duration,
status enum; `exam_results`: non-negative mark, non-negative grace, grace ⇒ reason; `tests`:
total is null or > 0, positive duration (0238); `questions`: marks ≥ 0 (0238);
`assessment_answers`: score ≥ 0 (0238); `assessment_results`: ISO-dated `submitted_at` (0238).

**RLS.** ENABLE + FORCE on `exams`, `exam_classes`, `exam_results`, `exam_eligibility_overrides`,
`tests`, `test_sections`, `test_section_questions`, `assessment_results`, `assessment_answers`
(0048/0051/0076/0108/0222), all tenant-scoped and fail-closed.

## Verified sound (no change)

- The marks write path arbitrates on the **business key**, not the surrogate id; `version` is a real
  OCC token (`ON CONFLICT … WHERE version = excluded.version`), stale saves return
  `409 stale_write`, and a batch writes all-or-nothing.
- Published/archived/cancelled exams refuse mark entry and moderation inside the write transaction
  (`FOR SHARE` on the exam vs `FOR UPDATE` on publish), and published results refuse soft-delete in
  the app.
- `marks_obtained numeric(8,2)` is exact at scale; `min_attendance_pct numeric(5,2)`;
  `assessment_answers.score numeric(8,2)`.
- Every score change appends one hash-chained audit row per changed mark; trash/restore and
  collection replacement are audited.
- `exams` carries the full soft-delete sextuple plus all three index tiers.

## Findings, resolutions and the 0238 change-set

| # | Severity | Where | Finding | Resolution |
|---|---|---|---|---|
| F1 | P1 | [`examinationExamsTrash.ts:63`](../apps/backend/src/db/repositories/examinationExamsTrash.ts) | Whole-collection restore omitted `results_finalized_at` and `min_attendance_pct`: restoring a backup **un-published** published results and dropped the attendance gate. | Fixed — both written, plus `created_at`. |
| F2 | P1 | [`examinationResultsPersist.ts:213`](../apps/backend/src/db/repositories/examinationResultsPersist.ts) | Marks restore omitted `grace_marks`/`moderation_*` and neither side carried `created_at`/`updated_at`. | Fixed — moderation, attribution and timestamps round-trip; the read projection now exports `createdAt`/`updatedAt`. |
| F3 | P2 | [`examinationExamsTrash.ts:195`](../apps/backend/src/db/repositories/examinationExamsTrash.ts) | `bulkRestoreExams` never stamped `restored_at`/`restored_by` nor reset `deleted_with_cascade`. | Fixed — sextuple restore evidence written. |
| F4 | P2 | [`examClassMembershipRepository.ts:148`](../apps/backend/src/db/repositories/examClassMembershipRepository.ts) | Publish/unpublish validated in one transaction and wrote in another with no state predicate: two concurrent publishes both succeeded. | Fixed — an `expect: unpublished/published` CAS in the `UPDATE`; 0 rows → conflict, no audit. |
| F5 | P2 | [`examinationsMarksImportService.ts:103`](../apps/backend/src/services/examinationsMarksImportService.ts) | The CSV marks import built rows without a `version`, taking the last-write-wins branch and silently overwriting a concurrent correction. | Fixed — the importer reads `findExamResultVersionsByExam` and echoes id + version; a stale row reports its 409. |
| F6 | P2 | `tests_class_fk` / `exams_workspace_unfinalized_idx` / `assessment_results_workspace_test_active_idx` / `assessment_results_workspace_submitted_idx` | Drizzle/snapshot/physical drift in both directions: the FK and two indexes existed but were undeclared; the submitted-at index was declared and in every snapshot but **no migration created it**. | Fixed — all four mirrored in Drizzle; 0238 creates the missing index and re-asserts the FK. |
| F7 | P2 | [`examinationTestTables.ts:113`](../apps/backend/src/db/schema/examinationTestTables.ts) | `test_section_questions.section_id` had no FK, and `test_sections` lacked the unique `(workspace, id)` it needs. | Fixed — unique index + CASCADE FK (0238). |
| F8 | P2 | [`examinationTestTables.ts:187`](../apps/backend/src/db/schema/examinationTestTables.ts) | No natural-key uniqueness on `assessment_results`: duplicate paper results per (test, student) were representable. | Fixed — partial unique index, recyclable through soft delete. |
| F9 | P2 | [`examinationExamTables.ts:148`](../apps/backend/src/db/schema/examinationExamTables.ts), `httpErrors.ts` | `grace_marks numeric(6,2)` (max 9999.99) while the DTO and moderation validation allowed 999999.99 → `22003`, which was unmapped → 500. | Fixed — `MAX_GRACE_MARKS = 9999.99` governs both, and `22003` maps to 400 `value_out_of_range`. |
| F10 | P2 | `examinationsModuleManifest.ts`, `questionBankModuleManifest.ts` | Authoring fields accepted decimals while their columns are `integer` (total/passing/duration/paper total/question marks) → a Postgres `22P02` behind a generic 400. | Fixed — `.int()` (+ `.max(MAX_MARKS_OBTAINED)` on write) makes the API contract match the storage. |
| F11 | P2 | `tests`, `questions`, `assessment_answers`, `assessment_results` | No domain checks at all on the paper/answer tables, and `submitted_at` is text that the reports cast to `date` (malformed text → `22007`). | Fixed — four checks + an ISO-date shape check (NOT VALID → validated when clean). |
| F12 | P2 | `exams` (no trigger) | Published-exam immutability (trash, re-date, re-weight, status) existed only in [`examWriteGuards.ts:109`](../apps/backend/src/examinations/domain/examWriteGuards.ts); any restore/legacy/direct write bypassed it. | Fixed — `trg_exams_published_guard`, with unpublish, trash-restore and `app.allow_hard_purge` exemptions. |
| F13 | P3 | [`examinationExamsRepository.ts:70`](../apps/backend/src/db/repositories/examinationExamsRepository.ts) | No exam projection selected `min_attendance_pct`, so the gate set by the eligibility route always read as `null` (and was absent from the backup payload). | Fixed — all three explicit projections now select it (`listExamsPage` reads whole rows). |
| F14 | P2 deferred | `exams`, `session_class_timetable_periods` | Room/time conflict detection is not representable: no room/start/end on exams, periods store `start_time`/`end_time` as `varchar(20)` with no room or date, rooms are free strings, and no exclusion constraint or conflict code exists. | Deferred with target DDL below (needs an exam-scheduling UI and a room scope). |
| F15 | P3 deferred | `gradeUtils.ts` | No grading-scale table; bands are a shared constant and `gradingSystem` is inert. | Recorded as D3 (workspace bands); not repeated here. |
| F16 | P3 documented | live DB | Two redundant single-column indexes never declared in Drizzle (`assessment_results_workspace_subdomain_idx`, `exam_results_workspace_subdomain_idx` — both PK prefixes). | Left in place this round; drop SQL below. |
| F17 | P3 accepted | `exam_results.marked_by` | No FK: a composite `SET NULL` would null the NOT NULL tenant key and `NO ACTION` would block user purge. | Accepted; attribution is covered by the audit trail. |

## Deferred remediation SQL

**F14 — room / timetable conflict model** (apply only with the scheduling UI; `btree_gist` is
already installed by 0206):

```sql
ALTER TABLE exams
  ADD COLUMN room varchar(100),
  ADD COLUMN starts_at timestamptz,
  ADD COLUMN ends_at timestamptz;
ALTER TABLE exams ADD CONSTRAINT exams_sitting_range_check
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at) NOT VALID;

ALTER TABLE exams ADD CONSTRAINT exams_room_no_overlap_excl
  EXCLUDE USING gist (
    workspace_subdomain WITH =,
    room WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (
    deleted_at IS NULL AND room IS NOT NULL
    AND starts_at IS NOT NULL AND ends_at IS NOT NULL
  );
CREATE INDEX exams_workspace_date_time_idx
  ON exams (workspace_subdomain, date, starts_at) WHERE deleted_at IS NULL;

-- Timetable periods: a real time type, the calendar day and the room are required to scope an
-- overlap. `mms_try_time` + a reject table follow the 0172 date-conversion pattern.
ALTER TABLE session_class_timetable_periods
  ALTER COLUMN start_time TYPE time USING mms_try_time(start_time),
  ALTER COLUMN end_time   TYPE time USING mms_try_time(end_time);
ALTER TABLE session_class_timetable_periods
  ADD COLUMN date date,
  ADD COLUMN room varchar(100);
ALTER TABLE session_class_timetable_periods
  ADD CONSTRAINT session_class_timetable_periods_time_check
  CHECK (end_time > start_time) NOT VALID;
ALTER TABLE session_class_timetable_periods
  ADD CONSTRAINT session_class_timetable_periods_no_overlap_excl
  EXCLUDE USING gist (
    workspace_subdomain WITH =,
    date WITH =,
    room WITH =,
    tsrange(date + start_time, date + end_time, '[)') WITH &&
  ) WHERE (date IS NOT NULL AND room IS NOT NULL);
```

**F16 — redundant indexes** (safe to drop; each duplicates its table's PK prefix):

```sql
DROP INDEX IF EXISTS assessment_results_workspace_subdomain_idx;
DROP INDEX IF EXISTS exam_results_workspace_subdomain_idx;
```

**`submitted_at` typing** (after F11's shape check has been validated everywhere):
convert `assessment_results.submitted_at` to `timestamptz` with a `text → timestamptz` reject-table
migration (0172 pattern). Until then the reports' `submitted_at::date` is safe because 0238
rejects malformed text.

## What shipped in this change

- **Migration `0238_exams_persistence_integrity.sql`** (+ snapshot + journal): the four paper
  checks, section unique index + CASCADE FK, the partial paper-result unique index, the
  published-exam guard, the `tests_class_fk` re-assertion, and the index truth-up
  (`assessment_results_workspace_submitted_idx` created; `exams_workspace_unfinalized_idx` and
  `assessment_results_workspace_test_active_idx` `CREATE … IF NOT EXISTS`). Every check/FK is
  NOT VALID → conditionally validated; the two unique indexes fail loudly on legacy duplicates.
- **Drizzle mirrors** for every new object, and the previously undeclared physical ones.
- **Persistence**: restore fidelity + provenance, publication CAS, importer OCC, `minAttendancePct`
  projection, `createdAt`/`updatedAt` on marks.
- **Shared/DTO**: `MAX_GRACE_MARKS`, integer authoring fields, `22003` mapping.
- **Tests**: 7 new real-Postgres cases in `examinationIntegrityDb` (restore provenance/fidelity,
  CAS, published guard, gate projection, session-archive evidence), a new
  `questionBankPersistenceDb` suite (7 cases), two lifecycle CAS unit cases, one importer OCC case;
  the test-matrix ratchet now pins 28 scenarios.
- **Test determinism**: the eligibility-override audit assertion now orders by the audit identity
  (`audit_trail_events.id`) instead of relying on heap order.

## Verification

```bash
node scripts/check-migration-indexes.mjs
node scripts/check-migration-hygiene.mjs
node scripts/check-migrations-forward-only.mjs --base HEAD
node scripts/check-examinations-test-matrix.mjs
node scripts/check-db-projections.mjs
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/examinationIntegrityDb.integration.test.ts \
  src/__tests__/db-integration/examinationSubsystemsDb.integration.test.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
pnpm --filter mms-backend test:rls
```

## Remaining risks

- **One result per paper/student** is now a hard invariant; there is no attempt column anywhere in
  the module. If retakes are introduced, add `attempt_no` to the unique key rather than dropping
  the guard.
- The marks importer snapshots versions **once per job**; a mark created after that read and before
  its chunk still takes the insert path. The window is milliseconds and a replayed job is
  idempotent, but it is not the grid's per-request OCC.
- Exam **class membership** changes on a published exam remain app-guarded only (no junction
  trigger); the exam row itself is now DB-guarded.
- `exams.date` is a calendar day with no time: the date index helps "which exams are on day X", not
  "does this room clash at 10:00" — that is F14.
