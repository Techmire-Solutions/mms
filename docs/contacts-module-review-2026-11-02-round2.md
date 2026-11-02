# MMS Contacts Module Review — 2026-11-02 (round 2)

Independent, read-only review of the contacts domain at `main` = `e7fd7134b` (“harden messaging
recipient exposure, uploads security, and duplicate caching”, #264). The working tree was clean at
review time and remained clean afterwards.

**Why a second review.** Round 1 (`contacts-module-review-2026-11-02.md`, C-01…C-11) and the
deep-dive addendum (`contacts-module-review-2026-11-02-addendum.md`, A/B/C lanes) audited
security/tenancy, the write and soft-delete paths, contracts, frontend data flow, messaging,
uploads and duplicate scan. This pass re-verified all 21 of those findings at HEAD and audited the
surfaces they explicitly did not cover: setup/fields governance, CSV/VCF import-export, Google
sync, list pagination and indexes, and cross-module consumers (students/faculty/workshops/messaging).

**Method.** The full pre-PR gate suite, contacts unit/integration suites in all three packages, and
the contacts axe specs were executed. Read-only SQL probes ran against the local Docker Postgres
(catalogue, `EXPLAIN`, one rolled-back temp-table length probe). No source, test, migration or
config file was modified; probes that needed a schema boundary were executed against the already
built `packages/shared/dist`. Findings are labelled **proven** (production code path executed or
schema/DDL inspected) or **hypothesis**; a hypothesis is never counted in the verdict.

**Scope.** `apps/backend/src/routes/tenant/contacts*`, `apps/backend/src/contacts/**`,
`apps/backend/src/db/repositories/contact*`, `apps/backend/src/db/schema/contact*`,
`packages/shared/src/contacts/**`, `packages/shared/src/contracts/contacts*`,
`packages/shared/src/schemas/contacts*`, `apps/frontend/src/tenant/features/contacts/**`,
`apps/frontend/src/lib/contacts/**`, the shared work/table and CSV-export machinery they consume,
contacts migrations `0004`–`0101`/`0108`, and contacts e2e/a11y specs. Consumers were inspected only
where they call contact services or render contact pickers.

---

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pre-pr-review.sh` gate suite (secrets, rules integrity, i18n complete + unused, shared purity/structure, faculty legacy, migration index/hygiene/forward-only, work-directory, frontend structure, shared-ui, docs, script tests, ratchet baselines, DB projections, backend boundaries, code norms, typecheck, ESLint; TDD pairing advisory) | **21/21 gates pass** + TDD advisory clean |
| Typecheck (`@mms/shared`, `mms-backend`, `mms-frontend`) | **Pass** (inside the gate suite) |
| `@mms/shared` contacts suites | **43 files / 337 tests passed** |
| `mms-backend` contacts suites (incl. `contacts.integration.test.ts`) | **31 files / 292 tests passed** |
| `mms-frontend` contacts + `src/lib/contacts` | **137 files / 423 tests passed** |
| `moduleAccessCoverage.test.ts` / `routeAccess.test.ts` | **1/1** and **11/11 passed** |
| `mms-backend test:db contact` (real Postgres 16.14) | **4/4 passed** (`contactsConcurrencyDb`: OCC + recipient projection) |
| `check:i18n` | **9,476 keys; ar/ur/fa missing = 0** |
| `check:code-norms` | 0 explicit `any`; 0 wildcard projections; 4 files over 300 LOC (baseline 4, **none in contacts** — largest non-test file 235 lines); 0 arbitrary colour expressions |
| axe — populated contacts directory @1440 with drawer, and @375 cards | **2 passed** (31.2 s; tags include `wcag22aa`) |
| `contacts-import-export.spec.ts` | **Blocked, not a product verdict** — the import job stayed `pending` because the local dev entry point runs no BullMQ worker (see §8) |
| Responsive “contacts Reports/Setup viewport” | **Blocked** — failed in the login helper before the contacts page rendered |
| Local RLS enforcement | **Not exercised** — the dev connection role bypasses RLS (`[rls] the database role bypasses row-level security` in backend logs); policy catalogue inspected instead: all **17** `contact%` tables are `ENABLE` + `FORCE` RLS |
| Environment | Node `v26.7.0`, pnpm `11.15.1`; backend `:3000`, frontend `:5173`, Postgres/Redis in Docker |

---

## 2. Verdict

The structural ratchets are genuinely green and the module remains well-factored for its size
(0 `any`, 0 wildcard projections, no file over 300 lines, every contact table RLS-forced). The
#261–#264 fixes hold where they claimed to hold.

It is **not clean**. There are **no P0s**, but there is **one P1**: a sorted CSV export silently
drops rows once the matching set exceeds one export page (250 rows) — the contacts directory opens
sorted by name, so this is the default path for any real tenant. Eleven **P2s** follow, clustered in
three places the first review did not enter: export/import/sync correctness (CSV import always
400s, VCF export dies above 500 contacts, relationship fields are never persisted), list/query
correctness (unstable `ORDER BY`, quadratic duplicate pairing, per-row correlated metric subplans),
and cross-module access (staff roles without `contacts.read` get a broken contact picker in students,
faculty and workshops). Governance surfaces (tab enablement, tenant field config, dynamic
validation) are inert end-to-end but currently latent: no tenant has a stored field config and Setup
exposes no editor.

Release recommendation: fix the export P1 before the next contacts release; schedule the P2s
immediately after. No hotfix is implied for a security breach — the one visibility concern is a
safety-net gap (soft-delete RLS), not an observed cross-tenant leak.

---

## 3. Findings summary

### 3.1 P1

| ID | Area | Finding |
| --- | --- | --- |
| R2-01 | Export / data integrity | CSV export switches from the caller’s sort to id-keyset paging after page 1, silently dropping rows (default directory sort is `name`) |

### 3.2 P2

| ID | Area | Finding |
| --- | --- | --- |
| R2-02 | Import | The advertised “Import CSV” path always returns 400: the dialog posts `{rows}` while the strict route contract requires `{contacts}` |
| R2-03 | Cross-module access | Contact pickers in students/faculty/workshops call `/api/contacts` and 403 for teacher/assistant_teacher/librarian, which have those modules but no `contacts.read` |
| R2-04 | Data model | Relationship `email`/`gender` are typed, exported and imported but have no columns and are dropped by the write/read mappers (silent CSV field loss) |
| R2-05 | Student linkage | Father/mother assignment falls back to relationship insertion order because relationship gender is never persisted |
| R2-06 | Relationship inference | Reciprocal inference relabels a user’s manual link as `inferred`, never removes stale inferred links, and rewrites target contacts without OCC or audit |
| R2-07 | Duplicate scan | Exact-name buckets are paired quadratically and every pair is persisted verbatim, so same-name-heavy directories explode in CPU and cache size |
| R2-08 | Pagination | List sorts on name/first/last/gender/city have no `id` tiebreaker while pages use OFFSET, so rows can repeat or disappear between pages |
| R2-09 | a11y / i18n | Desktop row checkboxes announce `Select row <uuid>` in English; the localized `contacts.table.selectContact` keys exist and are used by mobile cards |
| R2-10 | Export | VCF export keeps a hard 500-record materialisation cap and the only production caller never raises it, so Apple/VCF export fails for real tenants |
| R2-11 | Performance | Command-centre metrics run one correlated “primary phone” subplan (with a per-row Sort) per contact on every module open |
| R2-12 | RLS / soft-delete | The contacts soft-delete RLS policy is neutralised by a stale permissive policy and the read path never sets `app.include_deleted`; trash works only because of that stale policy |

### 3.3 P3 register

34 advisory items are catalogued in §5 (IDs R2-13…R2-46). They are real but either latent
(API-only configuration), bounded by configuration, or hygiene (DRY/a11y/validation/performance);
none changes the verdict.

---

## 4. Findings — P1 and P2

### R2-01 — P1 — Sorted CSV exports silently drop rows

**Evidence.**
- The directory default sort is `name`: `apps/frontend/src/tenant/features/contacts/hooks/useContactsDirectoryFilters.ts:29`.
- The export always forwards it: `useContactsExportActions.ts:79-85` (`sortField, sortDir` in `buildFilteredQuery`), reaching the job unchanged (`apps/backend/src/lib/csvExportEnqueue.ts:9-18` keeps every query key).
- The export stream advances with `nextCursor ?? lastRow.id`: `apps/backend/src/lib/csvExportStreamFactory.ts:76-77` (same fallback in `apps/backend/src/lib/createModuleExportService.ts:104-106`).
- `nextCursor` is only produced in cursor mode: `apps/backend/src/db/repositories/listPageHelper.ts:96` — `isCursorPaging && hasMore && …`.
- Page 1 therefore runs OFFSET with the caller’s sort and yields **no** cursor; page 2 enters cursor mode, which forces `ORDER BY id ASC` and adds `id > afterId` (`listPageHelper.ts:55-62,76`), discarding the requested sort.

**Impact.** With more than 250 matching contacts, page 1 is the first 250 rows *by name*; every later
page is “id greater than the last name-sorted row’s id”, in id order. Any matching contact whose id
is smaller than that cursor is never exported, the file is unsorted, and the reported count is the
truncated count. Reachable from the default “Export” action (no explicit selection) and from any
client that sends `sortField`. The shared helper means students/finance/sessions/enrollments carry
the same root cause; contacts is the module whose default is non-id.

**Fix.** Either make the cursor carry the sort key (`(sortField, sortDir, lastValue, id)` keyset), or
force id ordering whenever cursor paging is used and have the export normaliser drop/override
`sortField` (assert that a fallback cursor is never combined with a non-id sort).

**Acceptance test.** Seed 300 contacts whose name order differs from id order; request CSV export
with `{sortField:"name",sortDir:"asc"}`; assert 300 data rows and non-decreasing names.

**Confidence.** Proven from the executed code path; not runtime-reproduced because no local tenant
has more than 38 contacts (seeding is out of scope for a read-only review).

### R2-02 — P2 — The CSV import dialog always fails validation

**Evidence.**
- `apps/frontend/src/tenant/features/contacts/components/ContactsCsvImportDialog.tsx:23-24` — `apiPath="/api/contacts/import"`, `schema={contactsTransferSchema}`.
- The shared starter posts `{ rows, label }`: `apps/frontend/src/lib/backgroundJobs/useModuleCsvImportActions.ts:96-101`.
- The route contract is strict and expects `contacts`: `packages/shared/src/schemas/contactsImport.dto.ts:38-44`; parsed at `apps/backend/src/routes/tenant/contacts/contactAuditExportRoutes.ts:50-51`.
- Executed against the built schema: `contactsImportBodySchema.safeParse({rows:[…]})` → `invalid_type ["contacts"] "expected array, received undefined"`.
- The dialog is reachable from the Work header: `ContactsPageHeaderActions.tsx:69-79` (“Import CSV”) → `ContactsPageOverlays.tsx:152-157`.

**Impact.** The advertised CSV import path returns a generic validation error for every file; the
vCard path works (and happens to accept `.csv` as a workaround). The dialog’s 16-column transfer
schema is also narrower than the 60+ column CSV exporter, so export→import parity is not wired at
the API seam.

**Note on the row shape.** A transfer-shaped row (`{name, firstName, phone, email, city}`) **does**
validate against `contactsImportBodySchema` (executed), and the scalar `phone` is expanded into
`phones[]` by `normalizeContactPhones` inside `prepareContactRecord`. The fatal mismatch is the body
key, plus the missing batch/chunk contract — not the row fields.

**Fix.** Post `{ contacts: parsedRows }` (chunked at `CONTACTS_IMPORT_MAX_BATCH`) — or add a
module-specific route that maps transfer rows to `Contact` before enqueueing — and reuse the full
`parseContactsCsv` column set in the dialog.

**Acceptance test.** Component test asserts the POST body is `{contacts:[…]}`; an integration test
round-trips a CSV produced by the contacts exporter (headers → 202 → N rows imported); a 501-row
case proves chunking.

**Confidence.** Proven (schema executed).

### R2-03 — P2 — Contact pickers 403 for staff roles without `contacts.read`

**Evidence.**
- `/api/contacts` list/get require `canReadCollection(user,"contacts")`: `apps/backend/src/routes/tenant/contacts/contactCrudRoutes.ts:35,83`; `canReadContacts` is `roleHasPermission(role, "contacts.read")` (`apps/backend/src/lib/rbacCanModuleHelpers.ts:7-13`).
- The shared picker runs in server mode and calls those endpoints: `apps/frontend/src/components/contactLink/useContactPickerState.ts:70-86` → `useContactsContractList` / `useContactById` (`apps/frontend/src/tenant/features/contacts/hooks/useContactsQueries.ts:101-118`).
- Consumers render it with no permission gate: `apps/frontend/src/tenant/features/students/components/StudentContactSection.tsx:77-80`, `.../faculty/components/FacultyFormContactSection.tsx`, `.../workshops/components/WorkshopParticipantsSection.tsx:62`.
- Default roles: `teacher` has `students: read/update`, `faculty: read/update`, `workshops: create/read/update` but **no** `contacts` grant (`packages/shared/src/auth/userRbacDefaultRoles.ts:95-135`); assistant_teacher and librarian likewise.
- Executed: `roleHasPermission("teacher","contacts.read") === false`, while `STUDENTS_MODULE_MANIFEST.permissions.write` and `WORKSHOPS_MODULE_MANIFEST.permissions.write` are `true` for the same role.

**Impact.** A teacher can open a student/faculty edit form and the workshop participants panel, but
the picker’s search and the linked-contact resolve return 403 — the picker renders empty, and the
selected contact’s name/phone cannot be resolved. The same applies to any custom role granted a
module write without `contacts.read`.

**Fix.** Add a lean picker/resolve projection gated on the *calling* module’s read (mirroring the
messaging recipient fix in #264), or grant `contacts:read` to the staff roles that use pickers. Do
not render the picker when the role cannot read contacts — show a localized “needs Contacts access”
state instead.

**Acceptance test.** Route test: a teacher token gets 403 from `/api/contacts` and 200 from the new
picker endpoint with only `{id,name,phone}`; a component/e2e test opens student edit as teacher and
finds a usable picker.

**Confidence.** Proven (code path + role matrix executed).

### R2-04 — P2 — Relationship `email`/`gender` are accepted, exported and imported but never stored

**Evidence.**
- Type declares them: `packages/shared/src/contacts/contactEntityTypes.ts:100-107` (`RelationshipContact.email`, `.gender`).
- The table has no such columns: `apps/backend/src/db/schema/contactProfileTables.ts:162-169` (`related_contact_id, name, relationship, phone, inferred, inferred_from_contact_id, inference_depth, sort_order`).
- Write mapper drops them: `apps/backend/src/db/repositories/contactPersistEngagementChildren.ts:31-42`; read mapper drops them: `contactChildRowMappers.ts:134-151`.
- The CSV surface treats them as real: export columns `packages/shared/src/contacts/contactExportColumns.ts:106-107`, extractors `contactExportExtractors.ts:163-169`, import parser `contactsCsvParser.ts:87-98`.

**Impact.** CSV import silently discards relationship email/gender; the two export columns are
permanently blank; guardian messaging that reads `RelationshipContact.email`
(`packages/shared/src/students/studentGuardianFromContacts.ts:23-24`) can never receive a persisted
value.

**Fix.** Choose one SSOT: add `email`/`gender` columns plus persist/hydrate/JSON-projection changes,
or delete the fields from the shared type, export columns, extractors and CSV header map.

**Acceptance test.** DB round-trip: save a relationship with `{gender:"male", email:"x@y.z"}`, reload,
assert both survive; CSV export→import round-trip equality for both columns.

**Confidence.** Proven.

### R2-05 — P2 — Student father/mother assignment is insertion-order based

**Evidence.**
- `packages/shared/src/students/studentGuardianFromContacts.ts:174-196` picks slots by
  `link.gender === "male"/"female"` and otherwise does `[fatherLink, motherLink] = parentLinks;`.
- Relationship gender is never hydrated (R2-04), so the gender branch is unreachable on persisted
  data; the order fallback always runs.
- The comparison is strict lowercase while the domain normalizes aliases elsewhere
  (`contactRelationshipRules.ts:22-42`) and CSV import can store `"Male"`.

**Impact.** With two “Parent” links, whichever row was inserted first becomes Father. Linking the
mother first places her contact id/name in the student’s father slots, which flow into student
list/export, the guardian card and guardian messaging.

**Fix.** Hydrate the related contact’s gender into relationship rows (join on `related_contact_id`) and
reuse the normalized gender helpers; keep insertion order only as a documented last resort.

**Acceptance test.** DB integration: parent A (female, linked second) + parent B (male, linked first) →
father = B, mother = A; a pure test with `gender:"Male"` also maps correctly.

**Confidence.** Proven for the persistence gap and the order fallback; frequency is a hypothesis.

### R2-06 — P2 — Reciprocal inference clobbers manual links and bypasses OCC/audit

**Evidence.**
- `apps/backend/src/contacts/use-cases/contactInferenceUseCases.ts:111-133` replaces an existing
  entry for the same contactId with `{...entry, ...relationshipEntry}` where `relationshipEntry`
  sets `inferred: true`, regardless of whether the existing link was user-authored.
- Nothing deletes an inferred link when the source link is removed (`inferred` is written only here).
- Targets are persisted with `repo.bulkSave` (`contactInferenceUseCases.ts:186-188`), which rewrites
  the whole record and all child collections with the target’s stale `updatedBy` and **no**
  `updated_at` predicate and no audit row (`contactRepositoryBulkSave.ts:42-77`).

**Impact.** A user’s manual “Guardian” link can silently become an inferred reciprocal; unlinking
leaves permanent phantom relatives; a concurrent edit to the target contact between read and bulk
save is reverted with no 409; attribution on the mutated target is wrong. This is the same class of
stale-child rewrite that C-03 fixed for bulk tag, on the inference path.

**Fix.** Skip targets whose existing link is non-inferred; delete inferred links whose
`inferredFromContactId` no longer has a matching source; write targets with a version predicate (or
a dedicated relationship-row upsert) and an audit row.

**Acceptance test.** DB integration: (a) manual B→A + save A→B keeps `inferred:false`; (b) removing
A→B removes B→A inferred; (c) a concurrent target edit yields 409 instead of a silent overwrite.

**Confidence.** Proven (flag overwrite, missing cleanup, missing predicate visible in code).

### R2-07 — P2 — Duplicate pairing is quadratic on shared names and caches every pair

**Evidence.**
- Exact name equality alone emits a pair: `packages/shared/src/contacts/contactDuplicateUtils.ts:141-144`.
- Every entry is compared against every entry sharing its name key: `contactDuplicateUtils.ts:196-243`.
- The full pair array is persisted to the object store: `apps/backend/src/contacts/use-cases/contactDuplicateScanUseCases.ts:137-143`.
- Any `contacts.read` user can trigger a scan (`apps/backend/src/routes/tenant/contacts/contactDuplicateRoutes.ts:64-77`); the client sends no idempotency key.

**Impact.** A bucket of *k* same-name contacts produces O(k²) evaluations and up to ~k²/2 pairs in a
single JSON cache document (k=1,000 → ~500k pairs). Duplicate scan CPU/heap and cache write grow
quadratically; `GET /duplicates` then re-serves the whole document. Large South-Asian directories
with many “Muhammad …” names hit this by design.

**Fix.** Require a second signal (phone/email/cnic) or a fuzzy-name threshold before emitting a
name-only pair; cap pairs per key and in total; paginate the cache; add a cooldown/idempotency key
for scans.

**Acceptance test.** 5,000 same-name contacts with no shared second signal → scan completes without
pair explosion and returns 0 pairs; a fixture with one shared phone still returns exactly one pair.

**Confidence.** Proven algorithm and persistence path; magnitude depends on tenant data.

### R2-08 — P2 — Sorts without an `id` tiebreaker make OFFSET pages unstable

**Evidence.** `apps/backend/src/db/repositories/contactRepositoryListFilter.ts:26-59` returns a single
column for `name`, `firstName`, `lastName`, `gender` and `city`; paging is `LIMIT/OFFSET`
(`listPageHelper.ts:59,88-93`). No branch appends `id`.

**Impact.** Rows with equal sort values have no defined relative order between statements. Page N+1
can repeat a row from page N or skip one — most visible when filtering by `gender` (every row is a
tie) and for duplicate names/shared cities. The same directory is the source for exports, so a
repeat/skip also changes what a sorted export contains.

**Fix.** Append `${contacts.id} asc` to every order branch; the existing `(workspace, …)` partial
indexes already support the tiebreaker.

**Acceptance test.** 60 contacts with identical names, page size 25 → pages 1–3 yield 60 distinct ids
and repeated requests return identical page contents.

**Confidence.** Proven.

### R2-09 — P2 — Desktop row selection is announced as raw English + internal id

**Evidence.**
- `apps/frontend/src/tenant/features/contacts/components/ContactsListDesktopTable.tsx:115-121` passes
  `selection` without `selectRowAriaLabel`/`selectAllAriaLabel`.
- `apps/frontend/src/components/common/work/WorkBatchTableRow.tsx:50` falls back to
  `` `Select row ${idStr}` ``; `WorkBatchTable.tsx:55` falls back to `t("common.selectAll")`.
- The localized keys already exist (`packages/shared/src/i18n/appTranslationsEn.ts:2898-2899`) and the
  mobile card path uses them (`ContactsListCards.tsx:104`).

**Impact.** On the primary desktop surface (and in every locale) each row checkbox is named
“Select row c-9f3…” — untranslated, id-based and uninformative — while the same page’s cards announce
the contact name. WCAG 2.5.3 (label in name) / 4.1.2 and the “no hardcoded copy” norm.

**Fix.** Pass `selectAllAriaLabel: t("contacts.table.selectAll")` and
`selectRowAriaLabel: (c) => t("contacts.table.selectContact", { name: getDisplayName(c) })`, mirroring
`StudentsListDesktopTable.tsx:126-128`.

**Acceptance test.** `ContactsListDesktopTable.test.tsx` asserts the localized row/select-all labels
under `ar`; `ContactCardHeader.test.tsx:49` is the template.

**Confidence.** Proven.

### R2-10 — P2 — VCF export fails for any tenant above 500 contacts

**Evidence.**
- `apps/backend/src/contacts/use-cases/contactExportUseCases.ts:192` — `const maxRecords = options?.maxRecords ?? 500;`, enforced at `:164-168` with `CsvExportLimitError`.
- The only production caller, the `export-vcf` job runner, passes no `maxRecords`:
  `apps/backend/src/services/backgroundJobRunnerService.ts:103-115`.
- No streaming VCF route is exposed; the error message points at a “streaming export” that does not exist.

**Impact.** `POST /api/contacts/export/vcf` fails for essentially every real tenant. The suite only
builds ≤4 contacts (`contactsVcfExportService.test.ts`), so CI cannot see it.

**Fix.** Stream the generator into the export artifact sink (like CSV) and keep the materialisation
cap only for any synchronous string builder; or raise the cap explicitly and document the ceiling.

**Acceptance test.** A 501-contact tenant → job `completed`, artifact has 501 `BEGIN:VCARD` groups,
`count === 501`.

**Confidence.** Proven.

### R2-11 — P2 — Command-centre metrics run per-row correlated subplans

**Evidence.**
- `apps/backend/src/db/repositories/contactRepositoryMetrics.ts:32-45` aggregates
  `count(*) FILTER (WHERE hasWhatsAppSql())` and `FILTER (WHERE incompleteSql)`; `hasWhatsAppSql`
  (`contactRepositorySql.ts:64-66`) delegates to `primaryPhoneDigitsSql()` (`:6-27`), a correlated
  `SELECT … ORDER BY is_primary, sort_order LIMIT 1` per contact.
- Live `EXPLAIN (ANALYZE)` on tenant `dq` (38 contacts) — reproduced in this review:
  `Aggregate → Bitmap Heap Scan (rows=38)`, then `SubPlan 1 → Limit (loops=38) → Sort (loops=38,
  Memory: 25kB) → Index Scan contact_phones_workspace_contact_idx`, and a second identical
  `SubPlan 2 (loops=38)`.

**Impact.** Cost is linear in tenant size with a large per-row constant (a sort allocation per
contact), on the hottest read of the module (every Work tab open and every metrics refetch). The
report-analytics query repeats the same pattern for its `missingInfoCount`.

**Fix.** Pre-aggregate the dialable digits once (`LEFT JOIN LATERAL (… LIMIT 1)`) or store a
maintained `primary_phone_digits` column, then filter on it; reuse the same derived set for
`hasPhone`/`missingInfo`.

**Acceptance test.** `EXPLAIN (ANALYZE)` of the metrics query contains no `SubPlan` and one scan +
one lateral/aggregate; metrics values unchanged on a fixture.

**Confidence.** Proven plan shape (reproduced); latency at production scale is a hypothesis.

### R2-12 — P2 — The soft-delete RLS policy is inert and the read path never sets the GUC

**Evidence.**
- `pg_policies` on the live DB: `contacts` has **two permissive** policies —
  `tenant_soft_delete_isolation` (`… AND (deleted_at IS NULL OR current_setting('app.include_deleted',true) = 'true')`)
  and the older `contacts_tenant_isolation` (`workspace_subdomain = current_setting('app.current_tenant',true)`).
  Permissive policies OR together, so the `deleted_at` clause of the soft-delete policy can never
  restrict anything.
- The stale policy was created by `0056_contacts_3nf_normalization.sql:337-339`; the soft-delete
  policy by `0108_soft_delete_schema_rls_and_triggers.sql:300-319`, which never drops the old one.
- No contacts repository or use case calls `enableIncludeDeleted` (repo-wide grep: students/calendar only), so the GUC is never set on the contacts trash/restore path.

**Impact.** Tenant isolation still holds (both policies include `workspace_subdomain`), but tombstones
are readable by any tenant-scoped query that does not filter `deleted_at` — the intended defence in
depth is absent. Worse, the feature works today only because of the stale permissive policy: the day
it is dropped or made restrictive, `GET /contacts?includeDeleted=true` and restore return zero rows
because the GUC is never set.

**Fix.** Drop `contacts_tenant_isolation`, make `tenant_soft_delete_isolation` restrictive, and set
`app.include_deleted` in the contacts list/restore/soft-delete paths (mirroring students).

**Acceptance test.** After the fix: soft-delete a contact, `GET /contacts?includeDeleted=true` returns
exactly it and `?includeDeleted=false` returns 0; restore succeeds; a raw `withTenantRead` select
without the GUC returns 0 deleted rows.

**Confidence.** Proven (DDL + `pg_policies` + grep).

---

## 5. P3 register

Advisory unless they compound with a P1/P2. Each row carries evidence, fix and acceptance test in
compressed form; confidence is **proven** unless marked *(hypothesis)*.

| ID | Finding | Evidence | Fix / acceptance |
| --- | --- | --- | --- |
| R2-13 | Field/tab governance is inert: the field-config PUT schema cannot persist `formTabs`, the sanitizer reads only `tabs` (so `enabledTabs` cannot hide a tab), and `validateContactDynamic` has no production call site | `packages/shared/src/schemas/moduleFieldConfig.dto.ts:4-11` (`.strict()`, no `formTabs`); `apps/backend/src/contacts/use-cases/contactConfigService.ts:12-15,46`; `contactResponseSanitizer.ts:70-79`; `contactEnabledTabs.ts:82-96`; `contactBlueprintValidation.ts:33-75` (tests only) | Derive tabs server-side from `enabledTabs` + seed, feed sanitizer/export/dynamic schema; acceptance: `{enabledTabs:["phones"]}` hides education in GET/export |
| R2-14 | The frontend never unwraps the setup response, so a stored tenant field config is ignored | Backend/contract send `{config}` (`contactsSetup.contract.ts:6-14`, `registerModuleSetupConfigRoutes.ts:78`); FE spreads `fieldConfigResponse?.body` (`ContactConfigContext.tsx:91,173,208`); provider falls back to seed (`useContactConfigProviderValue.ts:71-80`) | Spread `body.config`; provider test with a `{config}` body |
| R2-15 | `PUT /api/contacts/preferences` is a `.passthrough()` with only `relationshipPairs` validated; malformed `namePrefixesToIgnore` string persists and makes duplicate scan/check 500 (`buildNamePrefixRegex` `.map` throws) | `packages/shared/src/contacts/contactSetupConfigTypes.ts:23-27`; `contactDisplayUtils.ts:144-156`; `contactRepositoryDuplicateFind.ts:49,119`; only client validation in `useContactsPreferencesSave.ts:51-55` | Shared Zod for the whole `ContactPreferences`, parse in route; acceptance: string/51-prefix/threshold 0|101 → 400 |
| R2-16 | Sanitizer strips `tag` but not its mirror `tags`, and strips `name` only when `firstName` is hidden (a hidden `lastName` leaks through `name`) | `contactResponseSanitizer.ts:117-129`; mapper emits both mirrors (`contactRepositoryMappers.ts:63-67`) | Strip `tags` with `tag`; strip/recompute `name` when either part hidden; restricted-tag spec |
| R2-17 | Write DTOs have no DB-aligned length bounds; overlong tag/firstName/email values hit varchar limits and return 500 | `contacts.dto.ts:115-148` (no `.max`), `contactEntityTypes.ts:228-237`; live DDL: `contact_tags.name varchar(100)`, `contacts.first_name varchar(150)`, `contact_emails.address varchar(255)`; probe in a rolled-back temp table: insertion of 101 chars → `22001 value too long` | Bound strings in the shared DTO; acceptance: 101-char tag → 400 not 500 |
| R2-18 | `bulk-tag` has no `ids` cap (bulk delete/restore cap at 500) and loads fully hydrated contacts (12 child collections) only to merge tags | `contactEntityTypes.ts:228-237` vs `api.dto.ts:19-24`; `contactBulkWriteUseCases.ts:122` → `findContactsByIds` → `hydrateContactsList` | Cap ids at 500 and load a tags-only projection; 25k-id request must 400 |
| R2-19 | `POST /api/contacts/google-sync/audit` lets the client choose which audit event is written (`credentials_saved`/`disconnected`); no frontend caller exists | `googleSyncRoutes.ts:133-146`; enum `contactsOperations.dto.ts:25-34`; frontend grep: no caller | Delete the endpoint or derive the audit from the actual config change |
| R2-20 | Google Contacts sync runs synchronously inside the request and paginates the whole People directory with no page/record cap | `googleSyncRoutes.ts:110-121`; `contactGooglePeopleApi.ts:40-51` (`pageSize=1000`, `do…while(pageToken)`); `contactGoogleSyncRun.ts` one long transaction | Move to a BullMQ job with progress + cap; persist `syncToken`; 10k mock → 202 + job |
| R2-21 | “Keep mine”/“Retry all” re-queue the same stale `updatedAt`, so the next flush 409s and re-records the conflict forever; the merge UI also only diffs 7 fields and force-keeps the local name | `useContactsSyncConflictRow.ts:82-91`; `contactsSyncOutboxConflicts.ts:24-35`; `contactsSyncOutboxFlush.ts:81-90`; `useContactMutations.ts:88-91`; `contactSyncDiff.ts:11-19,136-146` | Keep-mine via upsert (no version header) or refreshed token; merge over the full permitted field set, honour the name pick |
| R2-22 | Title casing mangles hyphenated/apostrophe/inner-capital Latin names on every save and merge (`Al-Siddiq→Al-siddiq`, `O'Brien→O'brien`, `McDonald→Mcdonald`) | `packages/shared/src/core/titleCaseStringUtils.ts:34-43`; applied in `useContactFormSave.ts:117`, `useDuplicateDetectionState.ts:161,184`, `contactValidationUseCases.ts:121` | Segment-aware casing (`[\s'-]`, preserve all-caps/Mc/O’) + tests; Arabic/Urdu round-trip unchanged |
| R2-23 | A 409 stale-write conflict has no recovery UX and surfaces the server’s English sentence over a translated toast | `useContactFormSave.ts:130-151`; server message `contactWriteUseCases.ts:174-176`; mapping `contactCrudRoutes.ts:207-213` | Branch on 409/`type:"conflict"`, keep the form dirty, offer reload/overwrite with localized copy |
| R2-24 | Invalidation gaps: field-config is absent from the shared invalidator (and from its own mutation’s success), and a preferences save does not invalidate the duplicates query | `invalidateContactsQueries.ts:19-35`; `useContactsQueries.ts:174-187`; `createModuleSetupConfigHooks.ts:69-78` | Add field-config + duplicates keys; invalidation test asserting `isInvalidated` |
| R2-25 | “Merge all high-confidence” performs N sequential merges, each firing the full ~10-key invalidation wave; a mid-run failure leaves a partial merge with one generic toast | `useDuplicateDetectionState.ts:151-174`; `invalidateContactsQueries.ts:28-35`; `useContactMutations.ts:54-56` | Single batch mutation or one `onSettled` invalidate after the loop; assert 10 merges ⇒ 1 invalidation/key |
| R2-26 | The bulk-tag modal’s busy state is a dead prop (`isTagPending` never supplied), so the primary action stays enabled and double-submit enqueues two mutations | `ContactsBulkActionBar.tsx:32,54,110`; `contactsWorkTierPropsBuilder.ts:118`; `ContactsBulkTagModal.tsx:30-40,52-53` | Thread `bulkTagContactsMutation.isPending`; test `saveDisabled`/`aria-busy` |
| R2-27 | Dead/duplicated frontend surfaces: `ContactTableRow.tsx` is imported for its type only (the live row is `WorkBatchTableRow`), six contract hooks have zero consumers, and the contract advertises `/column-preferences` and `/field-usage` handlers that are not registered (404) | `ContactTableRow.tsx` + type-only imports (`ContactsListDesktopTable.tsx:7`, `ContactsListCards.tsx:8`, …); `useContactsQueries.ts:94-151`; `contactsSetup.contract.ts:50-62,91-104`; no backend registration | Delete or make single-source; implement or remove contract routes; orphan-export/route test |
| R2-28 | Column-preference mutation writes a bare array into a slot that the query fills with the ts-rest envelope, and two fetchers drop the abort signal | `useContactPrefsQueries.ts:29-55`; `contactsListQueryBuilders.ts:51-56` (`_signal` unused); `useContactsAnalyticsQueries.ts:94` (`queryFn` takes no context) | Normalize with `select` or write the envelope; forward `signal`; shape/abort tests |
| R2-29 | Selection survives filter/sort/trash changes with no “N selected outside this view” affordance, so bulk delete/tag can act on invisible rows | `useContactsDirectoryFilters.ts:33-40,86-99`; `ContactsWorkTier.tsx:104-122` | Clear selection on filter-key change or show an out-of-view hint + clear CTA |
| R2-30 | The duplicate modal renders every loaded pair unvirtualized and “Load more” accumulates without pruning, so hundreds of heavyweight cards mount in one dialog | `DuplicateDetectionModal.tsx:152-164`; `useDuplicateDetectionState.ts:79-87` (page size 50) | Virtualize/window to the current page and prune to server ids; 200-pair bounded-mount test |
| R2-31 | On-demand duplicate-cache fill lacks the post-save version re-check the scan path has, and both read the version token through the read replica | `contactDuplicateScanUseCases.ts:166-190` (no re-read after save); scan path `:137-150`; `contactRepositoryPersist.ts:54-62` (`withTenantRead`) | Re-read after `saveObject` and delete on mismatch; read the token on the primary |
| R2-32 | The messaging “contacts” bucket (`unlinked`) excludes students and faculty but not staff, so staff-linked contacts appear in two buckets | `contactRepositoryListFilter.ts:123-126`; `messagingRecipientUseCases.ts:108-112`; `existsActiveStaffLinkSql` exists at `:34-42` | Add `NOT existsActiveStaffLinkSql`; one-bucket-per-contact DB test |
| R2-33 | `syncRelationshipMirrorsFromPairs(undefined)` derives `[]` and rewrites lookups + field options to empty; a spec pins the destructive branch | `contactRelationshipMirrorService.ts:56-78`; `contactRelationshipMirrorService.test.ts:109-140` | Treat undefined/empty as “no change”; assert no writes |
| R2-34 | Messaging recipient handlers swallow failures with `catch {}` and never log, and the messaging contract’s `matchRecipients` query is an empty passthrough while the handler validates a real schema | `messagingRecipientContractHandlers.ts:44-49,88-93,132-137`; `messaging.contract.ts:136-142`; `messaging.dto.ts:172-183` | Log with request id; move DTOs into the contract and drop the duplicate parse |
| R2-35 | Duplicated SQL/type maps drift: `CONTACT_LIST_COLUMNS` vs `contactSelectColumns`, two hand-written `contact_relationships` JSON aggregations, and four different tab→property maps (one missing `bankDetails`) | `contactRepositoryList.ts:44-73`; `contactRepositoryColumns.ts:3-30`; `contactHydrateEngagementSql.ts:13-28` vs `contactRepositoryHydrateSummaryChildren.ts:95-110`; `contactResponseSanitizer.ts:14-27`, `contactDynamicValidation.ts:20-28`, `contactUniqueFieldValues.ts:25-30`, `contacts.dto.ts:24-34` | One projection/map/aggregation module + exact-key parity tests |
| R2-36 | Every relationship-bearing save loads preferences (and may rewrite lookups/field config) inside the write transaction although stored relationship pairs are ignored | `contactWriteUseCases.ts:112,208`; `contactInferenceUseCases.ts:155`; `contactPreferencesService.ts:41-60`; `contactRelationshipPairUtils.ts:31-35` | Pass `resolveRelationshipPairs()` directly or use a read-only prefs reader |
| R2-37 | Google OAuth state/PKCE are not bound server-side: exchange accepts any code and an optional verifier, and the nonce/verifier live only in `sessionStorage` | `contactGoogleSyncOAuth.ts:79-104`; `contactsOperations.dto.ts:40-50`; `googleContactsOAuth.ts:41-55,149-160` | Persist state + challenge per user, require/verify the verifier, single-use state; mismatch → 400 |
| R2-38 | Information disclosure and unconfigurable attribution: raw Google API error text is returned to the client, the 400 path can echo internal `error.message`, and creator/updater user ids ride on `basic.firstName` visibility and are in default export columns | `contactGooglePeopleApi.ts:32-35` + `googleSyncRoutes.ts:122-127`; `contactRouteErrors.ts:106-123`; `contactExportColumns.ts:134-137`, `contactColumnFieldMapping.ts:111-114` | Fixed per-code messages (log detail); allowlist domain errors; treat audit metadata as restricted |
| R2-39 | CSV robustness: duplicate headers silently last-win, quotes anywhere toggle quote mode, unterminated quotes eat the rest of the file, `;`-joined multi-value columns corrupt on re-import, import/export jobs have no client idempotency key or file/row cap, and exported CSV has no UTF-8 BOM (Excel garbles Urdu/Arabic) | `contactsCsvParser.ts:61-66`; `csvParserCore.ts:28-32,57-70`; `contactExportExtractors.ts:10-14` vs `contactsCsvRowParserTypes.ts:10-13`; `startServerContactsImport.ts:17,25`; `csvUtils.ts:29-45` (no `\uFEFF`) | Reject duplicate/unterminated/mid-field quotes, escape lists, add idempotency keys + caps + BOM; round-trip tests per case |
| R2-40 | `contacts.updated_at`/`deleted_at` are naive `timestamp` in live DDL while Drizzle declares `timestamptz`; the OCC predicate already carries a dual-branch workaround | `contactCoreTables.ts:39`, `softDeleteSchema.ts:12`; live `information_schema` probe: both `timestamp without time zone`; `contactRepositoryPersist.ts:120-135` | Forward migration to `timestamptz USING … AT TIME ZONE 'UTC'`, then collapse the dual predicate |
| R2-41 | The write-hot `contacts` table carries 22 indexes, two of which are redundant with existing partials | live `pg_indexes`/`pg_class`; `contacts_workspace_active_idx` is a prefix of `contacts_workspace_id_active_idx`, and `contacts_workspace_deleted_idx` is covered by the active/deleted-records partials (`0104…sql:67`) | Drop the two in one forward migration; plans still use the remaining partials |
| R2-42 | Read-path over-fetch: the unique-field pre-check hydrates all 12 child collections although it needs phones/emails/scalars, `city` sort is a correlated subquery in `ORDER BY` (unindexable), and the summary loader still hydrates addresses/socials/relationships for recipients that discard them | `contactRepositoryLookup.ts:147`; `contactRepositoryListFilter.ts:49-57`; `contactRepositoryHydrate.ts:51-77` | Add phones/emails-only and summary projections; denormalize primary city; assert child queries in tests |
| R2-43 | Aggregate endpoints bypass field-level visibility: widget aggregates accept `gender`/`isSyed` with no viewer role, and `gt`/`lt` on a text column casts to `numeric` (500 instead of 400) | `contactRepositoryWidgets.ts:17-24,75-80`; `crudQueryRoutes.ts:163-170`; `contactAnalyticsUseCases.ts:93-100` | Thread viewer role + field config, reject restricted dimensions and non-numeric operators |
| R2-44 | `POST /api/contacts` is an upsert: a client-supplied existing `id` overwrites the row with no OCC predicate and audits as `contact.upsert` | `contactsCrud.contract.ts:49`; `contactCrudRoutes.ts:131-135`; `contactWriteUseCases.ts:56-57,78-111` | Intent is offline replay, but document it and either reject existing ids or run the create branch through the version predicate |
| R2-45 | Workspace backup streams only active contacts before a destructive restore, so trash and its provenance are lost on wipe-restore *(hypothesis on intent)* | `contactRepositoryHydrate.ts:88` (`deleted ?? includeDeleted ? "all" : "active"`); `contactRepositoryBulkSave.ts:173-200` (delete-then-insert) | Snapshot with `deleted:"all"` and document the contract; trash survives a backup/restore round-trip |
| R2-46 | Two smaller hygiene items: `contactsReportAnalyticsQuerySchema` is defined twice (one unused) and `summarizeContactFieldChanges` is test-only dead code | `contacts.contract.schemas.ts:4-18` vs `contactsReports.contract.ts:6-20`; `contactResponseSanitizer.ts:186` | Delete the unused definitions |

---

## 6. Prior-finding re-verification at HEAD

| Prior ID | Status | Evidence |
| --- | --- | --- |
| C-01 OCC lost update | **Holds** | `saveContactIfVersionMatches` puts the `updated_at` predicate in the UPDATE (`contactRepositoryPersist.ts:106-142`), 409 mapping (`contactCrudRoutes.ts:204-214`), real two-connection test `contactsConcurrencyDb.integration.test.ts:63-89` (4/4 passed); invalid token → 400 before any query |
| C-02 Audit snapshots not subject-encrypted | **Holds** | `createCollectionAuditHelper("contacts", { subjectScoped: true })` (`contactRouteHelpers.ts:120`) → `subjectId` → `encryptSubjectAuditState` (`auditTrailService.ts:151-165`); delete/restore both pass `subjectId` |
| C-03 Bulk tag rewrote stale children | **Holds** | `replaceContactTags` touches `contact_tags` + parent `updated_at`/`updated_by` only (`contactRepositoryTags.ts`), no child rewrite |
| C-04 Basic-tab field permissions | **Partial** | Scalar strip works and its spec is green (`contactResponseSanitizer.ts:117-119`; test `:132-173`). But tab-level stripping reads `formTabs`, which the write path strips (R2-13), and the `tags`/`name` mirrors leak (R2-16) |
| C-05 VCF bypassed the sanitizer | **Holds** | `generateContactsVcfStreamChunks` sanitizes each page before `toVCard` (`contactExportUseCases.ts:148-171`); the role is server-derived (`contactAuditExportRoutes.ts:89`); restricted-field spec passes |
| C-06 List used the base query schema | **Holds** | Contract now uses `contactsListQuerySchema` (`contactsCrud.contract.ts:38`); repeated `gender` → 400, pinned by `contacts.integration.test.ts:348-358` |
| C-07 Restore audited a no-op | **Holds** | `restoreContactById` returns `null` for an active row (`contactRestoreUseCases.ts:41-44`) → route 404 and no audit; spec `contactUseCases.test.ts:503` |
| C-08 Bulk restore counted duplicates | **Holds** | `dedupeTrimmedIds` before counting (`contactRestoreUseCases.ts:124`); spec `contactUseCases.test.ts:760` |
| C-09 Client-authored export/setup audit | **Partial** | `registerExportAudit:false` and `/export-audit` + `/setup-audit` return 404 (`contactAuditExportRoutes.ts:36-39`; `contacts.integration.test.ts:847-862`). The setup audit is now server-authored constants but is still **not diff-based** (`contactSetupConfigRoutes.ts:55-58`; `createCollectionAuditHelper.ts:38-44` stores `{summary, action}` only) |
| C-10 Sanitizer failed open on missing config | **Holds (caveat)** | Always resolves a seed snapshot (`contactRouteHelpers.ts:103-117`; `contactsExportUtils.ts:26-34`), so sanitization never turns off. Caveat: the seed grants visibility, so a lost config row *weakens* configured restrictions rather than failing closed; the claimed “missing-config spec” does not exist |
| C-11 Google OAuth lacked PKCE/state | **Partial** | PKCE S256 is implemented and the redirect URI is host+path allow-listed (`contactGoogleSyncOAuth.ts:21-36,101-103`); the nonce is `sessionStorage`-bound (`googleContactsOAuth.ts:41-55`). There is **no server-side state binding** — the exchange accepts any code and an optional verifier (R2-37) |
| A-01 Messaging exposed full contacts | **Holds** | `loadMessagingRecipients` returns lean recipients after the viewer sanitizer (`messagingRecipientUseCases.ts:57-130`); the contract/manifest return the lean page; handler passes the session role |
| A-02 Recipient field permissions bypassed | **Holds** | `mapRecipients` sanitizes before `toMessagingRecipient` (`:31-44`), with a seed fallback snapshot |
| A-03 Recipient listing over-fetched | **Holds** | `recipientProjection` selects the phones/emails-only hydrator before the full branch (`contactRepositoryList.ts:110-114`); DB test proves addresses/socials/relationships are skipped |
| A-04 Resolve full-hydrated | **Holds** | Resolve uses `loadContactsSummaryByIdsForTenant` → `findSummaryByIds` (`messagingRecipientUseCases.ts:147`; `contactLoadUseCases.ts:62-70`) |
| B-01 Root-level uploads readable | **Holds** | `isCrossTenantRootUpload` denies non-public root paths to tenant sessions (`staticAssets.ts:146-188`) |
| B-02 Uploads were session-only | **Holds** | Attachment upload/delete require `canUploadAttachments` = `contacts.write` (`routes/common/uploads.ts:28-38,121,150`) |
| B-03 Orphaned attachment files | **Holds (residual)** | Explicit removal saves first, then unlinks; endpoint refuses referenced URLs; nightly leader-leased sweep at 02:00 UTC with a 24 h age floor and `MMS_ORPHAN_ATTACHMENT_SWEEP=off` (`attachmentSweepService.ts`, `retentionPurgeScheduler.ts:94-124`). Narrow residual: a save committing after the reference snapshot could still be swept |
| B-04 Client-controlled attachment links | **Holds (residual)** | Path-only tenant validation with decoded-segment traversal rejection and legacy grandfathering (`contactAttachmentUrls.ts:24-65`), enforced on create/update/merge. Residual: `bulkSaveContacts` (Google sync) does not assert, so a future caller could bypass |
| Addendum C-01 Duplicate cache staleness | **Holds (residual)** | Preferences save invalidates the cache (`contactSetupConfigRoutes.ts:26-37`) and a 24 h TTL is enforced on read (`contactDuplicateScanUseCases.ts:22-27,97-107`); tests pin both. Residuals: an in-flight scan can rewrite a stale cache after the delete (version token covers contacts writes only), and the FE duplicates query is not invalidated on prefs save (30 s staleTime) |
| Addendum C-02 On-demand recompute / scan-write race | **Partial** | The scan path guards both windows (pre-save version compare + post-save re-read/delete). The **on-demand page path** persists results with no post-save re-check (`contactDuplicateScanUseCases.ts:166-190`), and both read the token through the replica (`contactRepositoryPersist.ts:54-62`) — see R2-31 |

**Documentation note.** The addendum’s §7 says its fixes were “working tree, uncommitted”; they are
committed in `e7fd7134b` (#264). The addendum text is a point-in-time record and was left unchanged.

---

## 7. Remediation order

1. **R2-01 (P1)** — sorted-export truncation. Fix the pager/cursor contract or force id ordering
   whenever the export factory falls back to a row id; assert in the shared helper so students/finance
   inherit the fix.
2. **R2-02 (P2)** — CSV import body key + chunking, with an exporter→importer round-trip test.
3. **R2-10 (P2)** — VCF streaming; a one-line cap raise is a stop-gap only.
4. **R2-03 (P2)** — picker access seam (lean endpoint or role grants) with a teacher-role test.
5. **R2-04/R2-05 (P2)** — relationship gender/email persistence + guardian mapping, in that order.
6. **R2-06, R2-07, R2-08, R2-11, R2-12 (P2)** — inference correctness, duplicate scan bounds,
   tiebreaker ordering, metrics lateral join, RLS cleanup + GUC.
7. **R2-09 (P2)** — a11y labels (small, independent).
8. **P3 batch** — governance cluster (R2-13…R2-15), conflict UX (R2-21/R2-23), then hygiene.

No P0 was found; nothing here justifies bypassing normal review or an emergency release.

---

## 8. Residual risk and what this review could not prove

- **Export P1 is code-path proven, not runtime-reproduced.** The largest local tenant has 38
  contacts; seeding 300 to observe the truncation would have written to the database, which is outside
  this review’s read-only contract. The mechanism is fully determined by the executed pager/stream
  code.
- **No local RLS enforcement.** The dev connection role bypasses row-level security, so RLS policies
  were inspected in `pg_policies`/DDL rather than exercised. Tenant isolation itself is additionally
  enforced by every repository predicate and was spot-checked.
- **Browser coverage is partial.** Contacts axe passed at 1440 (with drawer) and 375. The import/export
  e2e failed because the local dev entry point (`pnpm dev` → turbo backend+frontend) starts **no
  BullMQ worker**: the enqueued import job remained `status = pending` in `background_jobs` and the
  dialog never reached a terminal state. That is an environment/test-infrastructure gap, not a
  contacts regression — but it means the browser-level import/export path is unverified.
  The responsive contacts spec failed in the login helper before rendering contacts, so viewport
  behaviour is also unverified this round.
- **No coverage measurement.** Passing suites do not prove the negative paths above; specific gaps
  are named in §9 of the lane notes (in particular: no invalidation-contract test, no duplicate
  merge/batch e2e, no real-DB `moduleLinkFilter` test, no guardian derivation against persisted
  hydration, and three “SSOT” specs that only grep source text).
- **Latent configuration defects.** R2-13…R2-16 depend on a stored `contact_field_configs` row
  (currently zero rows in the local DB) or on field `permissions` written through the API; they are
  latent today but become live the moment the Fields editor ships or a tenant is migrated.
- **Performance findings are plan-shape, not latency.** R2-07/R2-11/R2-42 were proven with
  `EXPLAIN` and code paths on small tenants; production-scale timings were not measured.
- **Hypotheses not counted as findings.** R2-45 (backup omits trash) is a behaviour observation whose
  intent is undocumented; the correlated `city` sort (inside R2-42) was not exercised at scale.

---

## 9. Checked and found sound

1. **Route-level authorization and module gates.** Every contacts route is registered under
   `authenticateTenant` + `registerModuleAccess("contacts")` (`routes/tenant/contacts.ts:24-30`); the
   coverage test is green and all handlers carry explicit `canRead/Write/Delete` checks. Self-service
   profile edits cannot be used as a write bypass (owner → field whitelist + profile DTO).
2. **Tenant isolation.** Every contacts list/find/lookup/aggregate pins `workspace_subdomain` inside
   `withTenant`/`withTenantRead`; child JSON subqueries repeat the tenant predicate; merge
   re-parenting is tenant-scoped; all 17 `contact%` tables are `ENABLE` + `FORCE` RLS.
3. **Optimistic concurrency is real.** The version predicate is in the UPDATE, the two-connection DB
   test passes, an invalid token is a 400, and a stale token maps to a clean 409.
4. **Audit integrity.** Server-owned fields are stripped from every write, actor/subject are stamped
   from the session, person records use subject-key encryption, and delete/restore/bulk outbox rows
   are batched with per-row audit.
5. **Field-level sanitization seam.** Every contact read surface sanitizes (list, get, create/update
   responses, resolve, merge, restore, duplicates); absent config falls back to the seed rather than
   skipping sanitization; the strip map is exhaustive per tab and traverses rows.
6. **Attachment safety.** Path-only tenant URL validation with traversal rejection and grandfathering
   only for unchanged legacy URLs; upload returns a relative tenant path; upload/delete require
   `contacts.write`; serving is session-gated, tenant-matched, `no-store`, and download-dispositioned.
7. **Messaging exposure fix.** Lean recipient DTOs after viewer sanitization, a phones/emails-only
   projection, summary hydration for resolve, a real DB projection test, and a lean response contract.
8. **Export hygiene (other than R2-01/R2-39).** CSV formula injection is neutralised in one serializer;
   VCF structural injection is blocked; export column authorization is fail-closed; CSV/VCF rows are
   sanitized for the viewer; import jobs are tenant-bound from the queue row and `viewerRole` comes
   from the session, not the payload.
9. **Google credential handling.** OAuth client secret/refresh tokens are encrypted at rest and
   redacted on every response; scope is `contacts.readonly`; the redirect URI is origin+path
   allow-listed; refresh-token rotation is persisted.
10. **Persistence shape.** Child hydration is one aggregate query per collection (no N+1), chunked at
    250 ids; there are zero wildcard projections and zero `sql.raw` in the contacts repositories;
    list limits are clamped; soft-delete writes are single batched UPDATEs.
11. **Frontend structure.** No raw `fetch`; one invalidation entry point shared by mutations and
    realtime; no optimistic bulk writes; focus trap/return centralized and topmost-only Escape;
    `aria-busy` on list pending; 44 px targets on contacts controls; zero physical-direction
    utilities in 302 files; typed i18n keys; PII-safe offline outbox cleared on logout.
12. **Config and i18n parity.** 9,476 keys in en/ar/ur/fa with zero drift; all contacts setup/column
    labels present; setup JSONB reads/writes are RLS-scoped and cache-invalidated; Contacts’ setup
    audit is server-authored and the legacy client audit endpoints are unregistered.

---

## 10. Remediation status (working tree, uncommitted)

Every P1/P2 in this review has been fixed in the working tree. Nothing is committed, staged, or
pushed; the findings above remain the point-in-time record. The P3 register (§5) is untouched and
remains the follow-up backlog.

| ID | Status | Fix | Pinning evidence |
| --- | --- | --- | --- |
| R2-01 | Fixed | Export pager no longer falls back to the last row id: `generateCsvStreamChunks`/`loadAllExportRows` continue OFFSET paging when no cursor is returned and throw on `hasMore` with zero rows. Contact sorts gained an `id` tiebreaker so pages are deterministic. | `csvExportStreamFactory.test.ts` (+3), `createModuleExportService.test.ts` (+2), `contactRepositoryListFilter.test.ts` (new), `contactsExportDb.integration.test.ts` (300 contacts, name-sorted, 300 unique rows) |
| R2-02 | Fixed | `useModuleCsvImportActions` accepts a `submitRows` override; the contacts CSV dialog chunks parsed rows and posts `{contacts}` through `startServerContactsImport` (aggregating progress and tolerating per-batch failures). | `useModuleCsvImportActions.test.tsx`, `ContactsCsvImportDialog.test.tsx` (2 rows → one `{contacts}` call; 501 rows → two calls; failure surfaced) |
| R2-03 | Fixed | New lean `GET /api/contacts/picker` + `GET /api/contacts/picker/:id`, module action `availability` with an in-handler `canUseContactPicker` gate (contacts.read OR students/faculty/workshops read), sanitized 4-field projection. The shared picker now uses these hooks instead of the directory endpoints. | `contactPicker.test.ts`, `contactPickerRoutes.test.ts`, `contactPickerAccess.test.ts`, `useContactPickerState.test.tsx`, existing `contactLink` suites |
| R2-04 | Fixed | Migration `0200` adds `contact_relationships.email/gender`; persist/read mappers and both relationship JSON aggregates carry them; CSV import/export now round-trips both fields. | `contactsRelationshipDb.integration.test.ts` (persist + reload); existing CSV parser tests |
| R2-05 | Fixed | Guardian derivation uses the shared normalized `genderIsMale/Female` helpers against persisted relationship gender, with insertion order only as a last resort. | `contactsRelationshipDb.integration.test.ts` (mother linked second still maps to mother); `studentGuardianFromContacts.test.ts` |
| R2-06 | Fixed | Reciprocal inference never relabels a user-authored link, removes stale inferred rows using the pre-write source links, and writes targets through `saveIfVersionMatches` with actor stamping and one inference audit row; skipped concurrent edits are logged. | `contactInferenceUseCases.test.ts` (+3), `contactService.test.ts` (manual link preserved), `contactsRelationshipDb.integration.test.ts` (DB round-trip) |
| R2-07 | Fixed | Duplicate pairing skips name buckets above 100 participants and stops at 5,000 pairs; the scan logs truncation; the client sends an idempotency key per explicit scan. | `contactDuplicateUtils.test.ts` (+4), `contactDuplicateScanService.test.ts` (+1), `startServerContactsBackgroundJobs.test.ts` (new) |
| R2-08 | Fixed | `buildOrderBy` appends `${contacts.id} asc` to every non-id sort branch. | `contactRepositoryListFilter.test.ts` (all branches, asc/desc) |
| R2-09 | Fixed | Desktop rows pass localized `selectRowAriaLabel`/`selectAllAriaLabel` into `WorkBatchTable`. | `ContactsListDesktopTable.test.tsx` (Arabic labels, no raw id) |
| R2-10 | Fixed | `contacts:export-vcf` now streams `generateContactsVcfStreamChunks` through `uploadStreamToStorage` and stores a keyed artifact, removing the 500-record materialisation cap. | `contactsVcfExportService.test.ts` (501-contact generator + runner + abort) |
| R2-11 | Fixed | Metrics/report aggregates run one raw-SQL query over a single `LEFT JOIN LATERAL` for primary-phone digits; migration `0200` adds `contact_phones_workspace_contact_priority_idx` and the lateral orders on `is_primary DESC` so it is index-served without a per-row Sort. | `contactRepositoryMetrics.test.ts` (11), `contactsMetricsDb.integration.test.ts` (values + `EXPLAIN (FORMAT JSON)` without `SubPlan`) |
| R2-12 | Fixed | Migration `0200` splits contacts RLS into a permissive tenant policy plus a **restrictive** soft-delete policy. Trash/restore/detail/selection-export paths now set `app.include_deleted` (repo `includeDeleted` option, list GUC, export filtering). | `contactsRelationshipDb.integration.test.ts` (trash detail/list/restore + `pg_policies` shape); the CI `test:rls` suite runs the same paths under `mms_app` |

**Verification (working tree)**
- `pnpm typecheck` — pass (6/6 tasks).
- `mms-backend` contacts suites — **34 files / 319 tests pass**.
- `mms-backend test:db contact` — **4 files / 13 tests pass** (concurrency, export paging, relationship/RLS, metrics).
- `@mms/shared` contacts suites — **44 files / 347 tests pass**.
- `mms-frontend` contacts + `src/lib/contacts` + `contactLink` — **144 files / 449 tests pass** (includes new picker hook tests).
- Migration ratchets: `check:migration-indexes`, `check:migration-hygiene`, `check:migrations-forward-only` pass for the new `0200` migration (hand-written SQL + `meta/0200_snapshot.json`, `SET LOCAL lock_timeout = '2s'`).
- Drizzle generation note: `drizzle-kit generate` is blocked by the pre-existing malformed `meta/0000_snapshot.json` (documented snapshot-chain debt in `docs/open-items.md`), so `0200` was authored forward-only and its snapshot derived from `0199` with the schema deltas.
- Browser evidence: `contacts-import-export.spec.ts` **passes** with the BullMQ worker running (import 2 contacts → CSV export job completed), and the contacts a11y specs **pass at 1440 with the drawer and at 375** (2/2).
- `pre-pr-review.sh` — **21/21 gates pass** (TDD pairing advisory only: domain files changed alongside updated existing specs).
- No commit, push, or staging was performed; HEAD remains `e7fd7134b` and `git diff --cached` is empty.

**Deferred:** all §5 P3s, including tab/field-config governance (R2-13/14/15), preferences schema,
sanitizer mirror keys, CSV parser hardening, naîve timestamp conversion, redundant indexes, and
server-side OAuth state binding.

