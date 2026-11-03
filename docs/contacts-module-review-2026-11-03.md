# MMS Contacts Module Review — 2026-11-03 (round 3)

Independent, read-only review of the contacts domain at `HEAD = e7ebcbb63` (#266, after
#264–#266). The working tree was clean at review time; the only changes in this pass are this
document and its index entry.

**Why a third pass.** Round 1 (`contacts-module-review-2026-11-02.md`, C-01…C-11), the addendum
(A/B/C lanes) and round 2 (`contacts-module-review-2026-11-02-round2.md`, R2-01…R2-46) audited the
domain before the #264–#266 hardening series. #265 landed the round-2 fixes **plus** a new
automatic role-tagging feature, lean picker routes, student/faculty lifecycle hooks, a worker
sweep, and migrations `0201`/`0202`; #266 added a boot-time pre-migration cleanup. No prior review
covers that delta. This pass re-verifies all twelve round-2 P1/P2s and audits the new surfaces.

**Scope.** `apps/backend/src/routes/tenant/contacts/**`, `apps/backend/src/contacts/**`,
`apps/backend/src/db/repositories/contact*`, `apps/backend/src/db/schema/contact*`,
`apps/backend/src/db/contactSystemTagsPreMigration.ts`, `apps/backend/src/db/dbInit.ts` (migration
wiring only), `apps/backend/src/worker/contactSystemTagSweep.ts`, migrations `0200`–`0202`,
`packages/shared/src/contacts/**`, `packages/shared/src/contracts/contacts*`,
`packages/shared/src/schemas/contacts*`, `apps/frontend/src/tenant/features/contacts/**`,
`apps/frontend/src/lib/contacts/**`, `apps/frontend/src/components/contactLink/**`, and the
contacts unit/DB/e2e specs. Consumers (students/faculty/workshops/google sync) were inspected only
at their contact call sites. Round-2 P3s were not re-audited (a spot check is in §7).

**Method.** The full pre-PR gate suite, the contacts suites in all three packages, the real-Postgres
contacts suites, module-access tests, and live `pg_catalog`/`pg_policies` probes were run. Two
rolled-back SQL probes (inside `BEGIN … ROLLBACK`) exercised the pre-migration cleanup and left no
rows behind (verified: probe tenants = 0, tag count unchanged at 1,502). No source, test, migration
or config file was modified. Findings are labelled **proven** (code path, DDL, test or rolled-back
probe) or **hypothesis**; hypotheses are not counted in the verdict.

---

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| Tree / HEAD | clean; `e7ebcbb63` |
| `pre-pr-review.sh` (secrets, rules integrity, i18n complete + unused, shared purity/structure, faculty legacy, migration index/hygiene/forward-only, work-directory, frontend structure, shared-ui, docs, script tests, ratchet baselines, DB projections, backend boundaries, code norms, typecheck, ESLint; TDD advisory clean) | **21/21 gates pass** |
| `@mms/shared` contacts suites | **44 files / 341 tests passed** |
| `mms-backend` contacts suites | **34 files / 320 tests passed** (incl. `contacts.integration.test.ts`, 62) |
| `mms-frontend` contacts + `src/lib/contacts` + `contactLink` + `contact-action` | **147 files / 458 tests passed** |
| Contacts real-Postgres suites (`test:db`) | **5 files / 23 tests passed** (system tags 10, relationships 5, concurrency 4, metrics 3, export 1) |
| `moduleAccessCoverage.test.ts` / `routeAccess.test.ts` | **1/1** and **11/11 passed** |
| Live database | PostgreSQL **16.14**; 1,502 `contact_tags` rows (1,037 student, 462 faculty, 3 manual), 156 relationships |
| RLS catalogue | `contact_tags` and `contacts` are `ENABLE` + `FORCE`; `contacts` has the split **permissive** tenant policy + **restrictive** soft-delete policy; `contact_tags` has one permissive tenant policy |
| Live schema spot checks | `contacts.updated_at` / `deleted_at` are `timestamp without time zone`; `contacts` has **22** indexes; `contact_tags` has 6 |
| Browser / axe | **Not exercised** — backend :3000 and frontend :5173 are up, but this pass did not run Playwright/axe (scope was the backend-heavy delta; worker availability was not established) |
| Environment | Node `v26.7.0`, pnpm `11.15.1` |

---

## 2. Verdict

The structural ratchets are green, the twelve round-2 P1/P2s genuinely hold, and the new role-tag
feature is unusually well covered for its age (ten real-DB lifecycle cases, an advisory-lock
concurrency test, unique indexes, forced RLS). **No P0 or P1 was found.**

It is **not clean**: three P2s and eight P3s follow. The P2s are concentrated where the new feature
meets existing write paths:

1. the boot-time cleanup permanently deletes manual role-name tags that the backfill will not
   recreate, and neither migration converts colliding rows in place (the documentation says it
   does);
2. tag reconciliation rewrites the contact's optimistic-concurrency version token and `updated_by`
   from student/faculty edits (and the hourly sweep), so an open contact form can 409 and the
   contact's last editor becomes someone who never edited it;
3. batch writers (the editable-CSV round-trip and `bulkSaveContacts`) reconcile only the saved
   contacts, not contacts whose relationship was removed, leaving a stale `Parent`/`Guardian` role
   tag indefinitely.

Release recommendation: **fix N-01 before the `0201`/`0202` deploy.** It is migration-time and
irreversible, but it is latent on the local data set (0 manual reserved-name tags, 0 non-student
parent/guardian relationships), so it is a P2 rather than a P1. N-02/N-03 should follow in the next
contacts hardening change; the P3s are normal backlog.

---

## 3. Findings summary

### 3.1 P1

None.

### 3.2 P2

| ID | Area | Finding |
| --- | --- | --- |
| N-01 | Migration / data loss | Boot-time cleanup deletes manual `Parent`/`Guardian`/`Former …` tags on **every relationship's related contact**, while `0202` only backfills student-owned relationships; colliding rows are deleted and re-inserted, losing id/created-at (contradicting `docs/automatic-role-tagging.md`) |
| N-02 | OCC / attribution | Role-tag reconciliation bumps related contacts' `updated_at` and `updated_by` from student/faculty writes and the hourly sweep; open contact forms then 409 and the sweep cannot broadcast |
| N-03 | Batch writers | `bulkSaveContacts` and the import job reconcile only the saved ids; a removed guardian link leaves the former related contact's `Parent`/`Guardian` tag active forever (the sweep only visits faculty candidates) |

### 3.3 P3

| ID | Area | Finding |
| --- | --- | --- |
| N-04 | DB driver | The reconciler's three reads issue concurrent queries on one transaction client; pg emits a deprecation warning and will reject it in pg 9 |
| N-05 | Audit | One aggregate audit row per reconcile with the synthetic `recordId: "system-tags"`; the sweep (no actor) writes no audit row at all |
| N-06 | Picker access | Any role with students/faculty/workshops read can list the tenant contact directory (`name`, `phone`, `email`, `city`) with no required search term; confirm least-privilege intent |
| N-07 | i18n | System tag labels (`Student`, `Former Parent`, `faculty-…`) are persisted/displayed in English in all four locales; only the "Managed automatically" suffix is translated |
| N-08 | Migration parity | `0201` evaluates faculty windows with `CURRENT_DATE` and no start-date check, unlike the workspace-local `isActiveWindow` runtime; future-dated roles get an active tag until the first reconcile |
| N-09 | Performance | Reconciliation is per-contact/per-tag statement work; an import/sweep of 500 contacts issues hundreds of small writes and one advisory-lock query per contact |
| N-10 | Hygiene | `reconcileAllContactSystemTags` is dead (no caller); `contact_tags_contact_name_uidx` and `contact_tags_workspace_contact_idx` are redundant with the lower-name unique index / primary key |
| N-11 | Tests | The pre-migration test asserts query counts only; nothing asserts that a non-student owner's manual tag survives (the exact N-01 regression) |

---

## 4. Findings — P2 details

### N-01 — P2 — Boot cleanup deletes manual role-name tags the backfill never recreates

**Evidence.**

- The pre-migration's last statement deletes from `contact_tags` for **any** `contact_relationships`
  row whose `relationship` is `parent`/`guardian`, matched on the **related** contact:
  `apps/backend/src/db/contactSystemTagsPreMigration.ts:111-134`. It has no `students` join.
- `0202` backfills only relationships whose **owner is a student contact**:
  `apps/backend/src/db/migrations_drizzle/0202_backfill_relationship_role_tags.sql:18-23` —
  `JOIN students s ON … s.contact_id = cr.contact_id`.
- The cleanup runs on every boot before migrations: `apps/backend/src/db/dbInit.ts:74`
  (`prepareContactSystemTagsPreMigration` → `migrate`).
- **Rolled-back probe (executed):** a non-student owner `probe-owner` linked to `probe-parent`
  with relationship `Parent`, and a manual `Parent` tag on `probe-parent`. The cleanup statement
  reduced the tag count from 1 to 0; the `0202` qualifying-row query returned 0. `ROLLBACK`
  removed the probe; tag count stayed 1,502 and no probe tenant remained.
- The documented behaviour is conversion in place: `docs/automatic-role-tagging.md:46-48` says the
  row "keeps its id/created-at". Both `0201`'s `student_conflicts`/`faculty_conflicts` CTEs
  (`0201_contact_system_tags.sql:70-85`, `:118-133`) and the pre-migration steps **delete** the
  manual row and insert a new `sys-…` row, so the id, `created_at`, and any manual history are
  lost for **all** colliding rows, not just step 5.
- If `0201`/`0202` fail after the cleanup, the deletions are not part of the migration transaction
  and survive; the `system_key` guard (`contactSystemTagsPreMigration.ts:20-27`) then makes the
  next boot skip cleanup. `scripts/deploy-rollback.sh` restores code/dist only, not data.
- The test only counts statements: `apps/backend/src/__tests__/contactSystemTagsPreMigration.test.ts:33-57`.

**Impact.** A tenant that used a manual `Parent`/`Guardian` tag on a contact with a non-student
relationship (family graph, emergency contact, …) permanently loses that tag at deploy. Every
colliding manual tag loses its id/created-at even when a system row replaces it. Locally this is
latent (0 manual reserved-name tags, 0 non-student parent/guardian relationships), so it was not
observable on seeded data; the SQL scope is fully determined.

**Fix.** Remove the boot-time pre-cleanup. Inside `0201`/`0202`, after the columns exist and
**before** creating the unique indexes, convert colliding manual rows with `UPDATE contact_tags
SET source = …, system_key = …, archived = …, name = …` (so id/created-at survive), then run the
backfill `INSERT … ON CONFLICT DO NOTHING`. If a delete is retained for any case, join `students`
and restrict it to the rows the backfill will actually replace. `0201`/`0202` are new in this
release, so amending them is safe for unapplied environments; if any environment already applied
them, treat the deleted rows as unrecoverable and schedule a reconciliation for affected contacts.

**Acceptance test.** Real DB: fixture with (a) a student-owned relationship and a manual `Parent`
tag, (b) a non-student relationship and a manual `Parent` tag, (c) an inactive student. Run the
migration. Assert (a) and (b) both keep a row (converted system row for (a); untouched manual row
for (b)) with the original id/created-at, and only (c) gets `Former …`.

**Confidence.** Proven (SQL scope comparison + rolled-back probe). Frequency is unknown; local
data does not exercise it.

### N-02 — P2 — Tag reconciliation rewrites the contact version and last editor

**Evidence.**

- `reconcileContactSystemTags` updates the parent contact row for every changed contact:
  `apps/backend/src/contacts/systemTags/contactSystemTagReconcile.ts:235-242` —
  `set({ updatedAt: now, ...(actorId ? { updatedBy: actorId } : {}) })`.
- Student create/update/restore call it with an actor but **without** `touchContacts:false`:
  `apps/backend/src/students/use-cases/studentWriteUseCases.ts:105-113`, `:142-150`, `:201-215`.
  Faculty create/update do the same: `apps/backend/src/faculty/use-cases/facultyWriteUseCases.ts:99-107`,
  `:141`.
- The contact form sends the version token (`x-expected-updated-at`) on save:
  `apps/frontend/src/tenant/features/contacts/hooks/useContactMutations.ts:90`; the repository puts
  the predicate in the `UPDATE` (`contactRepositoryPersist.ts`).
- The hourly sweep calls the reconciler with no options (`apps/backend/src/worker/contactSystemTagSweep.ts:55-58`),
  so it also touches the contact — with no actor. Its `broadcastCollection("contacts")` is a no-op
  in a worker because the helper derives the tenant from the request context
  (`apps/backend/src/lib/livePush.ts:211-214`).

**Impact.** A teacher edits a student whose guardian is contact C; C's `updated_at` changes and
`updated_by` becomes the teacher. An admin with C open in the contact form saves and receives the
409 "changed by someone else" path even though only a read-only role tag changed. Contacts sorted
by `updatedAt` reorder from an unrelated student edit. The sweep repeats this hourly for
date-ended faculty roles, leaves `updated_by` pointing at the old editor, and does not push the
change to open clients.

**Fix.** Do not bump the parent contact from the role-tag projection — cache invalidation is
already explicit (`invalidateMultiTierCache` + broadcast). Pass `touchContacts:false` from every
caller, including the sweep. If a freshness signal is genuinely needed, add a dedicated
`system_tags_updated_at` column rather than reusing the OCC token; for the sweep, broadcast with an
explicit tenant and audit as a system action.

**Acceptance test.** DB integration: save a student with a guardian contact; assert the guardian's
`updated_at`/`updated_by` are unchanged and a contact-form save with the pre-edit token still
returns 200. Sweep test: tag change emits a tenant-scoped broadcast and no contact version change.

**Confidence.** Proven by code path; not runtime-reproduced (would require an open form + concurrent
student edit).

### N-03 — P2 — Batch writers leave stale role tags on removed relationships

**Evidence.**

- The single-contact write passes the union of the previous and current related contact ids:
  `apps/backend/src/contacts/use-cases/contactWriteUseCases.ts:137-141`
  (`relatedContactIds(existing ?? undefined, saved)`, helper at `:42-50`).
- The batch path does not: `bulkSaveContacts` reconciles only the saved ids
  (`apps/backend/src/contacts/use-cases/contactBulkWriteUseCases.ts:112-119`); the import job
  reconciles only `importedContactIds` after suppressing per-row reconciliation
  (`apps/backend/src/contacts/use-cases/contactImportJobUseCases.ts:86-91`; `batchMode` gate at
  `contactWriteUseCases.ts:136`, set by the job at `contactImportJobUseCases.ts:59-65`).
- The reconciler expands **current** relationships only: `contactSystemTagReconcile.ts:114-131`.
- The sweep never repairs student/guardian contacts; it only visits faculty-tag/employment
  candidates (`contactSystemTagSweep.ts:28-59`).
- Reachable through the editable CSV round-trip: the contacts export includes a `Contact ID`
  column (`packages/shared/src/contacts/contactExportColumns.ts:30`) and the parser preserves it
  (`contactsCsvParser.ts:118`), while `buildRelationships` always emits the parsed relationship
  list (`:139`). The Apple CSV import path posts those parsed contacts
  (`appleContactsFileParser.ts:28` → `useContactsCrudWriteActions.ts:103`), and `mergeContactPatch`
  replaces provided arrays (`contactValidationUseCases.ts:42-50`). `bulkSaveContacts` is the other
  batch caller (`contactBulkWriteUseCases.ts:112-119`).

**Impact.** Exporting an existing contact, removing a guardian/parent relationship row, and
re-importing the CSV updates the contact (the ID column preserves identity) but leaves the former
related contact with an **active** `Parent`/`Guardian` tag. The tag is a role projection, so the
contact is labelled with a role it no longer has; nothing repairs it (the sweep only looks at
faculty). The docs claim batch saves "reconcile the saved contacts once after the bulk write" but
do not cover removed links (`docs/automatic-role-tagging.md:79-82`).

**Fix.** Before a bulk write, load the saved contacts' existing relationship targets (one query),
and pass `union(previousRelatedIds, currentRelatedIds)` to the reconciler; or reconcile each saved
contact's previous targets after the save. Add a DB test for the import path.

**Acceptance test.** DB integration: export a contact with guardian link G, remove G's
relationship rows, re-import the CSV (with `Contact ID`), and assert G's `Parent` tag becomes
`Former Parent`/archived rather than staying active.

**Confidence.** Proven by code path; no batch test covers relationship removal.

---

## 5. P3 register

Advisory unless they compound with a P2. Evidence and fix are compressed; confidence is **proven**
unless marked.

| ID | Finding | Evidence | Fix / acceptance |
| --- | --- | --- | --- |
| N-04 | The three reconciliation reads issued via `Promise.all` (five selects in total) run concurrently on one transaction client; node-postgres emits `Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0` (observed in the system-tag DB suite) | `contactSystemTagReconcile.ts:145-149` | Await sequentially (or one query); acceptance: DB suite emits no warning |
| N-05 | Audit is one aggregate row per reconcile with the synthetic `recordId: "system-tags"`; the sweep has no actor and writes no audit row, so date-triggered archives are untracked | `contactSystemTagReconcile.ts:250-269`; `contactSystemTagSweep.ts:55-58` | Audit per affected contact (or a system actor + real id); acceptance: sweep archive creates an audit row |
| N-06 | Picker access is granted by any of students/faculty/workshops read, `search` is optional, and the cap is 20/page, so teacher/assistant/librarian can enumerate the whole contact directory (name/phone/email/city) without `contacts.read` | `apps/backend/src/lib/rbacCanModuleHelpers.ts:67-77`; `packages/shared/src/contacts/contactPicker.ts:13,31-32`; route test `contactPickerRoutes.test.ts:142` | Confirm with product; require a minimum search term or scope to the calling module, add a rate limit; acceptance: role enumeration test |
| N-07 | System tag names are English data displayed verbatim in ar/ur/fa; only the "Managed automatically"/"Former role" suffixes are translated | `apps/frontend/src/tenant/features/contacts/components/ContactTagBadge.tsx:35-78`; `appTranslationsEn.ts:2912-2913`; no `contacts.tags.student`-style keys | Map `systemKey`/label to i18n keys for the fixed six labels and localize the `Former ` prefix (keep raw values for export); acceptance: Arabic render test |
| N-08 | `0201` uses `CURRENT_DATE` and ignores employment/designation start dates; runtime uses the workspace-local day plus `isActiveWindow`. Future-dated roles get an active tag at migration, and non-UTC tenants can archive a day early/late | `0201_contact_system_tags.sql:96-117`; `contactSystemTagCompute.ts:33-60`; `contactSystemTagReconcile.ts:48-60`; `contactSystemTagFacultyCompute.ts:140-149` | Use the workspace-local day and start windows in the backfill, or reconcile every affected contact immediately after migration; acceptance: future-start fixture + a negative-offset timezone fixture |
| N-09 | Reconciliation writes one statement per tag row and one advisory-lock query per contact; the sweep materialises all candidates for a tenant before batching | `contactSystemTagReconcile.ts:139-143,166-232`; `contactSystemTagSweep.ts:30-58` | Batch the tag upserts and lock acquisition; measure a 5k-contact sweep; acceptance: bounded statement count |
| N-10 | Dead `reconcileAllContactSystemTags` (no caller) and two redundant `contact_tags` indexes: `contact_tags_workspace_contact_idx` is a prefix of the primary key, and `contact_tags_contact_name_uidx` is superseded by the lower-name unique index | `contactSystemTagUseCases.ts:132-147`; live `pg_indexes` | Delete the function and drop the two indexes in a forward migration; acceptance: index ratchet + plans still use the remaining indexes |
| N-11 | The pre-migration test asserts only query counts; it cannot catch N-01 (no data fixture) | `apps/backend/src/__tests__/contactSystemTagsPreMigration.test.ts:33-57` | Add a DB-backed fixture asserting non-student manual tags survive / collisions convert in place |

---

## 6. Round-2 re-verification at HEAD

| Prior ID | Status | Evidence at `e7ebcbb63` |
| --- | --- | --- |
| R2-01 export truncation | **Holds** | Pager no longer falls back to the last row id and throws on `hasMore` with zero rows (`csvExportStreamFactory.ts:64-90`); 13 unit + 1 real-DB 300-row export test pass |
| R2-02 CSV import body | **Holds** | Dialog chunks and posts `{contacts}` (`ContactsCsvImportDialog.tsx`); 5 component + 7 import-job tests pass |
| R2-03 picker 403s | **Holds** | Lean `GET /picker` + `/picker/:id` with `canUseContactPicker`, sanitized 4-field shape (`contactPickerRoutes.ts:69-99`); 8 route + 7 access + 4 hook tests pass |
| R2-04 relationship email/gender | **Holds** | `0200` adds both columns and the index; persist/read mappers carry them; 5 relationship DB tests pass |
| R2-05 father/mother order | **Holds** | `resolveStudentGuardianLinks` uses persisted gender + normalized helpers (`studentGuardianFromContacts.ts:150-215`); 12 shared tests pass |
| R2-06 inference clobber | **Holds** | Manual links never relabelled, stale inferred rows removed, target writes use `saveIfVersionMatches` + audit (`contactInferenceApply.ts:100-240`); 10 tests pass |
| R2-07 duplicate explosion | **Holds** | 100-name-bucket cap and 5,000-pair cap (`contactDuplicateUtils.ts:21,27,224,242`); 18 shared + 14 service tests pass |
| R2-08 unstable sort | **Holds** | `id asc` tiebreaker on every branch (`contactRepositoryListFilter.ts:26-59`); 3 tests pass |
| R2-09 selection a11y | **Holds** | Localized row/select-all labels passed into `WorkBatchTable` (`ContactsListDesktopTable.tsx`); 3 tests pass |
| R2-10 VCF cap | **Holds** | `export-vcf` streams to storage with no 500-record materialisation (`registerContactsVcfExportJobRunner.ts`); 9 tests pass |
| R2-11 metrics subplans | **Holds** | Single lateral/raw-SQL aggregate + `0200` priority index (`contactRepositoryMetrics.ts`, `contactMetricsSql.ts`); 11 unit + 3 DB (EXPLAIN without `SubPlan`) tests pass |
| R2-12 RLS inert | **Holds** | `0200` recreates the permissive policy + **restrictive** soft-delete policy; live `pg_policies` confirms; `enableIncludeDeleted` is wired on list/find/restore; 5 relationship/RLS DB tests pass |

**Verdict on prior fixes:** all twelve hold. No regression from #265/#266 was found in their paths.

---

## 7. Round-2 P3 residuals (spot check only)

These are **not** new findings; they are round-2 P3s that the delta did not fix. They remain open
and are listed so the register is not mistaken for “all P3s closed”.

| ID | Status | Evidence |
| --- | --- | --- |
| R2-16 sanitizer mirrors | **Partial** | `tags`/`systemTags` are now stripped with `tag` (`contactResponseSanitizer.ts:117-129`), but a hidden `lastName` still leaves the composed `name` |
| R2-17 length bounds | **Open** | `tags: z.array(z.string())` and `firstName: z.string().min(1)` accept 201/151 chars (`contacts.dto.ts:115-127`; executed parse), while live columns are `varchar(200)`/`varchar(150)` → 500 |
| R2-40 timestamp drift | **Open** | Live `contacts.updated_at`/`deleted_at` are `timestamp without time zone`; Drizzle declares `timestamptz` |
| R2-41 index budget | **Open** | Live `contacts` has 22 indexes, including the two round-2 named as redundant |
| R2-42 read over-fetch | **Open** | `city` sort is still a correlated subquery (`contactRepositoryListFilter.ts:49-57`); the unique-field pre-check still hydrates all children |

---

## 8. Checked and found sound

1. **Role-tag ownership.** Manual writes, CSV import (through `prepareContactRecord`), bulk tag,
   merge and bulk save all filter reserved names; contact saves and bulk saves delete only
   `source IS NULL` rows, so system rows survive every write path
   (`contactPersistPersonalChildren.ts:40-52`, `contactRepositoryBulkSave.ts:78-86`,
   `contactRepositoryTags.ts:42-50`; DB tests at `contactsSystemTagsDb.integration.test.ts:365`).
2. **Role-tag transitions.** Ten real-DB cases cover Student/Parent/Guardian create, end, unlink,
   relink, soft-delete, restore; faculty tenure + assignments, deletion, same-name collapse,
   date windows, and concurrent reconciles. Passed 10/10.
3. **Concurrency.** Per-contact transaction-scoped advisory lock, sorted acquisition, unique
   partial indexes; the two-connection test at `contactsSystemTagsDb.integration.test.ts:531`
   passes.
4. **Picker projection.** The endpoint sanitizes before projecting and returns only
   `{id,name,phone,email?,city?}`; the restricted-phone/email/city route test passes, and
   create-from-picker is hidden unless `contacts.write` (`ContactPicker.tsx:59-60`).
5. **Tenant isolation.** Every new tag/role query pins `workspace_subdomain`; `contact_tags` is
   `FORCE` RLS; the picker runs inside `withTenant*`; no raw cross-tenant SQL was found.
6. **Module access.** Picker routes use the `availability` action with an in-handler gate and are
   covered by `moduleAccessCoverage` / `routeAccess`; the contacts module stays required.
7. **Round-2 fixes.** All twelve re-verified above, with their pinning tests executed.
8. **Migration plumbing.** `0200`–`0202` are in the journal with snapshots; index, hygiene and
   forward-only ratchets pass; the boot path serialises migrations under the boot advisory lock.
9. **Gates.** 21/21 pass, including `check:i18n`, `check:code-norms`, typecheck and ESLint.

---

## 9. Remediation order

1. **N-01** — before deploying `0201`/`0202`: convert in place, scope any delete to student-owned
   relationships, remove the boot-time cleanup, add the DB fixture test.
2. **N-03** — batch relationship-removal reconciliation + DB test.
3. **N-02** — stop touching the parent contact from the reconciler; pass `touchContacts:false`;
   explicit tenant broadcast and audit for the sweep.
4. **N-04, N-05, N-11** — cheap correctness/observability fixes in the same change.
5. **N-08, N-09, N-10** — migration parity, write batching, dead code/index cleanup.
6. **N-06, N-07** — product decision (picker scope) and i18n mapping.
7. **R2-16, R2-17, R2-40, R2-41, R2-42** — existing P3 backlog.

No finding justifies bypassing normal review or an emergency release.

---

## 10. Residual risk and what this review could not prove

- **N-02 and N-03 are code-path proven, not runtime-reproduced.** Reproducing N-02 needs an open
  contact form plus a concurrent student edit; reproducing N-03 needs a batch import that removes
  an existing link. Both mechanisms are fully determined by the executed code.
- **N-01 was proven with a rolled-back probe**, not by running the real migration. The probe used
  a synthetic tenant and left no rows (probe tenants = 0; tag count unchanged). Local data has no
  manual reserved-name tag and no non-student parent/guardian relationship, so the loss is latent
  here but not disproven for other tenants.
- **No browser/axe evidence this round.** The dev servers are up, but the contacts e2e/axe specs
  were not run; the new tag chips and picker were verified by unit/component tests only.
- **RLS was inspected, not enforced.** This pass ran the contacts `test:db` suites but not
  `test:rls`, so the catalogue and DDL were used for the policy shape (matching the prior rounds'
  method); no live tenant request was replayed under the restricted role.
- **The worker sweep was not executed** (it would mutate tenant data); its candidate selection and
  scheduling are unit-tested, and the reconciler it calls is DB-tested.
- **No production telemetry** was used; frequency and tenant prevalence for N-01/N-02/N-03 are
  unknown. The local database is a demo tenant.

---

## 11. Remediation status (working tree, uncommitted)

The P2s and the two cheap P3s were addressed forward-only. `0201`/`0202` are on `origin/main` and
`scripts/check-migrations-forward-only.mjs` freezes them, so no migration file was edited.

| ID | Status | Fix | Pinning evidence |
| --- | --- | --- | --- |
| N-01 | **Partial** | `CONTACT_TAG_PRE_MIGRATION_CLEANUP.relationshipRoles` now joins `students`, so the boot cleanup only removes the relationships `0202` will recreate; tags on non-student relationship owners survive. The statements are exported for the regression test. | `contactSystemTagsPreMigrationDb.integration.test.ts` (student-owned tags deleted, non-student tags remain; rolled back) |
| N-02 | **Fixed** | The parent-contact `updated_at`/`updated_by` write and the `touchContacts` option are gone; the reconciler broadcasts with an explicit tenant; the import worker uses the same explicit broadcast. | `contactsSystemTagsDb.integration.test.ts` status-archive test asserts unchanged contact version/editor; `contactImportJobUseCases.test.ts` asserts the tenant broadcast |
| N-03 | **Fixed** | New `collectRelatedContactIds`/`loadPreviousRelationshipTargets` helper (summary projection); `bulkSaveContacts` and the import job pass prior targets to the reconciler. | `contactBulkWriteUseCases.test.ts` (unit) + bulk-removal case in `contactsSystemTagsDb.integration.test.ts` |
| N-04 | **Fixed in the reconciler** | The three reads are sequential (`contactSystemTagReconcile.ts:145-149`). One deprecation warning still comes from `getWorkspaceBranding`'s own `Promise.all` in the test harness (workspace repository, outside contacts) and was not touched. | System-tag DB suite; trace shows `loadWorkspaceRow`/`getWorkspaceBranding`, not the reconciler |
| N-11 | **Fixed** | The data-level pre-migration test replaces the query-count-only guard for the N-01 path. | `contactSystemTagsPreMigrationDb.integration.test.ts` |
| N-05…N-10 | **Deferred** | Audit granularity, picker scope, tag i18n, migration date parity (immutable migrations), write amplification, dead code/redundant indexes | Round-2/round-3 P3 register remains |

**Residual (N-01).** The permanent loss of non-student relationship tags is fixed for
future/unmigrated databases. Colliding role tags still lose their old `id`/`created_at` because the
backfill replaces rather than converts them, and environments that already ran the old cleanup
cannot recover the deleted rows. Full history preservation would need a pre-migration backup table
and a restore migration; it cannot repair already-migrated environments and was not attempted.

**Verification (working tree).** `mms-backend` typecheck passes; all backend contacts suites pass
(**35 files / 323 tests**, including the new bulk-save unit test); the contacts DB suites pass
(**6 files / 25 tests**, including the new pre-migration regression and the bulk-removal case);
`pre-pr-review.sh` passes **21/21** (only the TDD-pairing advisory lists the three changed
use-case files without same-named specs). No migration file changed, so the forward-only gate stays
green. `docs/automatic-role-tagging.md` was corrected to distinguish runtime in-place conversion
from the backfill's replacement behaviour.
