# Question Bank Schema & Persistence Audit — Round 3 (2026-11-11)

**Scope.** The Question Bank persistence layer: `questions`, `question_options`, `question_tags`,
`question_categories`, `question_citations`, and the paper/answer tables that reference them
(`test_questions`, `test_sections`, `test_section_questions`, `assessment_results`,
`assessment_answers`). Rounds 1–2 covered the *exam* half of the module
([`examinations-schema-persistence-audit-2026-11-11-round2.md`](examinations-schema-persistence-audit-2026-11-11-round2.md));
the question half was never audited. This round answers the brief's three asks — referential
integrity, the compound filter/blueprint index, and protection of questions referenced by active or
completed exams — against the **materialised** schema, and closes the defects that are safe to close
now.

**Method.** Read every question-bank Drizzle module
([`examinationQuestionBankTables.ts`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts),
[`examinationTestTables.ts`](../apps/backend/src/db/schema/examinationTestTables.ts),
[`softDeleteSchema.ts`](../apps/backend/src/db/schema/softDeleteSchema.ts),
[`academicCatalogs.ts`](../apps/backend/src/db/schema/academicCatalogs.ts)), the nine
question-bank repositories, the generic relational CRUD service, `listPageHelper`, the shared
`questionBankModuleManifest.ts` / `questionBankModuleSettings.ts`, and migrations `0000, 0051, 0068,
0090, 0108, 0197, 0228, 0238, 0239`. Then introspected the live PostgreSQL database
(`pg_constraint`, `pg_indexes`, `pg_trigger`, `pg_class.relrowsecurity`, `information_schema.columns`)
— findings marked "verified" come from that introspection, not from source inference. Finally ran
`EXPLAIN (ANALYZE, BUFFERS)` on synthetic tenants before/after the new indexes.

## Brief → actual schema

| Brief | Reality |
|---|---|
| `tenant_id` | `workspace_subdomain` — composite tenant key, composite FKs, FORCE RLS on all six question tables (verified) |
| `questions` → subjects / catalogs / courses / topics | **no column and no FK.** `subjects` exists; `courses` and `topics` do not exist anywhere in `schema/` |
| `question_categories` → catalogs | free-text `category_id varchar(64)`, **no FK**; the ids point into a JSON settings blob |
| `answer_keys` | **no such table.** The key is `questions.answer`, holding the correct option's *text* |
| `question_type` | column is named `type` |
| `status` | **no `status` on `questions`, and none on `tests`.** Only `exams` has a lifecycle |
| `deleted_at` | full sextuple on `questions`, `tests`, `assessment_results`; absent (correctly) on the child tables |
| OCC `version` | **absent on `questions`/`tests`**; `exam_results` has it and is the reference pattern |

## Materialised object inventory (verified live)

**Foreign keys.** `questions → workspaces` CASCADE; `question_options`, `question_tags`,
`question_categories`, `question_citations` → `(workspace, question_id)` → `questions` **CASCADE**;
`test_questions`/`test_section_questions` → `questions` **CASCADE**, → `tests`/`test_sections`
CASCADE; `assessment_answers` → `assessment_results` and `questions` **CASCADE**. Nothing references
`subjects` from the question side; `question_categories.category_id` and `tests.category_id` reference
nothing at all.

**Uniqueness.** `questions` `(workspace, id)`; `question_options` `(workspace, question_id, id)` — the
option index was **not** unique before 0240; `question_tags` `(workspace, question_id, tag)`;
`question_categories` `(workspace, question_id, category_id)`; `question_citations`
`(workspace, question_id, id)`.

**Indexes before 0240.** `questions`: `(ws, type)`, `(ws, difficulty)`, `(ws, deleted_at)`, the active
partial `(ws) WHERE deleted_at IS NULL`, the deleted-records partial. Children: one `(ws, question_id)`
index each (four of them strict PK prefixes), plus `question_categories (ws, category_id)` and
`question_citations (ws, book_id)`. **No index on `updated_at`**, none combining `difficulty`+`type`,
and no reverse `(ws, question_id)` index on either paper-link table.

**Triggers.** `trg_questions_forbid_hard_delete`, `trg_tests_forbid_hard_delete`,
`trg_assessment_results_forbid_hard_delete` (0108). No content-immutability guard existed.

**RLS.** ENABLE + FORCE on `questions`, `question_options`, `question_tags`, `question_categories`,
`question_citations`, `test_questions` (verified).

## Findings

### A. Referential integrity — questions → subjects / catalogs / courses / topics

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| QB1 | P1 | [`examinationQuestionBankTables.ts:16`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts) | `questions` has **no `subject_id`/`course_id`/`topic_id`** and no FK to `subjects`. Columns are only `id, workspace_subdomain, type, difficulty, question_language, text, answer, marks, sextuple, timestamps`. `exams.subject_id → subjects` RESTRICT exists, so questions are the only academic entity with no subject anchor. There is no `topics` and no `courses` table to reference. | **Deferred** — needs a product decision (see D1) |
| QB2 | P1 | [`examinationQuestionBankTables.ts:48`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts) | `question_categories.category_id` is an unconstrained `varchar(64)`; the ids live in the `categories` JSON array of module settings ([`questionBankModuleSettings.ts:17`](../packages/shared/src/examinations/questionBankModuleSettings.ts)). `tests.category_id` is the same. Renaming or deleting a category orphans every referencing question and nothing detects it. | **Deferred** — D2 |
| QB3 | P2 | [`examinationQuestionBankTables.ts:27`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts) | No `answer_keys` table exists (verified: zero references in the codebase). The key is `questions.answer` = the option's **text**, validated only by `superRefine` in [`questionBankModuleManifest.ts:132`](../packages/shared/src/examinations/questionBankModuleManifest.ts). `bulkSaveQuestions` writes rows and children with no cross-check, so a CSV import or an option rename leaves an answer that matches no option. | **Deferred** — D3 |

### B. Indexing & paper generation

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| QB4 | P1 | [`questionBankRepositoryList.ts:35`](../apps/backend/src/db/repositories/questionBankRepositoryList.ts) | **The requested `(tenant, subject, difficulty, type, status, deleted_at)` key was not representable** — three of its six columns did not exist. Even the representable part was missing: the filter is `ws + deleted_at IS NULL + difficulty IN (…) + category EXISTS + text ILIKE` sorted `updated_at DESC`, with **no index on `updated_at`** (every default page top-N-sorted the tenant's questions) and no `difficulty`+`type` composite. The declared `(ws, type)` index is never used by the list query — it has no `type` predicate. | **Fixed** — 0240 subset |
| QB5 | P1 | [`questionBankRepositoryList.ts:46`](../apps/backend/src/db/repositories/questionBankRepositoryList.ts) | Search is `text ILIKE '%term%'` with no trigram index, even though `pg_trgm` is installed by 0197 and used on `contacts`/`hasanat_*`. | **Fixed (out of band)** — 0240 concurrent script |
| QB6 | P2 | [`examinationTestTables.ts:66`](../apps/backend/src/db/schema/examinationTestTables.ts) | **No reverse `(ws, question_id)` index** on `test_questions` or `test_section_questions`; the PKs put `question_id` last, so "which papers use question X" seq-scanned both tables — the exact check the guard needs. | **Fixed** — 0240 |
| QB7 | P2 | [`examinationQuestionBankTables.ts:69`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts) | `question_options` had **no unique `(ws, question_id, option_index)`**; option order was a convention. The delete-then-reinsert sync ([`questionBankQuestionsSync.ts:51`](../apps/backend/src/db/repositories/questionBankQuestionsSync.ts)) can leave two options in one slot under concurrency and nothing rejected it. | **Fixed** — 0240 |
| QB8 | P2 | [`examinationQuestionBankTables.ts:111`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts), [`0090_performance_audit_indexes.sql:7`](../apps/backend/src/db/migrations_drizzle/0090_performance_audit_indexes.sql) | **Drift:** `question_citations_workspace_book_idx` exists in the live DB (created by the journaled migration 0090) but was absent from the Drizzle table **and from every meta snapshot** — a rebuilt database would silently lose it (the round-2 F6 class). | **Fixed** — declared in Drizzle + snapshot |
| QB9 | P3 | [`examinationQuestionBankTables.ts:35`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts) | Four indexes were strict PK prefixes — pure write amplification: `question_options_workspace_q_idx`, `question_tags_workspace_q_idx`, `question_citations_workspace_q_idx`, `question_categories_workspace_q_idx`. | **Fixed** — dropped (options replaced by the unique key) |
| QB10 | P3 | [`usePaperBuilderState.ts:50`](../apps/frontend/src/tenant/features/question-bank/hooks/usePaperBuilderState.ts) | **No server-side blueprint selection.** The paper builder filters the already-loaded list in JS, so composing a paper requires loading the tenant's question bank client-side; `listTests`/`listResults` are equally unpaged (500 default, 5 000 max). | **Deferred** — D5 |

### C. Question Bank ↔ Examinations, soft-delete, OCC

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| QB11 | P1 | [`examinationTestTables.ts:83,130,216`](../apps/backend/src/db/schema/examinationTestTables.ts) | Every paper/answer FK to `questions` is **CASCADE**. Hard delete is blocked by `trg_questions_forbid_hard_delete` ([`0108:216`](../apps/backend/src/db/migrations_drizzle/0108_soft_delete_schema_rls_and_triggers.sql)), so the cascades only fire under `app.allow_hard_purge` — but **nothing protected a graded question from destructive edits or soft-delete.** Editing `text`/`answer`/`marks`/`type`/`difficulty` silently rewrote a delivered paper and its key; trashing it left `test_questions` pointing at a trashed row. No snapshot, no version, no restrict, no app guard. | **Fixed** — `trg_questions_referenced_guard` (0240) |
| QB12 | P1 | [`questionBankQuestionsPersist.ts:32`](../apps/backend/src/db/repositories/questionBankQuestionsPersist.ts), [`genericRelationalService.ts:71`](../apps/backend/src/services/genericRelationalService.ts) | **No OCC.** `saveQuestion` upserted last-write-wins and `updateById` was a read-modify-write with no predicate: two editors silently overwrote each other. | **Fixed** — `version` column + CAS (§0240) |
| QB13 | P2 | [`questionBankQuestionsPersist.ts:313`](../apps/backend/src/db/repositories/questionBankQuestionsPersist.ts), [`questionBankQuestionsSync.ts:16`](../apps/backend/src/db/repositories/questionBankQuestionsSync.ts) | `bulkRestoreQuestions` never stamped `restored_at`/`restored_by` and never reset `deleted_with_cascade`; `questionRowToRecord` projected only the three delete columns, so `restoredAt`/`restoredBy`/`deletedWithCascade` — present in the table **and in the DTO** — never reached a client. Trash rows had no restore evidence (`mms-soft-delete` §2.5/§6). | **Fixed** |
| QB14 | P3 | [`examinationQuestionBankTables.ts:16`](../apps/backend/src/db/schema/examinationQuestionBankTables.ts) | No `status` on `questions` and none on `tests`: drafts and retired questions are indistinguishable, so a paper (or blueprint) cannot exclude them. Trash is the only retirement path. | **Deferred** — D4 |
| QB15 | P3 | [`questionBankResultsPersist.ts:202`](../apps/backend/src/db/repositories/questionBankResultsPersist.ts) | `deleteQuestionBankByWorkspace` raw hard-deletes `questions`/`tests` but has **no caller** and would raise `check_violation` from the soft-delete trigger unless `app.allow_hard_purge=true`. | Recorded; dead path left unreferenced |

**N+1 verdict — option loading is clean.** Every read path batches children with one `inArray` per
child table: [`questionBankRepositoryList.ts:134`](../apps/backend/src/db/repositories/questionBankRepositoryList.ts),
[`questionBankQuestionsSync.ts:137`](../apps/backend/src/db/repositories/questionBankQuestionsSync.ts),
[`questionBankTestsHydrate.ts:36`](../apps/backend/src/db/repositories/questionBankTestsHydrate.ts).
No per-question query loop exists. Three residual costs, none a classic N+1: the widget endpoint ran
2 queries per widget; `hydrateQuestionRecords` receives up to 5 000 ids with no chunk guard; and the
paper builder filters client-side (QB10).

## What shipped in this change

**Migration [`0240_question_bank_schema_integrity.sql`](../apps/backend/src/db/migrations_drizzle/0240_question_bank_schema_integrity.sql)**
(+ meta snapshot copied from 0239 + journal idx 240; hand-authored because `drizzle-kit generate` is
blocked by the 0216/0217 snapshot-chain collision):

1. `question_options_ws_q_index_uidx` — unique `(workspace_subdomain, question_id, option_index)`,
   with a pre-flight that fails loudly and names the duplicate count on legacy data (0238 precedent).
2. `test_questions_workspace_question_idx` and `test_section_questions_workspace_question_idx` —
   reverse lookups for the guard.
3. `questions_ws_active_difficulty_type_idx` (partial) and `questions_ws_updated_active_idx`
   (`updated_at DESC`, partial) — the representable subset of the brief's compound key plus the
   default sort.
4. `questions.version integer NOT NULL DEFAULT 1` + `questions_version_positive_check`.
5. `trg_questions_referenced_guard` + `question_bank_guard_referenced_question()` — refuses a
   destructive UPDATE while the question is referenced by a paper that already has an
   `assessment_results` row (trashed results included: a restorable result must not resolve to a
   mutated question). "Destructive" = `text`, `answer`, `marks`, `type`, `difficulty`, or setting
   `deleted_at`. Metadata-only updates and restores pass. `app.allow_hard_purge` keeps module purge
   working.
6. Dropped the four PK-prefix indexes.

**Out-of-band:** [`scripts/sql/0240_question_bank_indexes_concurrent.sql`](../apps/backend/scripts/sql/0240_question_bank_indexes_concurrent.sql)
— `questions_text_trgm_idx` (GIN trigram). `CONCURRENTLY` cannot be expressed in a Drizzle migration,
so it is a deploy step:
`pnpm --filter mms-backend index:concurrent -- --file scripts/sql/0240_question_bank_indexes_concurrent.sql`.
Like the 0197/0228 trgm indexes it is intentionally absent from the snapshot chain.

**Persistence:** OCC (`version` + `ON CONFLICT … WHERE version = excluded.version`, 0 rows →
`409 stale_write`, partition into token/no-token so import and restore paths keep working); restore
provenance stamped on bulk restore and on upsert resurrection; the trash projection now returns
`restoredAt`/`restoredBy`/`deletedWithCascade`; the widget endpoint's scalar values collapse from one
count query per widget into a single conditional-aggregate SELECT (2N+1 → N+2); the form carries the
token back so a stale edit is actually rejected.

**Shared:** `version` on `QuestionBankQuestion`, `questionBankQuestionRecordSchema` (`.strict()`
requires the explicit addition) and `questionBankQuestionWriteSchema`; restore fields on
`QuestionBankQuestion`.

## Measured effect

Local PostgreSQL 16, warm cache, synthetic tenants. `EXPLAIN (ANALYZE, BUFFERS)`:

| Query | Before 0240 | After 0240 |
|---|---|---|
| Default list page (20 000 questions, `ORDER BY updated_at DESC LIMIT 15`) | 5.579 ms, 418 buffers, top-N heapsort over a seq scan | **0.065 ms, 3 buffers**, index scan on `questions_ws_updated_active_idx` |
| Difficulty-filtered page (20 000) | 5.436 ms, 418 buffers | **0.042 ms, 3 buffers** |
| `text ILIKE '%zz4242%'` (150 000) | 77.6 ms, 3 683 buffers, parallel seq scan | **0.292 ms, 35 buffers**, bitmap index scan on the trigram index |

Caveat: at 20 000 rows the planner still prefers a seq scan for the ILIKE (1.1 ms) — the trigram
index is a scale measure, decisive past ~100 k questions per tenant.

## Deferred remediation (needs product sign-off)

**D1 — subject anchor + the full blueprint key.** Add the academic dimension, then the exact compound
key from the brief:

```sql
ALTER TABLE questions
  ADD COLUMN subject_id text,
  ADD COLUMN status varchar(20) NOT NULL DEFAULT 'active';

ALTER TABLE questions ADD CONSTRAINT questions_subject_fk
  FOREIGN KEY (workspace_subdomain, subject_id)
  REFERENCES subjects (workspace_subdomain, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE questions ADD CONSTRAINT questions_status_check
  CHECK (status IN ('draft', 'active', 'retired')) NOT VALID;

-- `deleted_at` is expressed as the partial predicate, not a trailing column: inside a
-- `WHERE deleted_at IS NULL` index a trailing `deleted_at` is constant and only bloats the key.
CREATE INDEX questions_ws_active_blueprint_idx
  ON questions (workspace_subdomain, subject_id, difficulty, type, status)
  WHERE deleted_at IS NULL;
```

Backfill `subject_id` from `question_categories.category_id` only where the id resolves to a real
`subjects` row; the rest stay null until an editor assigns them. Then `NOT VALID → VALIDATE`.

**D2 — category catalogue.** Promote the settings JSON array to a table so the junction can carry an
FK:

```sql
CREATE TABLE question_catalogue (
  id text NOT NULL,
  workspace_subdomain text NOT NULL REFERENCES workspaces (subdomain) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  icon varchar(32) NOT NULL DEFAULT '',
  color varchar(32) NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  deleted_by text,
  deletion_reason varchar(500),
  restored_at timestamptz,
  restored_by text,
  deleted_with_cascade boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_subdomain, id)
);
ALTER TABLE question_categories ADD CONSTRAINT question_categories_cat_fk
  FOREIGN KEY (workspace_subdomain, category_id)
  REFERENCES question_catalogue (workspace_subdomain, id) ON DELETE RESTRICT NOT VALID;
-- same for tests.category_id
```

**D3 — answer keys.** Replace text matching with a typed key:

```sql
ALTER TABLE question_options ADD COLUMN is_correct boolean NOT NULL DEFAULT false;

CREATE TABLE answer_keys (
  workspace_subdomain text NOT NULL REFERENCES workspaces (subdomain) ON DELETE CASCADE,
  question_id text NOT NULL,
  key_index integer NOT NULL,
  answer_text text NOT NULL,
  marks numeric(8,2) NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_subdomain, question_id, key_index),
  FOREIGN KEY (workspace_subdomain, question_id)
    REFERENCES questions (workspace_subdomain, id) ON DELETE RESTRICT
);
```

`ON DELETE RESTRICT` here is deliberate — but it must be added to
[`purgeSelectedModulesAllowlist.ts`](../apps/backend/src/scripts/purgeSelectedModulesAllowlist.ts)
before the `questions` entry, or module purge will fail closed.

**D4 — paper lifecycle.** `tests.published_at timestamptz` (plus optional `questions.status` from D1)
turns QB11's "has results" proxy into an explicit publication invariant, and lets an authoring paper
stay editable.

**D5 — server-side blueprint selection.** A `selectQuestionsForBlueprint` endpoint replacing the
client-side filter in QB10, using the D1 index and `ORDER BY md5(id || seed)` for a reproducible draw.

**D6 — `test_questions.question_snapshot jsonb`** written when the first result lands, so a paper is
reproducible independently of later question edits (the guard prevents most mutations; a snapshot
makes the evidence explicit).

## Verification

```bash
pnpm --filter mms-backend db:migrate && pnpm --filter mms-backend db:check
node scripts/check-migration-indexes.mjs && node scripts/check-migration-hygiene.mjs
node scripts/check-migrations-forward-only.mjs --base HEAD
node scripts/check-examinations-test-matrix.mjs && node scripts/check-db-projections.mjs
pnpm typecheck
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
pnpm --filter mms-backend test:rls
```

New real-Postgres cases (13 in the file, 6 added): duplicate option slot → `23505`; graded-question
edit/trash → `23514` (both the `test_questions` and the `test_section_questions` path); stale save →
`409 stale_write` with no partial write; restore provenance round-trip; the 0240 indices exist and the
dropped ones do not; the guard trigger is attached.

## Remaining risks

- **The guard's rejection surfaces as a generic `400 constraint_violation`.** The trigger raises
  `check_violation` (`23514`), the same errcode as `trg_exams_published_guard`, and the global mapping
  turns that into a 400 with the route's prefix message — the RAISE text is in the server log, not the
  response body. A dedicated `409 question_locked` type would need either a distinct SQLSTATE or a
  `CONSTRAINT =` marker on the RAISE; that errcode is shared with `questions_marks_non_negative_check`,
  so the mapping must be added deliberately rather than inferred from `23514`.
- **The guard is evidence-based, not lifecycle-based.** It keys off `assessment_results`; a paper that
  is drafted, published and delivered without results recorded in this system leaves its questions
  editable (D4 closes this).
- **The trigram index is a deploy step.** A database rebuilt from migrations alone has no
  `questions_text_trgm_idx` — same contract as the 0197/0228 indexes.
- **Tokenless bulk saves stay last-write-wins** by design (import, restore, legacy callers). Every
  interactive path now sends a token, but a third-party client that omits `version` can still
  overwrite.
- **The UI saves the whole loaded collection, so OCC is collection-wide.** The page controller PUTs
  every question it has loaded, each carrying its token; one concurrently-edited row anywhere in that
  array makes the whole save return `409 stale_write`. That is the honest consequence of CAS over a
  collection payload — the fix, if the UX needs it, is to send only the changed rows, not to relax the
  token check.
- **`replaceQuestionsForWorkspace` still hard-deletes** the whole question bank and requires
  `app.allow_hard_purge`; it has no live caller (QB15). It would now also trip the FK cascades on
  papers/results.
- **`assessment_answers.question_id` remains CASCADE.** Switching it to RESTRICT would break the
  documented module-replace/restore path, and hard delete is already trigger-blocked; the real gap was
  UPDATE, which is now closed.
- **`questions.created_at`/`updated_at`/`deleted_at` are naive `timestamp`** while Drizzle declares
  `timestamptz` (0108's `ADD COLUMN IF NOT EXISTS … TIMESTAMPTZ` silently kept 0051's naive column).
  This is baseline drift across ~30 tables and is not specific to this module; it is worth a single
  dedicated conversion migration, not a fix in this one.
