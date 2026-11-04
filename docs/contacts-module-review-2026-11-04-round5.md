# MMS Contacts Module Review — 2026-11-04 (round 5)

Independent, read-only re-review of the contacts domain at `main` HEAD `60245210a` (clean tree),
after the round-4 fix set landed in `ab9874cab` (#274).

**Scope.** `apps/backend/src/routes/tenant/contacts/**`, `apps/backend/src/contacts/**`,
`apps/backend/src/db/repositories/contact*`, `apps/backend/src/db/schema/contact*`,
`apps/backend/src/plugins/staticAssets.ts`, `packages/shared/src/{contacts,contracts,schemas}`,
`apps/frontend/src/tenant/features/contacts/**`, `apps/frontend/src/lib/contacts/**`,
`apps/frontend/src/components/contact*/**`, the contacts e2e/DB specs, and
`lib/moduleRouteActions.ts`.

**Method.** Single-pass static audit of the production path for every claim: actual route +
guard + use case + repository mapper + DTO + migration. Every round-4 fix was re-read in the tree
rather than trusted from `docs/contacts-module-review-2026-11-03-round4.md`. Focus areas were the
seams prior rounds never reviewed together — contacts↔students/faculty/workshops, contacts as
shared identity owner under archive/merge/import, messaging quick actions, dashboard consumers,
realtime invalidation, and the import/export job paths.

**Regression check.** `git diff --stat ab9874cab..HEAD` contains **no** changes under any contacts
path (only `faculty.contract*`, `messaging.contract.ts`, `messaging.dto.ts` and `students.dto.ts`
moved, for #275–#277). No contacts regression can have landed since round 4.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| HEAD | `60245210a`, clean tree |
| Contacts-path diff since `ab9874cab` | empty |
| `pnpm typecheck` (5 packages) | green (review harness) |
| `check:code-norms`, `check:work-directory`, `check:db-projections`, `check:frontend-structure`, `check:backend-boundaries`, faculty-domain ratchet | green (review harness) |
| `moduleAccessCoverage.test.ts` | 1/1 green |
| `routeAccess.test.ts` | 11/11 green |
| Database / browser | **not executed** — this pass is static; M-1…M-3 are proven on the code path, not by a live run |

## 2. Verdict

Round 3 and round 4 hold, with two qualifications: R4-05's OCC contract is enforced **server-side
only** (the client never satisfies it on `POST`), and R4-08's replay fix is per-row only.

Three new Majors sit in the surfaces earlier rounds never reviewed together:

1. **Merge cannot complete for the canonical duplicate shape.** When the survivor lacks the CNIC
   the loser holds, the survivor's `UPDATE` collides with the loser's still-active row on
   `contacts_workspace_cnic_active_uidx`; the route reports it as a validation error on the
   surviving person's own CNIC.
2. **The dependent-link delete guard's 409 is turned into a 500** by the ts-rest DELETE handler, so
   the one actionable message ("archive or reassign the student profile first") never reaches the
   operator.
3. **Offline `upsert` replay is unrecoverable** — the create wrapper never sends
   `x-expected-updated-at`, so a queued upsert for an existing row 409s forever and "Keep local"
   rebases a token that is never transmitted.

Plus one systemic observability gap: nine contact route handlers answer 500 with no server-side log,
five of them discarding the error object entirely. **No P0** — no cross-tenant leak, no auth bypass.

## 3. Round-3/round-4 verification

| item | holds? | evidence |
| --- | --- | --- |
| R4-01 merge re-parent no longer references `faculty.contact_id` | **holds** | `contactRepositoryDuplicateReparent.ts:21-22` documents the 0160 drop; statements cover students (4 cols), `facultyEmployments` (archive-on-conflict then re-point, matching `faculty_employments_contact_active_uidx`), `workshopParticipants` (dedupe), `financeInvoices`, `tenantUsers`, `messageLogs` (`:83-159`); every statement pins `workspace_subdomain`; nested `withTenant` joins the merge tx (`tenant-context.ts:65-105`) |
| R4-02/R4-04 absent-means-empty | **holds** | merge patches onto the survivor (`contactBulkWriteUseCases.ts:73-78`); all three persist layers gate on `!== undefined` (`contactPersistPersonalChildren.ts:23`, `…Engagement…:21,51,76,102`, `…Professional…:16,39,66,95`); CSV `hasColumn` (`contactsCsvParser.ts:81`, `contactsCsvRowParserTypes.ts:18-19`) |
| R4-03 viewer write guard | **holds** | `contactViewerWriteGuard.ts:21-29`, applied at `contactWriteUseCases.ts:124` (upsert), `:245` (update), `contactBulkWriteUseCases.ts:76-78` (merge) |
| R4-05 OCC on merge + POST upsert | **server holds, client gap** | merge `contactBulkWriteUseCases.ts:63-67,101-104`; create `contactWriteUseCases.ts:95-101`; contract headers `contactsCrud.contract.ts:50` — client never sends it (M-3) |
| R4-06 selection reset | **holds** | `useContactsDirectoryFilters.ts:42-53` (render-time adjust, filter+page scope) |
| R4-07 drawer fetch | **not re-verified** | outside this pass's time-box; no new evidence either way |
| R4-08 offline replay rebase | **partial** | per-row "Keep local" rebases (`useContactsSyncConflictRow.ts:99-107`); `requeueAllContactsSyncConflicts` re-queues verbatim (`contactsSyncOutboxConflicts.ts:50-56`); the flush never enforces `attempts` (`contactsSyncOutboxFlush.ts:73-90`) |
| R4-09 attachment download gate | **holds** | `staticAssets.ts:213-218` (`isUploadModuleAccessDenied` → `canReadContacts`), reachable because the tenant is bound on every request (`plugins/requestHooks.ts:9-22`) |

## 4. Findings detail

### M-1 — Merge aborts on the CNIC the merged-away contact still holds (Major)

**Evidence.**
- `packages/shared/src/contacts/contactMergeUtils.ts:31-40` copies any value the survivor lacks —
  `cnic` is not in `EXCLUDED_MERGE_KEYS`:
  `for (const key of Object.keys(other)) { if (EXCLUDED_MERGE_KEYS.has(key)) continue; if (merged[key] === undefined || … === null || … === "") { merged[key] = other[key]; } }`
- `apps/backend/src/db/schema/contactCoreTables.ts:90-95` declares a **workspace-wide** partial unique index:
  `uniqueIndex("contacts_workspace_cnic_active_uidx").on(table.workspaceSubdomain, sql\`(regexp_replace(${table.cnic}, '[^0-9]', '', 'g'))\`).where(sql\`${table.deletedAt} is null and …\`)`.
  Created by `0066_contacts_unique_indexes.sql:62-69`; the phone/email twins were dropped by
  `0075_contacts_normalization.sql:16-17`, so `cnic` is the only remaining workspace-unique column.
- `apps/backend/src/db/repositories/contactRepositoryValues.ts:20` writes `cnic: contact.cnic ?? null`
  into the UPDATE set used at `contactRepositoryPersist.ts:118`.
- Merge persists the survivor **before** archiving the loser: `contactBulkWriteUseCases.ts:103-110`
  (`repo.saveIfVersionMatches` / `repo.save(tenant, next)`), then `:113-120` soft-deletes the loser
  with `deletionReason: "Merged into <keepId>"`.
- `apps/backend/src/routes/tenant/contacts/contactRouteErrors.ts:25-27` maps any `23505` whose
  constraint mentions `cnic` to `"CNIC must be unique per contact"`, returned as **400** at `:98-108`.

**Production path.** `POST /api/contacts/merge` (`contactAuditExportRoutes.ts:117-165`) →
`requireContactPermission(["write","delete"])` → `mergeContactsById` → `runInTransaction` →
`UPDATE contacts SET cnic = <loser cnic> WHERE …` while the loser is still `deleted_at IS NULL` →
`23505` on `contacts_workspace_cnic_active_uidx` → tx aborts → `handleContactWriteError` →
`400 {"type":"validation_error","message":"CNIC must be unique per contact"}`.

**Consequence.** The duplicate shape that duplicate-detection actually produces (one record captured
the CNIC, the other did not) can never be merged; the operator is told the surviving person's own
CNIC is a duplicate, and the only workaround is to clear the CNIC on the losing record first.

**Proposed fix.** Inside the merge transaction archive the loser (or null its workspace-unique
columns) **before** persisting the survivor; add the CNIC-only-on-loser case to
`contactsMergeDb.integration.test.ts`.

### M-2 — The dependent-link guard's 409 becomes a 500 on the single DELETE route (Major)

**Evidence.** `apps/backend/src/db/repositories/studentDeleteGuard.ts:80-105` throws actionable
domain conflicts — `throw new ConflictError(DEPENDENT_LINK_MESSAGES.student)` →
`"Cannot delete contact linked to active student profiles. Archive or reassign student profiles first."`
(plus active-employment and active-user variants).
`apps/backend/src/routes/tenant/contacts/contactCrudRoutes.ts:251-261` discards the type:
`} catch (error) { request.log.error(error, "Failed to delete contact"); return { status: 500 as const, body: { type: "database_error", message: "Failed to delete contact" } }; }`
The contract cannot express the outcome either — `packages/shared/src/contracts/contactsCrud.contract.ts:106-111`
declares only `200/403/404/500` for `delete`.

**Production path.** `DELETE /api/contacts/:id` implemented by `contactCrudRoutes.delete`
(registered at `routes/tenant/contacts.ts:69`) → `softDeleteContactById` →
`bulkSoftDeleteContacts` → `repo.guardDeleteDependents` (`contactSoftDeleteUseCases.ts:42-44`) →
`ConflictError` → generic 500.

**Consequence.** Archiving a guardian/staff contact that backs a live student, employment or user
shows "Failed to delete contact" with no reason; the operator cannot discover the blocking record.
The bulk path already maps the same guard correctly (`crudBulkRouteFactories.ts:117-125` →
`sendIfHttpDomainError` → 409), so the two delete entry points disagree.

**Proposed fix.** Route the handler through `sendIfHttpDomainError`, declare `409` (and `400`) on
`delete.responses`, and pin it with an `inject()` test asserting
`409 { type: "conflict" }` when a student link exists.

### M-3 — Offline `upsert` replay is unrecoverable: create never sends the version token (Major)

**Evidence.**
- Backend demands it: `contactCrudRoutes.ts:136-143` —
  `requireExpectedVersion: true, expectedUpdatedAt: headers?.["x-expected-updated-at"]`; enforced at
  `contactWriteUseCases.ts:95-101` (`ConflictError(CONTACT_EXISTS_CONFLICT)` for an existing id).
- Client never sends it: `useContactMutations.ts:69` —
  `const response = await upsertContactMutation.mutateAsync({ body: contact });` (no headers).
  The outbox recovery path calls the same wrapper (`useContactsSyncOutbox.ts:57`), as does
  "Apply merge" for an `upsert` conflict (`useContactsSyncConflictRow.ts:126-127`).
- The queue entry kind is `upsert` for this call (`useContactMutations.ts:71-74`); R4-08's rebase
  only rewrites the body field (`useContactsSyncConflictRow.ts:106`).

**Production path.** Offline create whose request reached the server but whose response was lost →
`enqueueContactsOutbox({kind:"upsert"})` → reconnect → `flushContactsOutbox` →
`POST /api/contacts` with an existing id and no header → `409 contact_exists` → conflict re-recorded.
"Keep local" rebases `updatedAt`, re-queues, 409s again; "Apply merge" also 409s for `upsert`.

**Consequence.** A contact saved offline in this window can never be pushed; every attempt mints a
fresh conflict because the flush ignores `attempts` (`contactsSyncOutboxFlush.ts:73-90`).

**Proposed fix.** Send `headers: { "x-expected-updated-at": contact.updatedAt }` from the create
wrapper and both conflict-recovery call sites; add an outbox test that drains an `upsert` conflict
against an already-existing row.

### M-4 — Contact route 500s are silent (Major)

**Evidence.** `apps/backend/src/lib/httpErrors.ts:58-61` logs **only when a cause is passed**:
`if (cause !== undefined) { logger.error({ err: cause }, message); }`.
In the contacts routes, five handlers discard the error with a bare `catch {}` —
`savedReportRoutes.ts:26,62,83,100` and `contactDuplicateRoutes.ts:37` — and four more pass no cause
(`googleSyncRoutes.ts:31,62,79,106,129`). `contactCrudRoutes.ts` logs correctly, so the gap is
confined to saved reports, duplicate-check and the Google-sync surface.

**Production path.** e.g. `GET /api/contacts/saved-reports` (`savedReportRoutes.ts:18-28`) →
repository failure → `catch {` → `sendDatabaseError(reply, "Failed to list saved reports")` → 500
with no log line.

**Consequence.** Every failure in those surfaces is a stackless, request-id-less 500 —
untriageable in production and invisible to status-only tests.

**Proposed fix.** Pass `error` as the third argument (or `request.log.error(error, …)`) at all
nine sites; add a guard test that `sendDatabaseError` is never called without a cause inside
`routes/tenant/contacts/**`.

## 5. Minor findings

| ID | Finding | Evidence |
| --- | --- | --- |
| m-1 | Contact writes never invalidate **students** caches, although student rows derive `fatherName`/`motherName`/`guardianName` from contact records | `studentHydrateUseCases.ts:66-74`; `invalidateStudentsQueries.ts:28-31` (students→contacts, one-way); `invalidateModuleQueries.ts:63-64`; `invalidateContactsQueries.ts:28-35` (messaging covered, students not) |
| m-2 | "Retry all" re-queues the identical stale token; the `attempts` cap only exists on the per-row button and the flush ignores it | `contactsSyncOutboxConflicts.ts:50-56`; `contactsSyncOutboxFlush.ts:73-90`; `useContactsSyncConflictRow.ts:91` |
| m-3 | Contact create/update/delete/merge audit rows are appended **after** commit, outside the tx, and failures are swallowed — the write can succeed with no audit row (§5.4 atomicity) | `createCollectionAuditHelper.ts:65-74`; `contactCrudRoutes.ts:145-157,188,224`; `contactAuditExportRoutes.ts:148-153` |
| m-4 | `prepareContactRecord` always materialises `tags`, so absent-vs-empty can never protect tags: every save/import/merge deletes and re-inserts stored tag rows with regenerated ids | `contactValidationUseCases.ts:116-124`; `contactPersistPersonalChildren.ts:49-56` |
| m-5 | Merge leaves `contact_relationships.inferred_from_contact_id` pointing at the merged-away contact | `contactRepositoryDuplicateReparent.ts:69-81`; `contactProfileTables.ts:190` |
| m-6 | `orphan_profiles.sponsor_contact_id` is not re-parented on merge (no production readers found) | `schema/charity.ts:55,63-67` |
| m-7 | A delete-kind outbox replay against an already-deleted contact is classified as a conflict, so an idempotent outcome surfaces as an error row | `contactsSyncOutboxFlush.ts:84-88`; `contactCrudRoutes.ts:247-250` |
| m-8 | R4-09's legacy-root branch is dead: root `attachments/…` is rejected earlier by the cross-tenant-root rule, so pre-hardening attachment URLs are undownloadable | `staticAssets.ts:174-181,187-197,204-210` |
| m-9 | `enqueueContactBackgroundJob` returns an existing job without a status check, so a reused idempotency key hands back a completed job (latent — no contacts caller sends a key) | `contactRouteHelpers.ts:76-86`; `lib/backgroundJobIds.ts:41-47` |
| m-10 | `mergeContacts` excludes `notes`, so the losing record's notes are dropped with no UI warning | `contactMergeUtils.ts:16-29` |

## 6. Test gaps

1. No merge case where only the loser holds the CNIC — the `contactsMergeDb` fixtures
   (`baseContact`, `:33-43`) never set `cnic`, which is why M-1 survived round 4's new DB suite.
2. No `inject()` test for `DELETE /api/contacts/:id` when `guardDeleteDependents` throws (M-2);
   only the guard unit test exists (`studentDeleteGuard.test.ts:66`).
3. No test asserting the client transmits `x-expected-updated-at` on `POST /api/contacts` (M-3).
4. No test that `requeueAllContactsSyncConflicts` terminates against a stale-token conflict (m-2).
5. No invalidation test asserting a `contacts` live push invalidates the students list keys (m-1).
6. No test that a contacts-route 500 carries a logged cause (M-4).

## 7. Verified-clean surfaces

1. **Route authorization.** `authenticateTenant` + `registerModuleAccess("contacts")`
   (`routes/tenant/contacts.ts:25-26`); the picker is `action: "availability"`
   (`lib/moduleRouteActions.ts:67-72`) and both handlers enforce `canUseContactPicker`
   (`contactPickerRoutes.ts:78,108`) before projecting the 4-field DTO (`:56-67`).
2. **Tenant scoping on the identity path.** Every reparent/guard statement pins
   `workspace_subdomain`; nested `withTenant` re-applies RLS and restores the outer GUC
   (`tenant-context.ts:65-105`).
3. **Merge reference coverage** now exceeds the module list and matches the real unique indexes
   (employment archive-on-conflict, workshop-participant dedupe), with no dropped column.
4. **Absent-vs-empty** in all three persist layers plus the CSV `hasColumn` contract.
5. **OCC** predicate-in-the-UPDATE on PUT, POST-with-token and merge.
6. **Restore.** Pre-validated uniqueness → 400 with field errors; race `23505` → 409; audit only on
   a real transition; `entity.restored` outbox inside the tx (`contactRestoreUseCases.ts:41-107`;
   `crudSingleDeleteRestoreRoutes.ts:127-131`).
7. **Attachment read gate** plus `private, no-store` on every non-public upload
   (`staticAssets.ts:38-53,90-108,213-218`).
8. **Selection reset** on filter/search/sort/page/trash change, with its 5-case spec.
9. **Realtime/cache.** Contacts broadcast invalidates dashboard summary, dynamic widget aggregates
   and messaging recipient caches (`invalidateModuleQueries.ts:46-60`,
   `invalidateContactsQueries.ts:28-35`); dashboard summary TTL is 30 s
   (`dashboardSummaryService.ts:45`).
10. **Outbox storage** is tenant+user scoped (`contactsSyncOutboxStorage.ts:36-40`) and replay is
    single-flight (`contactsSyncOutboxFlush.ts:54-65`).
11. **No contacts regression** since round 4 (empty diff).

## 8. Adversarial audit

- **Edge cases / payload integrity.** Partial and hidden-tab bodies now preserve stored children
  (R4-02/R4-03 hold), but the unique-ordering hazard (M-1) shows the merge is still not
  order-safe against its own DDL; a survivor with no CNIC is the common, not the exotic, case.
  `tags` is the one collection that can never be "absent" after preparation (m-4).
- **Failure modes / silent failures.** Nine handlers convert failures into 500s with no log, five
  by discarding the error object (M-4); audit append failures are swallowed inside the helper while
  the write stands (m-3), so a silent audit gap is possible with a green response.
- **Security / multi-tenancy.** No cross-tenant path found: RLS GUCs are re-applied per nested
  scope, uploads require tenant match plus `contacts.read` for attachments, the picker projects a
  minimal DTO, and `assertContactAttachmentUrls` still constrains new URLs to the caller's tenant.
  Contact delete is blocked when a live student/employment/user depends on the row — the guard is
  sound; only its HTTP mapping is wrong (M-2).
- **Concurrency.** The dependent-link guard reads through `withTenantRead`, so it is a pre-check,
  not a lock (see §10.2). Merge is single-transaction and versioned, but the survivor/loser write
  ordering defeats the CNIC index (M-1). Offline replay is single-flight, yet the OCC token gap
  (M-3) makes an unresolvable entry retry forever.

## 9. Resolution plan

**Tier 1 — fix before the next contacts release (M-1…M-4).**

1. **M-1**: archive the loser (or null its `cnic`) before the survivor `UPDATE` inside the merge
   transaction; add the CNIC-only-on-loser DB case to `contactsMergeDb.integration.test.ts`.
2. **M-2**: map `ConflictError` in `contactCrudRoutes.delete` via `sendIfHttpDomainError`, declare
   `409`/`400` on the contract, pin with an `inject()` test.
3. **M-3**: send `x-expected-updated-at` from the create wrapper and both conflict-recovery paths;
   add an outbox drain test for an `upsert` conflict against an existing row.
4. **M-4**: pass the error through at all nine `sendDatabaseError` sites (replace the five bare
   `catch {}` blocks with `catch (error)`), plus a guard test preventing a causeless call.

**Tier 2 — minors, next maintenance window (m-1…m-10).** In order: m-1 (contacts→students
invalidation, one line in the shared invalidator), m-2 (enforce the attempt cap in the flush and
rebase on "Retry all"), m-3 (append contact audit rows with the write transaction), m-4 (make
`tags` truly optional in `prepareContactRecord`), m-5/m-6 (re-parent the residual reference
columns), m-7/m-9 (idempotent replay and job-status check), m-8 (delete the dead legacy branch or
reinstate root-attachment access deliberately), m-10 (decide and document notes-on-merge).

**Not scheduled.** §10 hypotheses stay unproven; promoting any of them requires a two-connection or
browser test first.

## 10. Hypotheses not proven

1. **M-1/M-2/M-3 were proven on the code path, not executed** — no PostgreSQL, `inject()` or browser
   run happened in this static pass. Each is a 20–30 line test away from confirmation.
2. **Guard race.** `guardDeleteDependents` reads via `withTenantRead` (`studentDeleteGuard.ts:61`);
   a student created concurrently after the guard could leave an active student pointing at a
   trashed contact.
3. **m-10 notes loss** may be intentional; no comment or test states the intent.
4. **m-6 orphan_profiles** may have no live readers, so real-world impact may be nil today.
5. **m-9** is latent: no contacts caller passes an idempotency key, so no live symptom was found.
6. **No telemetry.** Tenant prevalence and failure frequency are unknown; all severities are
   code-path based.

## 11. Implementation status (2026-11-04)

| ID | Status | Change | Guard |
| --- | --- | --- | --- |
| M-1 | **Fixed** | The merged-away contact is archived **before** the survivor is saved, releasing workspace-unique values (CNIC) first | added CNIC-only-on-loser case in `contactsMergeDb.integration.test.ts` |
| M-2 | **Fixed** | `DELETE /api/contacts/:id` maps domain errors through `formatContactWriteError` (409 for the dependent-link guard); contract declares 400/409 | delete handler + contract |
| M-3 | **Fixed** | The create/upsert wrapper sends `x-expected-updated-at` when the contact carries `updatedAt`, so offline replay is a versioned upsert | client mutation path |
| M-4 | **Fixed** | The nine silent contact 500s now pass their cause to `sendDatabaseError` (logged server-side) | route handlers |

Still open (Tier 2): the ten minors in §5.
