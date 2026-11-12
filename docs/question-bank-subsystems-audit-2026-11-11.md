# Question Bank Specialized Subsystems Audit (2026-11-11)

**Scope.** The three specialized subsystems: the blueprint/auto-paper engine, media & diagram
attachments, and duplicate/similarity detection. Follows the schema/persistence and domain/lifecycle
rounds ([`question-bank-schema-persistence-audit-2026-11-11.md`](question-bank-schema-persistence-audit-2026-11-11.md),
[`question-bank-domain-lifecycle-audit-2026-11-11.md`](question-bank-domain-lifecycle-audit-2026-11-11.md)).

**Method.** Read the question-bank feature tree, the paper builder, the attachment storage/sweep
services and the uploads plugin, the background-job runners, and the shared transfer schema. Then
grepped for the machinery each subsystem would need (`Math.random`/`shuffle`/`weight`, attachment
references, similarity). Two of the three subsystems **did not exist**; the third was wired to
contacts only.

## Findings

### 1. Blueprint & auto-paper assembly

| # | Sev | Where | Finding |
|---|---|---|---|
| BP1 | P1 | [`QuestionBankWorkTier.tsx:132`](../apps/frontend/src/tenant/features/question-bank/components/QuestionBankWorkTier.tsx) | **No assembly engine.** The `generate` sub-tab was one button that opened the manual paper builder. No topic weightage, difficulty distribution, type quota, marks budget, recently-used exclusion or randomness existed anywhere — so determinism, constraint satisfaction and "criteria cannot be met" had no implementation to audit. |
| BP2 | P2 | [`examinationTestTables.ts:30`](../apps/backend/src/db/schema/examinationTestTables.ts) | `tests.difficulty` accepts `"mixed"` but nothing derives a mix; `total_marks` was unrelated to the selected questions. |
| BP3 | P2 | `questionBankTestsHydrate.ts` | No recently-used signal was read, although `test_questions` + `tests.created_at` make it available. |
| BP4 | P3 | `questionBankModuleManifest.ts` | `directoryViews: ["questions","generate"]` promised a generator the module did not have. |

### 2. Media & diagram attachments

| # | Sev | Where | Finding |
|---|---|---|---|
| MD1 | P1 | `examinationQuestionBankTables.ts` | **No media model.** Stems and options were text-only; nothing uploaded, stored or rendered an image/audio/diagram. |
| MD2 | P1 | [`attachmentSweepService.ts:57`](../apps/backend/src/services/attachmentSweepService.ts) | **Orphan risk, inverted.** The nightly sweep (`retentionPurgeScheduler` → `runAttachmentSweep`, `apply: true`) treated a file as an orphan unless **`contact_attachments`** referenced it. Question media stored under `attachments/` would have been deleted after the 24 h floor. |
| MD3 | P1 | [`staticAssets.ts:158-173`](../apps/backend/src/plugins/staticAssets.ts) | The read gate hardcoded "any `…/attachments/…` path needs `contacts.read`". Attendance excuse files already fell under it, and question media there would have been unreadable for a teacher without `contacts.read`. |
| MD4 | P2 | [`attachmentSweepService.ts:34`](../apps/backend/src/services/attachmentSweepService.ts) | The sweep only walked `tenants/*/attachments/`. Files under `images/` are never cleaned — the opposite failure, permanent orphans. |
| MD5 | P2 | [`uploads.ts:154`](../apps/backend/src/routes/common/uploads.ts) | The delete endpoint checked references outside any transaction; a concurrent attach could be orphaned by an unlink. |
| MD6 | P3 | `uploads.ts` | No signed/expiring URLs. Access is session + tenant + module gated, which is defensible, but it was undocumented and did not cover a question-media category. |

### 3. Duplicate & similarity detection

| # | Sev | Where | Finding |
|---|---|---|---|
| DUP1 | P1 | `questionBankQuestionWritePlan.ts` | **No duplicate detection** of any kind — not in the form, not at the write boundary, not in a report. |
| DUP2 | P1 | [`registerModuleCsvImportRoutes.ts:49`](../apps/backend/src/lib/registerModuleCsvImportRoutes.ts) | Bulk import and export both return **503**: no `questionBank:import` / `questionBank:export` runner is registered. "Duplicate detection during bulk import" could not run. |
| DUP3 | P2 | [`questionBankTransferSchema.ts`](../packages/shared/src/dataTransfer/schemas/questionBankTransferSchema.ts) | The CSV contract maps `title/explanation/points/source/category`, while storage uses `text/answer/marks/sourceCitations/categoryIds`; samples use `"open-ended"`/`"intermediate"`, outside the enums. Enabling the runner as-is would export empty stems and import invalid types. |

### Loops, races and orphans

- **Infinite loops:** none existed because no sampler existed. The engine was written as a **bounded
  single pass** (`O(buckets × candidates)`, caps on buckets/candidates/selection). A rejection loop
  ("shuffle until satisfied") is exactly what must not be introduced: it spins forever once a bucket's
  pool is exhausted.
- **Race — assembly vs publication:** `test_questions` has no version. Assembly locks the paper row
  (`FOR UPDATE`) and refuses a published paper.
- **Race — sweep vs attach:** the 24 h age floor protects a fresh upload, but detach + unlink was not
  ordered. Detach now deletes the row first and unlinks only if nothing else references the URL.
- **Orphan — purge:** `question_attachments` cascades on question delete, so files become orphans and
  rely on the sweep; the sweep now recognizes the new table.

## What shipped

**Shared, pure**
- [`paperBlueprint.ts`](../packages/shared/src/examinations/paperBlueprint.ts) — blueprint schema,
  bucketed selection, `fnv1a` + `mulberry32` seeded PRNG, stable candidate ordering, marks budget,
  deficit report, hard caps.
- [`questionSimilarity.ts`](../packages/shared/src/examinations/questionSimilarity.ts) — Arabic-aware
  normalization and character-trigram Jaccard with `DUPLICATE_THRESHOLD`/`SIMILAR_THRESHOLD`.

**Migration `0242_question_bank_subsystems.sql`** (+ snapshot + journal): `question_attachments`
(composite PK, question/workspace FKs, stem/option checks, reference index, FORCE RLS),
`test_blueprint_buckets` (ordered buckets, target checks, FORCE RLS) and `tests.assembly_seed`.

**Assembly**
- [`questionBankAssemblyPersist.ts`](../apps/backend/src/db/repositories/questionBankAssemblyPersist.ts)
  — two-query candidate load (approved, not deleted, optional recently-used exclusion), engine run,
  link/blueprint/seed persistence, published-paper refusal, all inside one transaction.
- [`paperAssemblyUseCases.ts`](../apps/backend/src/questionBank/use-cases/paperAssemblyUseCases.ts) +
  `POST /api/question-bank/tests/:id/assemble` → `{ test, seedUsed, totalMarks, selectedCount, deficits }`.
- The `generate` sub-tab is now a bucket editor with an **Assemble** action that renders the deficit
  list.

**Media**
- Upload purpose `question_media` (AVIF/WebP/PNG/JPEG + MP3/OGG/WAV/MP4 audio, 10 MB), authority
  `students.write`, stored under `tenants/<t>/question-media/`.
- The uploads gate requires `students.read` for that category and serves it inline with
  `Cache-Control: private, no-store`, `nosniff`, `Vary: Cookie`.
- `attachmentSweepService` unions `contact_attachments` and `question_attachments` URLs and scans
  `attachments/` + `question-media/`; the reference key carries the category so equal file names
  cannot collide.
- Attach/detach endpoints, `attachments` on the question record, and a media section in the detail
  drawer (image preview, audio player, upload/remove).

**Duplicates**
- [`questionSimilarityRepository.ts`](../apps/backend/src/db/repositories/questionSimilarityRepository.ts)
  — `text % $q` candidate narrowing (uses the 0240 trigram index), shared-scorer re-ranking,
  `ILIKE` fallback when `pg_trgm` is unavailable.
- `POST /api/question-bank/questions/check-duplicates` + a debounced warning in the authoring form.

## Deferred

- **D1 — signed URLs.** Access is session + tenant + module gated; URLs are not expiring. Needed only
  if media must be fetched outside a session (PDF worker, email).
- **D2 — `images/` sweep.** The directory still has no reference registry (avatars/branding are not
  DB-tracked), so sweeping it would delete live files. It needs a reference table first.
- **D3 — blocking duplicates.** Detection is advisory; a hard rule needs a product decision.
- **D4 — bulk import/export.** No runners exist (503). The transfer schema mapping is corrected in the
  plan but the runners are a separate change; when they land they must call the same checker.
- **D5 — attachment editing in the create form.** Media is attached from the detail drawer after the
  question exists (attachments need a question id), matching how contact documents work.
- **D6 — blueprint UI depth.** The panel edits bucket rows; per-section blueprints and saved/reusable
  blueprints are a follow-up.

## Verification

```bash
pnpm --filter mms-backend db:migrate && pnpm --filter mms-backend db:check
pnpm typecheck
pnpm --filter mms-backend test && pnpm --filter mms-frontend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankSubsystemsDb.integration.test.ts
node scripts/check-migration-indexes.mjs && node scripts/check-migration-hygiene.mjs
node scripts/check-db-projections.mjs && node scripts/check-code-norms.mjs --ratchet
pnpm run check:i18n
bash scripts/ci/local-ci.sh
```

New coverage: 13 engine cases (determinism, predicates, deficits, marks budget, caps), 9 similarity
cases, 7 use-case cases, and 5 real-Postgres cases (attachment cascade + pairing check, sweep
reference union and post-detach cleanup, assembly persistence + determinism + published lock,
near-duplicate ranking).
