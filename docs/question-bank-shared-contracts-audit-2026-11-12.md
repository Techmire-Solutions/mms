# Question Bank Shared Contracts & TypeScript Definitions Audit (2026-11-12)

**Scope.** `packages/shared`: the Question Bank DTOs, enums/taxonomy, Zod schemas and their alignment
with the static types and the database columns.

**Method.** Read the record/write/insert schemas, the entity interfaces, the invariant engine, the
preference/field-config schemas, the Drizzle columns and the migrations; then added compile-time and
database-level parity checks.

## 1. Discriminated-union DTOs

| # | Sev | Finding |
|---|---|---|
| C1 | **P1** | **No discriminated union existed.** `QuestionBankQuestion` and `questionBankQuestionRecordSchema` are one flat record (`type: QuestionType`, `options: string[]`, `answer: string`); per-type rules lived only in a runtime `superRefine`, so `{type:"mcq", options:[]}` or `{type:"true_false", options:[], answer:"maybe"}` compiled. `booleanAnswer`, `rubric`, `maxWords` and an `essay` type do not exist. True/False intentionally stores the chosen **localized label** in `answer` (`options: [trueLabel, falseLabel]`), so a boolean column would lose localization. |

## 2. Enum & taxonomy consistency

| # | Sev | Finding |
|---|---|---|
| C2 | **P1** | **The taxonomy was declared three times**: the `QuestionType` union + `QUESTION_TYPE_IDS` (`questionBankCore.ts`), the Zod enums (`questionBankModuleManifest.ts`), and `z.enum(["en","ar","ur","fa"])` repeated in three schemas; statuses lived separately in `questionLifecycle.ts`. |
| C3 | **P1** | **No DB CHECK on `questions.type`, `difficulty` or `question_language`.** Only status/marks/version were constrained; the columns accepted any string. |
| C10 | P3 | **No Bloom/cognitive taxonomy** — `difficulty` is the only cognitive dimension; nothing to "confirm". |

## 3. Runtime schema alignment

| # | Sev | Finding |
|---|---|---|
| C4 | **P1** | **The preference schema contradicted the static types.** `questionBankPreferencesPutBodySchema` accepted `categories`, `sourceBooks`, `questionTypes`, `difficultyLevels` as `z.array(z.record(z.string(), z.unknown()))` and was `.passthrough()`; the field-config schema accepted a retired `customFields` array (`QuestionBankSettings.customFields` is `[]`). |
| C5 | **P2** | **Weak JSONB.** `question_bank_field_configs.config` / `question_bank_module_preferences.preferences` were `Record<string, unknown>` with `as Partial<…>` casts; `test_questions.question_snapshot` was untyped and built by raw `jsonb_build_object`. |
| C6 | **P2** | **No schema/type parity check.** The interface lacked `createdAt`/`updatedAt` (schema had them) and the schema lacked `usageCount` (returned by the list). |
| C7 | **P2** | **Dead duplicate contract file**: `schemas/questionBank.dto.ts` re-declared `questionBankListQuerySchema` and six unused sanitized CRUD schemas; no source importer. |
| C8 | **P2** | **Read type lies about `answer`**: the list returns summaries for read-only callers, but the FE casts `body.questions as QuestionBankQuestion[]`. |
| C9 | P3 | **Config contract entries were decorative**: declared with `z.record(z.string(), z.unknown())` responses, but the paths are served by `questionBankSetupConfigRoutes`, not the contract router. |

## 4. What shipped

- **Taxonomy single source** (`examinations/questionTaxonomy.ts`): `QUESTION_TYPES`,
  `QUESTION_DIFFICULTIES`, `QUESTION_LANGUAGES`, `QUESTION_STATUSES` + the Zod schemas and types.
  `questionBankCore`, the manifest and `questionLifecycle` re-export them; the three inline language
  enums are gone.
- **Migration 0243** adds `questions_type_check`, `questions_difficulty_check` and
  `questions_question_language_check` with a preflight that raises on out-of-taxonomy rows.
- **Discriminated write DTO**: `questionBankQuestionWriteSchema` is now
  `z.discriminatedUnion("type", …)` with per-type branches, still delegating semantic rules to
  `validateQuestionByType`. `questionDto.ts` adds the read union (`McqQuestion`,
  `TrueFalseQuestion`, `ShortAnswerQuestion`, `StructuredQuestion`), `toQuestionDto(record)` and type
  guards; the inferred write type narrows on `type`.
- **Strict registry schemas**: `questionCategorySchema`, `questionSourceBookSchema`,
  `questionTypeRegistryEntrySchema`, `questionDifficultyRegistryEntrySchema` and a typed
  preferences response; the PUT body is `.strict()`, the retired `customFields` is rejected, and
  legacy blobs are validated per array on read (fallback to the default instead of leaking a bad
  shape).
- **Typed JSONB**: `question_snapshot` is `$type<QuestionSnapshot>()` with a shared strict
  `questionBankQuestionSnapshotSchema`; config/preferences blobs are typed and the repository/service
  casts (`as Partial<…>`, `as never`) are gone.
- **Dead code removed**: `schemas/questionBank.dto.ts` and its barrel export.
- **Parity**: `QuestionBankQuestion` ≡ `z.infer<recordSchema>` (compile-time test), taxonomy arrays ↔
  migration SQL (backend test), invalid DB inserts return `23514` (DB test), and the published
  snapshot parses with the shared schema (DB test).

## 5. Deferred

- **D1 — per-type storage fields**: `questions.boolean_answer boolean`, `rubric text`,
  `max_words integer` (+ `essay` if required). Only then can the union require `booleanAnswer` /
  `rubric` / `maxWords`; a localized true/false label model must also be migrated first.
- **D2 — cognitive/Bloom taxonomy**: `questions.cognitive_level` + enum + filter + report dimension.
- **D3 — read-model split for `answer`**: type the collection as the client union and replace the
  `answer`-dependent components with a guarded accessor (touches the work table, cards, detail and
  form).

## 6. Verification

```bash
pnpm typecheck
pnpm --filter @mms/shared test
pnpm --filter mms-backend test
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/questionBankPersistenceDb.integration.test.ts
bash scripts/ci/local-ci.sh
```

New tests: taxonomy arrays ↔ schemas ↔ migration SQL; discriminated write payload (mcq/true_false
violations); `toQuestionDto` narrowing and rejection; strict preference payload (unknown keys, bogus
registry ids, retired `customFields`); record-schema/interface parity; DB `23514` for out-of-taxonomy
values; published-snapshot schema parse.
