# MMS Contacts Module Review — 2026-11-03 (round 4)

Independent review of the contacts domain at `HEAD = 7309bc97c`, plus the forward-only fix set
landed in the same change. Round 1 (`C-01…C-11`), the addendum, round 2 (`R2-01…R2-46`) and
round 3 (`N-01…N-11`) audited the domain before this pass; round 3's fixes were re-verified and
hold.

**Why a fourth pass.** Rounds 1–3 were migration/role-tag and read-path heavy. This pass audited
the write path end-to-end, the shared contract layer, module authorization for attachment files,
and the frontend Work/Form/Sync tiers — the surfaces that had never been reviewed together.

**Scope.** `apps/backend/src/routes/tenant/contacts/**`, `apps/backend/src/contacts/**`,
`apps/backend/src/db/repositories/contact*`, `apps/backend/src/db/schema/contact*`,
`apps/backend/src/plugins/staticAssets.ts`, `packages/shared/src/{contacts,contracts,schemas}`,
`apps/frontend/src/tenant/features/contacts/**`, `apps/frontend/src/lib/contacts/**`,
`apps/frontend/src/components/contact{Link,-action}/**`, migrations `0160`, `0200–0203`, and the
contacts unit/DB/e2e specs.

**Method.** Seven parallel read-only subsystem audits (write path; read/export/import/jobs;
routes/auth/uploads; shared contracts; Work tier; forms/drawer/setup; sync/import/duplicates).
Every P1 below was then re-verified against the tree by hand, and the fixes were pinned with
tests — including the first **real-Postgres merge suite**, which the previous rounds lacked.
No browser or axe run was performed in this pass.

---

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| Tree / HEAD | clean at review start; `7309bc97c` |
| `pnpm typecheck` (5 packages) | **pass** |
| `mms-backend` unit suite | **360 files / 2,500 tests pass** |
| `@mms/shared` suite | **238 files / 1,793 tests pass** |
| `mms-frontend` contacts scope (`features/contacts`, `lib/contacts`) | **140 files / 445 tests pass** |
| Contacts real-Postgres suites (`test:db`) | **6 files / 32 tests pass**, including the new `contactsMergeDb` (8) |
| `pre-pr-review.sh` (secrets, rules integrity, i18n, shared purity/structure, faculty legacy, migration index/hygiene/forward-only, work-directory, frontend structure, shared-ui, docs, script tests, ratchet baselines, DB projections, backend boundaries, code norms, typecheck, ESLint) | **21/21 gates pass** (TDD pairing advisory lists the changed domain files; their specs live in `__tests__` / `db-integration`) |
| Round-3 remediations (`N-01…N-04`, `N-11`) | re-verified — hold |
| Browser / axe | **not exercised** this round (unit + DB evidence only) |

---

## 2. Verdict

The structural gates are green and round 3's tag work holds, but the module could not have passed
a write-path review:

1. **Duplicate merge could never succeed.** The re-parent SQL still updated `faculty.contact_id`,
   a column migration `0160` dropped. Every merge raised `42703` and the route answered 500.
2. **A systemic "absent means empty" defect** turned a hidden tab, a partial merge body, or a CSV
   missing a column into deletion of the stored child rows (`phones`, `emails`, `addresses`,
   `bankDetails`, …). It reached the ordinary edit form and the documented export→edit→re-import
   round trip.
3. **Optimistic concurrency was advisory**: merge and `POST /api/contacts` (an upsert by client
   `id`) bypassed the 409 contract that `PUT` enforces.
4. **Contact attachments were only tenant-gated**: any authenticated session could download a
   contact document by URL without the contacts module's read permission.

Four further P1s are client-side data-safety defects (invisible-row selection, a fabricated drawer
contact, a self-conflicting offline replay loop) and are fixed here as well.

**No P0 was found** (no cross-tenant leak, no auth bypass). The four categories above are repaired
in this change; §5 carries the P2 backlog that did not fit the release-blocking window.

---

## 3. Findings summary

### 3.1 P1 — fixed in this change

| ID | Area | Finding | Pinning evidence |
| --- | --- | --- | --- |
| R4‑01 | Merge / DDL drift | `reparentContactReferences` ran `UPDATE faculty SET contact_id` after migration `0160` dropped the column → merge always 500. Re-parent set also omitted `faculty_employments`, `workshop_participants` and `finance_invoices.family_contact_id`. | `contactsMergeDb.integration.test.ts` (merge, employment conflict, repair) + `contactRepositoryDuplicates.test.ts` (no `faculty`, new tables present) |
| R4‑02 | Merge / data loss | Merge replaced the survivor wholesale (`{...mergedInput}`) and `normalizeContactPhones` forced `phones: []`; a partial or sanitized `merged` body deleted the survivor's child collections. | `contactsMergeDb` "treats the merge body as a patch"; "keeps the stored phones" |
| R4‑03 | Edit / data loss | The read sanitizer deletes a hidden tab's collection, the edit draft re-seeds it as `[]`, and the server merged any defined value → a role that cannot read a tab wiped it on save. | `contactUseCases.test.ts` viewer write guard (2 cases) + `contactWriteGuards.test.ts` |
| R4‑04 | Import / data loss | The CSV parser always emitted every child array (`[]` for absent columns) → re-importing an export with a removed column deleted that collection. | `contactWriteGuards.test.ts` (absent vs present column), `contactsMergeDb` (omitted collection keeps rows) |
| R4‑05 | OCC | Merge and `POST /api/contacts` (existing `id`) had no version precondition — a stale writer could silently overwrite a concurrent edit. | `contactsMergeDb` stale-snapshot 409; contract now declares headers + 409 |
| R4‑06 | Selection | Directory selection survived filter/search/sort/page/trash changes; bulk delete/tag/export hit rows the user could not see. | `useContactsDirectoryFilters.test.tsx` (5 cases) |
| R4‑07 | Drawer | An unresolved network link navigated to a fabricated `{id, firstName:""}` contact and offered Edit on a live record. | `useContactsPageOverlayProps.test.ts` (fetched record or null, never a placeholder) |
| R4‑08 | Offline outbox | "Keep local"/"Retry all" re-queued the identical stale `updatedAt`, so the replay 409'd and minted a new conflict forever. | `contactsSyncOutboxConflicts.test.ts` (rebase + attempts) |
| R4‑09 | Authorization | `GET /uploads/tenants/<t>/attachments/**` required only a session + tenant match; any role could read contact documents without `contacts.read`. | `uploadsAuth.test.ts` (deny/allow matrix) |

### 3.2 P2 — backlog (not in this change)

| ID | Finding |
| --- | --- |
| R4‑10 | Custom Setup fields marked `unique` are compared against `contacts.name` (`scalarFieldSql` default branch): real duplicates pass, unrelated names raise bogus 409s. |
| R4‑11 | `contactRepositoryBulkSave` writes `deleted_at/restored_at` from the payload, so a bulk save of a trashed id resurrects it unattributed and without permission/uniqueness checks; write and reconcile also run in separate transactions. |
| R4‑12 | Write responses return the **pre-write** `updatedAt` and drop `createdAt`; two consecutive drawer writes (note → upload) hit a false 409. |
| R4‑13 | Soft delete never reconciles system tags or clears relationship edges to the trashed contact; the delete guard ignores `contact_relationships`. |
| R4‑14 | Setup → Fields save never invalidates the field-config query, so Work columns/tabs/forms stay stale until reload. |
| R4‑15 | Page number is never clamped to `total` and pagination is hidden when the page is empty — deleting a page's last row strands the user on a dead page. |
| R4‑16 | `/duplicate-check` hydrates every same-name contact (no `LIMIT`) with 12 `json_agg` child subqueries per row, on a per-keystroke path. |
| R4‑17 | The keyset cursor is never emitted (it requires `afterId`), so exports page by `OFFSET` over a mutable sort in separate transactions; the VCF walk re-runs `count(*)` per page and its 500-row page size is silently clamped to 100. |
| R4‑18 | A fully failed import still completes green (failures discarded by the job runner), imported contacts get one aggregate audit row keyed by job id, and the UI shows a success panel for partial failures. |
| R4‑19 | `Contact ID` is exported but not accepted by the transfer schema and no idempotency key is passed → re-importing an export duplicates every row. |
| R4‑20 | Column labels ship as frozen English (`labelKey` dropped in the column mapping) and contacts forks `useModuleColumnLayout`, leaving the server column-preferences API orphaned. |
| R4‑21 | The import dialog reads/parses the whole file on the main thread with no size or row cap. |

### 3.3 P3 / deferred (recorded, not scheduled)

`gender` hard-required client-side regardless of tenant config and of the shared DTO (a disabled
field makes the form unsavable; `lockGender` without a value is a dead end) · primary address
seeded from tenant branding on create and persisted as if typed · read DTO's `whatsappStatus` enum
rejects the DB default `"unknown"` (already forked in the import DTO) · `isCurrentlyEnrolled` is
accepted by the write DTO and exported but has **no column** (silent field loss — decide add column
vs remove field) · `z.coerce.number("")→0` passes a required check and `z.coerce.boolean("false")→true`
in the dynamic field validator · lenient `Date.parse` for `dob`/`lastCheckedAt` (invalid dates
become 500s) · contract `body: z.unknown()` for saved reports/setup/Google sync · unbounded `ids`
arrays instead of `bulkIdsBodySchema` · saved-report `drillDown` rejects `quickFilter` · contract
declares `column-preferences` / `field-usage` routes that no backend serves · Google sync compares
array **lengths** only and writes without OCC or an in-flight guard; Disconnect never revokes the
grant · outbox durability (corrupt JSON reads as `[]`, unguarded `setItem` masks the API error, no
cap/TTL) · relationship inference writes peers outside a transaction · phone-number errors are
associated with the dial-code select · index-based row keys drop keyboard focus on removal ·
`ContactsPage.test.tsx` mocks both controller and view · round-2/3 residuals (`N-05…N-10`,
`R2-16/17/40/41/42`, picker enumeration `N-06`, tag i18n `N-07`).

---

## 4. P1 detail (evidence at review time)

**R4‑01.** `contactRepositoryDuplicateReparent.ts` issued
`UPDATE faculty SET contact_id = … WHERE contact_id = <loser>`; `faculty` has no `contact_id`
column after `0160_faculty_drop_employment_mirrors.sql:50`, and the Drizzle `faculty` table never
declares one. The statement ran inside the merge transaction, so the whole merge rolled back and
`POST /api/contacts/merge` returned 500. No existing test executed the SQL: the unit suite drives
merge through a fake repository that stubs `reparentContactReferences`. The same statement set also
never touched `faculty_employments.contact_id` (the owning column), `workshop_participants.contact_id`
or `finance_invoices.family_contact_id`, so even without the hard failure the survivor would have
lost its employment, workshop registration and family invoice.

**R4‑02/R4‑04.** `mergeContactPatch` skips only `undefined`; the CSV parser emitted `[]` for every
absent column; `normalizeContactPhones` returned `phones: []` when phones were not supplied; and
`syncContactPersonalChildrenTx`/`Professional`/`Engagement` deleted every child row before
re-inserting. Any of the three paths therefore deleted data the caller never mentioned.

**R4‑03.** `contactResponseSanitizer` removes a tab's collection for roles that cannot read it
(`TAB_COLLECTION_KEYS`), `buildInitialContactDraft` re-seeds those keys as `[]`, `cleanContactDraft`
keeps `[]`, and `updateContactById` merged it. The UI never showed the rows; the server happily
deleted them.

**R4‑05.** `mergeContactsById` took no version argument, and `upsertContact` saved unconditionally
when the posted `id` matched a row. Only `PUT` (`x-expected-updated-at`) used compare-and-set.

**R4‑06.** `useContactsDirectoryFilters` reset `listPage` on a filter change but never `selected`;
`togglePageIdsInSelection` deliberately keeps cross-page ids. Faculty clears selection on every
list-shape change — contacts did not.

**R4‑07.** `onNavigateToContactFromDrawer` fell back to `overlay.setViewContact({id, firstName:"",
name:""})` when the target was not in the loaded page; the drawer then rendered a blank profile and
offered Edit, seeding a blank draft against a live id.

**R4‑08.** `requeueContactsSyncConflict` re-queued the entry verbatim (stale `updatedAt` included),
the replay re-sent that token, the server 409'd, and `recordContactsSyncConflict` appended a **new**
conflict — the queue could never drain.

**R4‑09.** `authorizeUpload` called `authenticateUploader`, checked the tenant segment, and stopped.
The write side already required `contacts.write`; the read side required nothing beyond a session.

---

## 5. Checked and found sound

1. **Route authorization.** Every contacts route inherits `authenticateTenant` → `registerModuleAccess("contacts")`, and each handler re-checks the finer action (`canRead/Write/Delete`, self-service field whitelist). `MODULE_ROUTE_ACTION_RULES` maps export/setup/picker correctly.
2. **Tenant scoping.** Every contacts query pins `workspace_subdomain`; junction tables use composite `(workspace_subdomain, contact_id)` foreign keys; the picker and duplicate endpoints run inside `withTenant*`.
3. **System-tag ownership.** Manual writes, import, bulk tag, merge and bulk save filter reserved names; contact saves delete only `source IS NULL` rows. Round-3's `touchContacts` removal is in place.
4. **Contract parity (write).** Audit fields are stripped before validation and again in `prepareContactRecord`; the write DTO is `.strict()` with an explicit custom-key allowlist; server-owned soft-delete fields are stripped.
5. **Attachment URL validation.** New/changed attachments must match the tenant's own `/uploads/tenants/<t>/attachments/<file>` path with traversal rejection; legacy URLs are grandfathered per contact.
6. **Google credentials.** Tokens are encrypted at rest, redacted in the client DTO, PKCE + nonce bound, redirect origin/path allow-listed, outbound calls time-bounded.
7. **Work tier stack.** `WorkBatchTable` + virtualization, real error/retry state, factory-derived query keys, and no raw `fetch` in the module.
8. **i18n/a11y baseline.** Directory copy is localized, checkboxes carry accessible names, loading states expose `aria-busy`/`role=status`; the populated a11y spec covers the directory and drawer.
9. **Migrations.** `0200–0202` are in the journal with snapshots and the forward-only gate holds; `0203` is additive DML with a chained snapshot.

---

## 6. Root causes

1. **Absence is indistinguishable from emptiness** across the shared normalizers, the merge use
   case, the import parser and the persist layer. One concept, four implementations.
2. **Write paths drifted from DDL and from the OCC contract** — a raw statement outlived its
   column, and two write routes never adopted the version token that `PUT` already enforced.
3. **Client-side SSOT forks** — selection, column layout and drawer navigation each re-implement (or
   invent) a shared primitive; that is where the invisible-selection and blank-contact bugs live.

---

## 7. Remediation status (this change)

| ID | Status | Fix | Pinning evidence |
| --- | --- | --- | --- |
| R4‑01 | **Fixed** | Dropped the dead `faculty` statement; re-parent set now covers `faculty_employments` (archive-on-conflict), `workshop_participants` (dedupe) and `finance_invoices`; forwards the actor for restore attribution. `0203` repairs rows left behind by pre-fix merges. | `contactsMergeDb` 3 merge cases + repair case; `contactRepositoryDuplicates.test.ts` |
| R4‑02 | **Fixed** | Merge patches onto the survivor (`mergeContactPatch`) and the persist layer treats `undefined` as "leave stored rows"; explicit `[]` still clears. | `contactsMergeDb` patch/omit/clear cases |
| R4‑03 | **Fixed** | Server drops collection keys the viewer cannot read (`stripUnreadableViewerWriteKeys` fed by the same strip plan as reads); the form omits collections absent from the loaded record. | `contactUseCases.test.ts` (2: hidden tab preserved, readable tab cleared), `contactWriteGuards.test.ts` (form/import halves of the shared helper), `contactsMergeDb` (persist keeps rows when a collection is absent) |
| R4‑04 | **Fixed** | CSV parse context exposes `hasColumn`; an absent column leaves the collection `undefined`; persist keeps the stored rows. | `contactWriteGuards.test.ts` (3 cases) |
| R4‑05 | **Fixed** | Merge accepts `x-expected-updated-at` and saves with the version predicate; `POST /api/contacts` returns 409 for an existing id unless the caller proves the version (`409 contact_exists`). Contract + route updated. | `contactsMergeDb` stale 409; `contactsCrud.contract.ts` |
| R4‑06 | **Fixed** | Selection clears on page/search/filter/sort/trash change (faculty parity). | `useContactsDirectoryFilters.test.tsx` |
| R4‑07 | **Fixed** | Drawer navigation fetches the record; failure surfaces a toast and keeps the drawer. | `useContactsPageOverlayProps.test.ts` |
| R4‑08 | **Fixed** | "Keep local" rebases onto the fresh server `updatedAt` and increments an attempts counter (cap 3, translated message). | `contactsSyncOutboxConflicts.test.ts` |
| R4‑09 | **Fixed** | `attachments/**` requires `contacts.read` for tenant sessions; other upload categories unchanged. | `uploadsAuth.test.ts` (3 cases) |
| R4‑10…R4‑21 | **Deferred** | §3.2 backlog | — |

**Residuals to name explicitly**

- The `0203` repair can only fix references whose `deletion_reason` still names the survivor; a
  hard-purged or manually renamed loser is not recoverable.
- R4‑03's trigger is configuration (a disabled or role-restricted tab), not the default seed; the
  demo tenant will not reproduce it without configuring a restriction.
- The form-level half of R4‑03 omits collections absent from the *loaded* record; a record whose
  collections were stripped for another reason (e.g. a legacy scalar-only contact) still round-trips
  through the server's hydration path, not through this guard.

---

## 8. Remediation order (remaining)

1. **R4‑12** (write responses must carry the persisted version) — it is the enabler for the drawer
   and keep-open flows, and it is a one-layer repository change.
2. **R4‑11, R4‑13** — resurrection provenance and delete-side tag/edge consistency.
3. **R4‑10** — the uniqueness gate is wrong for a documented tenant-configurable field type.
4. **R4‑17, R4‑16, R4‑18** — export snapshot, duplicate-check bound, import truthfulness.
5. **R4‑14, R4‑15, R4‑20** — cache invalidation, page clamp, column-label SSOT/i18n.
6. **R4‑19, R4‑21** — import identity and bounds.
7. §3.3 P3 register.

No finding justifies bypassing normal review or an emergency release.

---

## 9. What this review could not prove

- **No runtime reproduction of R4‑02/R4‑03 through the browser.** The mechanisms are fully
  determined by the code and are now covered by unit/DB tests; the UI path (form + sanitized read)
  was exercised at the hook level only.
- **No browser/axe run.** The populated a11y spec exists but was not executed this round.
- **No production telemetry.** Frequency and tenant prevalence are unknown; severities are
  code-path based.
- **The `0203` repair was verified against a rolled-back-style fixture** inside one tenant
  (RLS-scoped), not against a real historical production dataset.
