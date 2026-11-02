# MMS Contacts Module Review — 2026-11-02

Independent, read-only review of the contacts domain at commit `ef994f0f9` (tree-identical to
`4f5696afb`; `git diff` between them is empty). Working tree was clean at review time.

**Method.** Baseline gates and the contacts unit/integration suites were run locally; the three
package typechecks pass. Lane audits covered backend security/tenancy, the write and soft-delete
paths, the data layer and contracts, frontend data flow, and the test surface. Two candidate
behaviours were reproduced with throwaway scripts (not committed): the field-sanitizer gap and the
malformed-list-query crash. Concurrency findings are proved from the executed SQL path (upsert
without a version predicate, default `read committed`, no `FOR UPDATE` in any contacts repository);
they were not race-reproduced because no local Postgres was available.

**Scope.** `apps/backend/src/routes/tenant/contacts*`, `apps/backend/src/contacts/**`,
`apps/backend/src/db/repositories/contact*`, `packages/shared/src/contacts/**`,
`packages/shared/src/contracts/contacts*`, `packages/shared/src/schemas/contacts*`,
`apps/frontend/src/tenant/features/contacts/**`, `apps/frontend/src/lib/contacts/**`, contacts
migrations `0004`–`0101`, and the contacts e2e/a11y specs. Consumers (students/faculty/messaging)
were inspected only where they call contact services.

---

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter @mms/shared typecheck` | **Pass** |
| `pnpm --filter mms-backend typecheck` | **Pass** |
| `pnpm --filter mms-frontend typecheck` | **Pass** |
| `@mms/shared` contacts suites | **31 files / 239 tests passed** |
| `mms-backend` contacts suites (incl. `contacts.integration.test.ts`) | **29 files / 276 tests passed** |
| `mms-frontend` contacts + `src/lib/contacts` suites | **136 files / 418 tests passed** |
| `moduleAccessCoverage.test.ts` | **1 passed** |
| `routeAccess.test.ts` | **11 passed** |
| `check:code-norms` | 0 explicit `any`; 4 files over 300 LOC (baseline 4; none in contacts); 0 arbitrary colour expressions |
| `check:db-projections` / `check:work-directory` / `check:backend-boundaries` / `check:shared-ui` | 0 violations |
| `check:frontend-structure` / `check:shared-structure` | Pass |
| `pnpm check:i18n` | 9,476 keys; ar/ur/fa missing = 0 |
| `test:db` / `test:rls` | **Not run** — no local Postgres/`psql`; there is no contacts-specific real-DB suite |
| Playwright e2e + axe (`a11y-populated`, `contacts-import-export`) | **Not run** — requires the dev servers |

Environment: Node `v26.7.0`, pnpm `11.15.1`.

## 2. Verdict

The structural ratchets and unit suites are genuinely green, and the module is unusually
well-factored for its size (119 colocated specs, 0 `any`, 0 files over 300 LOC in the contacts tree).
It is **not clean**: there are **no P0s**, but two P1s — the optimistic-concurrency guard is racy by
construction, and contact snapshots are written to the audit chain without subject-key encryption —
plus three P2s in the write/visibility path. The ratchets cannot see any of this: they measure
structure, not the execution path of a concurrent save or a role-scoped response.

## 3. Findings summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| C-01 | **P1** | Concurrency | Optimistic concurrency is check-then-upsert; two concurrent saves both pass the `updatedAt` check and the last one silently wins |
| C-02 | **P1** | Audit / privacy | Contact delete/restore audit events write full contact snapshots without `subjectId`, so they are stored unencrypted and survive key shredding |
| C-03 | **P2** | Write path | `bulk-tag` re-saves fully hydrated contacts, deleting and re-inserting every child row from a snapshot read before any lock — a concurrent phone/email edit is reverted |
| C-04 | **P2** | Field visibility | The response sanitizer strips collection-tab fields but not scalar basic-tab fields (`cnic`, `dob`, `notes`, …) restricted by `permissions` |
| C-05 | **P2** | Export | VCF export never applies the viewer sanitizer that the CSV export applies; restricted fields/tabs are exported verbatim |
| C-06 | P3 | Contracts | The list contract uses `baseListQuerySchema`, not the domain schema; malformed repeated params (`?gender=a&gender=b`) reach `.trim()` and 500 |
| C-07 | P3 | Audit | Restoring an already-active contact returns 200 and writes a false `contact.restore` audit row |
| C-08 | P3 | Bulk ops | `bulk-restore` iterates raw ids (no dedupe), so duplicated ids inflate `succeeded`/`failed` |
| C-09 | P3 | Audit | `export-audit` / `setup-audit` accept a client-supplied count/summary and persist it as audit truth |
| C-10 | P3 | Defense in depth | `sanitizeForUser` fails open when the tenant field-config row is missing; the export path explicitly falls back to the seed instead |
| C-11 | P3 | OAuth | Google Contacts OAuth has no PKCE and the exchange endpoint never validates OAuth `state` server-side |

## 4. Findings

### C-01 — P1 — Optimistic concurrency is check-then-upsert (lost updates)

**Evidence.** `apps/backend/src/contacts/use-cases/contactWriteUseCases.ts:155-187` reads the row,
compares `existing.updatedAt` with `x-expected-updated-at`, then calls `repo.save`. The save is
`INSERT … ON CONFLICT DO UPDATE` with no version predicate
(`apps/backend/src/db/repositories/contactRepositoryPersist.ts:42-51`), and `updatedAt` is
overwritten server-side (`apps/backend/src/db/repositories/contactRepositoryValues.ts:32-40`). The
transaction uses the connection default isolation (`apps/backend/src/db/dbTransactions.ts:242-248`
→ `read committed`), and no contacts repository uses `FOR UPDATE` (grep: zero matches).

**Why it reproduces.** Two editors open the same contact. Both send `PUT` with the same
`x-expected-updated-at`. Both transactions read the same `updatedAt` before either commits, both
pass the check, both upsert, and the second silently overwrites the first. The 409 only fires when
the second request's *read* happens after the first *commit* — the exact window the guard exists to
close. The integration test
(`apps/backend/src/__tests__/contacts.integration.test.ts:1361`) asserts header pass-through only;
the unit test never exercises two connections.

**Impact.** Silent lost update on concurrent edits of the same contact (phones, addresses, notes).
The contract comment promises “two editors cannot silently overwrite each other”
(`packages/shared/src/contracts/contactsCrud.contract.ts:79-83`).

**Fix.** Make the write conditional: `UPDATE … WHERE workspace_subdomain = $1 AND id = $2 AND
updated_at = $3 RETURNING *`, or `SELECT … FOR UPDATE` inside the existing transaction and compare
the locked row's `updatedAt`, throwing `ConflictError` when it moved. Keep the no-header path
unchanged.

**Acceptance.** Real-Postgres test with two clients/connections (or an injected serialization
barrier) proving the second save gets 409 and the first payload survives.

**Owner.** `mms-api-interface` §6 · `mms-backend-api`.

### C-02 — P1 — Delete/restore audit snapshots are not subject-encrypted

**Evidence.** `apps/backend/src/contacts/use-cases/contactSoftDeleteUseCases.ts:100-109` calls
`recordModernAuditEvent` with `oldState: c` and no `subjectId`; `contactRestoreUseCases.ts:99-106`
and `:206-215` do the same with `newState`. Encryption at capture is keyed only on
`input.subjectId` (`apps/backend/src/services/auditTrailService.ts:151-165`), and
`sanitizeAuditState` only redacts credentials, not PII
(`apps/backend/src/lib/auditState.ts:24-60`). The route-level helper *is* subject-scoped
(`contactRouteHelpers.ts:123-124`, used at `contactSoftDeleteRoutes.ts:24-26`), so the summary row is
encrypted while the full-state row is not. The same pattern exists for students
(`apps/backend/src/students/use-cases/studentSoftDeleteUseCases.ts:91-97`), so fixing it here should
be mirrored.

**Impact.** Contact phones, emails, CNIC, bank details and notes persist in cleartext in the audit
chain. Destroying the subject key (right-to-erasure / `mms-audit-trail`) does not make those rows
unreadable, which is the property subject-state encryption exists to provide.

**Fix.** Pass `subjectId: String(id)` (or the acting subject id) on both delete and restore
`recordModernAuditEvent` calls, matching `createCollectionAuditHelper`'s `subjectScoped` behavior;
add the same to the students path.

**Acceptance.** Unit/integration test asserting the audit append receives `subjectId` and that the
persisted state is ciphertext (reuse the `subjectKeyService` tests' pattern).

**Owner.** `mms-audit-trail` · `mms-data-layer` §5.

### C-03 — P2 — Bulk tag rewrites children from a stale snapshot

**Evidence.** `apps/backend/src/contacts/use-cases/contactBulkWriteUseCases.ts:88-153` loads full
hydrated contacts (`repo.findByIds`) inside `runInTransaction`, changes only tags, and calls
`repo.bulkSave(tenant, toSave)`. `bulkSaveContacts` deletes every child row for those ids
(phones, emails, addresses, education, experience, relationships, bank details, … —
`apps/backend/src/db/repositories/contactRepositoryBulkSave.ts:63-155`) and re-inserts the snapshot
with no row lock or version check.

**Why it reproduces.** A user tags a contact while another user saves a phone number. If the phone
edit commits after the tag path's `findByIds` read and before its `bulkSave`, the re-insert writes
the stale phone list and the phone edit is gone. The tag request itself reports success. Single
saves have the same shape via `syncContactChildrenTx`
(`apps/backend/src/db/repositories/contactRepositoryPersistChildren.ts:18-27`), which is why C-01
matters beyond the header.

**Fix.** Tag updates should touch only `contacts`/`contact_tags` (dedicated SQL), not rewrite every
child table. If the full-row save stays, lock the contact (`SELECT … FOR UPDATE`) and re-hydrate
inside the lock.

**Acceptance.** Test with a concurrent child mutation (two connections, or a barrier in the repo)
proving the tag path does not revert the child edit.

**Owner.** `mms-data-layer` · `mms-backend-api`.

### C-04 — P2 — Basic-tab field permissions are ignored by the response sanitizer

**Evidence.** `resolveContactStripPlan` handles collection tabs in `TAB_COLLECTION_KEYS`
(`packages/shared/src/contacts/contactResponseSanitizer.ts:14-27,70-94`) and then treats every other
tab — including `basic` — as a collection: hidden fields become `rowFields` for
`mutable["basic"]`, which does not exist, so the scalar keys are never deleted (`:97-111`). The only
basic fields explicitly stripped are `firstName`/`lastName` (`:113-119`). Fields absent from the
config are treated as visible (`:41-45`).

**Reproduced.**

```text
input : { id:"1", firstName:"A", lastName:"B", cnic:"12345-6789012-3" }
config: basic.cnic.permissions = ["admin"], viewer role "teacher"
output: {"id":"1","firstName":"A","lastName":"B","cnic":"12345-6789012-3"}
```

`PUT /api/contacts/field-config` accepts arbitrary field records
(`packages/shared/src/schemas/moduleFieldConfig.dto.ts:6-13`), and the router applies the same
sanitizer to list/get/resolve/duplicates (`contactRouteHelpers.ts:111-121`,
`contactDuplicateRoutes.ts:53`). The frontend *does* hide the field
(`ContactDetailFields`/`EntityDescriptor`), so an operator who restricts CNIC/DOB/notes sees a
hidden column while the API still returns it.

**Impact.** Role-restricted scalar PII (CNIC, DOB, notes, tags, avatar) is returned to every reader.

**Fix.** For non-collection tabs, add hidden field keys to the top-level strip set when the matching
contact property exists; keep the current row-field logic for real collections. Add a
`basic`-tab case to `contactResponseSanitizer.test.ts`.

**Precondition / scope note.** The current Setup UI exposes Preferences and Sync only; `permissions`
is written through the field-config API, and the seed sets `[]`. The defect is latent until a tenant
(or a future Fields editor) uses it — but the control exists and is enforced in the UI, so the API
gap is real.

**Owner.** `mms-fields-registry` · `mms-auth-security` §3.

### C-05 — P2 — VCF export bypasses viewer sanitization

**Evidence.** `POST /api/contacts/export/vcf` queues `{ filename, label }` only
(`apps/backend/src/routes/tenant/contacts/contactAuditExportRoutes.ts:74-96`). The worker calls
`buildContactsVcfExport` with no viewer role
(`apps/backend/src/services/backgroundJobRunnerService.ts:103-119`), and the generator maps
`toVCard` directly over `loadContactsPage` results
(`apps/backend/src/contacts/use-cases/contactExportUseCases.ts:136-173`). `toVCard` emits phones,
emails, employer, designation, `NOTE` and `BDAY`
(`packages/shared/src/core/vcardUtils.ts:118-140`). Contrast the CSV path, which threads
`viewerRole: user.role` (`apps/backend/src/lib/registerModuleCsvExportRoutes.ts:76`) and sanitizes
every chunk (`contactExportUseCases.ts:93-114`).

**Impact.** Any reader can export fields/tabs that CSV export would strip. Under the C-04
precondition this includes restricted CNIC/DOB/notes; tab-level hiding (phones/emails) is bypassed
the same way.

**Fix.** Add `viewerRole` to `ContactsVcfExportJobPayload` from `user.role` at enqueue, and sanitize
each page with `resolveContactFieldConfigSnapshot` + `sanitizeContactsForViewer` before `toVCard`
(the CSV path is the template).

**Acceptance.** VCF test with a viewer-restricted tab/field asserting the card omits it.

**Owner.** `mms-reports-export` · `mms-auth-security` §3.

### C-06 — P3 — List query bypasses the domain query schema → 500 on malformed params

**Evidence.** `contactsCrudRoutes.list` declares `query: baseListQuerySchema`
(`packages/shared/src/contracts/contactsCrud.contract.ts:38-48`), a `.passthrough()` schema
(`packages/shared/src/core/apiSchemas.ts:21`). The domain schema
`contactsListQuerySchema` (`packages/shared/src/contacts/contactsListQuery.ts`, with `gender`,
`hasPhone`, `quickFilter`, `excludeIds`, …) is never applied. `buildListConditions` assumes strings
(`contactRepositoryListFilter.ts:76-86`) and `buildOrderBy` calls `sortField?.trim()`
(`:27`). Repeated query keys are parsed as arrays.

**Reproduced.**

```text
buildListConditions("demo", { gender: ["male","female"] }, [], undefined)
  → TypeError: query.gender?.trim is not a function
buildOrderBy(["name"], "asc")
  → TypeError: sortField?.trim is not a function
```

**Impact.** `GET /api/contacts?gender=a&gender=b` (or `?sortField[]=x`) returns 500 instead of 400,
logs an application error, and is trivially reachable by any reader.

**Fix.** Use `contactsListQuerySchema` (or `.extend` it from `baseListQuerySchema` inside the
contract) so malformed filters are rejected at the boundary; add a 400 test.

**Owner.** `mms-api-interface` · `mms-backend-api`.

### C-07 — P3 — Restoring an active contact audits a restore that did not happen

**Evidence.** `restoreContactById` returns the existing active contact unchanged
(`apps/backend/src/contacts/use-cases/contactRestoreUseCases.ts:37`), and the generic route treats
any non-null result as success and runs `onAfterRestore`
(`apps/backend/src/lib/crudSingleDeleteRestoreRoutes.ts:117-124`). Contacts wires that hook to
`auditContact(user, "contact.restore", "Restored contact …")`
(`apps/backend/src/routes/tenant/contacts/contactSoftDeleteRoutes.ts:23-26`).

**Impact.** An idempotent re-POST writes a false restore row into the audit chain and returns 200
with a `restored`-looking payload.

**Fix.** Return a `{ contact, restored: boolean }` (or null for already-active) and audit only when
a transition occurred.

**Owner.** `mms-soft-delete` · `mms-audit-trail`.

### C-08 — P3 — Bulk restore counts duplicated ids

**Evidence.** `bulkRestoreContacts` iterates `ids` as received
(`apps/backend/src/contacts/use-cases/contactRestoreUseCases.ts:129-170`) and increments
`succeeded`/`failed` per entry; `bulkIdsBodySchema` enforces 1–500 entries but does not dedupe
(`packages/shared/src/schemas/api.dto.ts:16-24`). The soft-delete path dedupes via
`dedupeTrimmedIds` (`contactSoftDeleteUseCases.ts:36`).

**Impact.** `POST /api/contacts/bulk-restore` with `["c1","c1"]` reports `succeeded: 2` for one
contact; `succeeded + failed` no longer equals distinct rows. Client progress/toasts misreport.

**Fix.** `dedupeTrimmedIds(ids)` at the top of `bulkRestoreContacts` (and use the deduped length for
`failed`).

**Owner.** `mms-soft-delete`.

### C-09 — P3 — Client-authored content in export/setup audit rows

**Evidence.** `POST /api/contacts/export-audit` persists `data.count` and `data.scope` verbatim
(`apps/backend/src/lib/registerModuleCsvExportRoutes.ts:101-125`);
`POST /api/contacts/setup-audit` persists `data.summary` verbatim
(`apps/backend/src/lib/registerModuleSetupAuditRoute.ts:30-60`). Both endpoints already write a
server-originated audit row for the real queue/config save, so these are duplicate,
client-controlled rows.

**Impact.** The audit trail can contain “Exported 1 contact(s)” for a 50k-row export, or an
arbitrary setup summary. Compliance readers cannot distinguish it from the server-authored row.

**Fix.** Derive count/scope from the queued job/artifact (or drop the client audit endpoints now
that the queue path is audited); for setup, log a server-side config diff rather than free text.

**Owner.** `mms-audit-trail` · `mms-reports-export`.

### C-10 — P3 — Sanitizer fails open when the field-config row is absent

**Evidence.** `sanitizeForUser` returns contacts unchanged when `loadContactFieldConfig()` returns
null (`apps/backend/src/routes/tenant/contacts/contactRouteHelpers.ts:111-121`), and the loader
returns null when the row is missing (`apps/backend/src/lib/createModuleFieldConfigService.ts:30-35`).
The CSV export path deliberately falls back to the seed snapshot instead
(`contactExportUseCases.ts:93-96`).

**Impact.** A missing/unreadable config row silently disables all field/tab visibility filtering for
list/get/resolve/duplicates, while export still filters. Seed defaults have empty permissions, so
the practical leak depends on prior restrictions.

**Fix.** Fall back to `resolveContactFieldConfigSnapshot(null)` in `sanitizeForUser`/`sanitizeOneForUser`
and share that snapshot logic with export.

**Owner.** `mms-fields-registry` · `mms-backend-api`.

### C-11 — P3 — Google Contacts OAuth lacks PKCE and server-side state validation

**Evidence.** The connect flow stores a nonce in `sessionStorage`
(`apps/frontend/src/lib/contacts/googleContactsOAuth.ts:35-86`) and sends no `code_challenge`. The
exchange endpoint validates the code and redirect URI but not `state` or a verifier
(`apps/backend/src/contacts/use-cases/contactGoogleSyncOAuth.ts:64-99`,
`apps/backend/src/routes/tenant/contacts/googleSyncRoutes.ts:76-99`).

**Impact.** Account-binding/login-CSRF protection rests entirely on the browser nonce; a direct API
caller can exchange any valid code for their own account, and an intercepted code is replayable
until Google's single-use rule rejects it. No cross-user binding was found.

**Fix.** Add PKCE (`code_verifier`/`code_challenge`) and bind the OAuth `state` to the server-side
attempt; validate it at exchange.

**Owner.** `mms-backend-security` · `mms-backend-api`.

## 5. Remediation backlog

| Order | ID | Action | Effort | Pin with |
| --- | --- | --- | --- | --- |
| 1 | C-01 | Conditional update on `updated_at` inside the existing transaction | M | Two-connection 409 test |
| 2 | C-02 | Add `subjectId` to delete/restore modern-audit calls (contacts + students) | S | Ciphertext/subject-id audit test |
| 3 | C-03 | Dedicated tag UPDATE; no full child rewrite (or lock + rehydrate) | M | Concurrent child-edit test |
| 4 | C-04 | Strip hidden scalar fields for non-collection tabs | S | Sanitizer spec for `cnic` |
| 5 | C-05 | Thread `viewerRole` into VCF job and sanitize before `toVCard` | S | Restricted-field VCF test |
| 6 | C-06 | Validate list query with the domain schema | S | 400-on-array test |
| 7 | C-07 | Audit restore only on an actual transition | S | Idempotent-restore audit test |
| 8 | C-08 | Dedupe bulk-restore ids | XS | Duplicate-id test |
| 9 | C-09 | Server-derive export counts; diff-based setup audit | M | Audit content test |
| 10 | C-10 | Seed-snapshot fallback in the request sanitizer | XS | Missing-config spec |
| 11 | C-11 | PKCE + server-side state binding | M | OAuth state-mismatch test |

C-01 and C-02 should land before the next contacts release; C-03 follows in the same window. The
remainder can be scheduled. No P0s were found, so no hotfix is implied.

## 6. Residual risk and what this review could not prove

- **No DB execution.** Concurrency findings (C-01, C-03) are proved from SQL/transaction semantics,
  not a reproduced race. A two-connection test is part of the fix.
- **No browser/e2e run.** The contacts a11y and import/export specs exist but were not executed; UI
  focus-return, RTL overflow and axe status are unverified in this pass.
- **Coverage not measured.** The review did not compute contacts-module coverage; the 418 FE / 276
  BE passing specs do not by themselves prove the negative paths above.
- **`permissions` is API-only today.** C-04/C-05 depend on a non-empty `permissions` array in field
  config; the tenant UI does not expose that editor, so the defects are latent until it does. The
  sanitizer is still the documented enforcement point and should be complete.
- **Not audited deeply.** Messaging send paths that consume contacts, file/avatar upload handling,
  and the full duplicate-scan algorithm were checked only for tenant scoping and obvious N+1s.

## 7. Checked and found sound

- Route-level RBAC: read/write/delete gates on every contacts handler, `includeDeleted` gated on
  delete, self-service profile writes restricted to `OWN_CONTACT_PATCH_KEYS` and denied on
  non-writers editing others (`contactCrudRoutes.ts:160-215`).
- Tenant scoping: every contacts repository query carries `workspace_subdomain`; merge reparenting
  is tenant-scoped (`contactRepositoryDuplicateReparent.ts`); import restore is gated on the
  enqueuing user's delete permission (`contactImportJobUseCases.ts:43-46`).
- Module access: `authenticateTenant` + `registerModuleAccess("contacts")` on the route root; the
  coverage test is green.
- Server-owned fields: audit/soft-delete/retired fields are stripped before persistence
  (`contactValidationUseCases.ts:104-125`), and `updatedAt`/`createdBy` are stamped server-side.
- Restore uniqueness: pre-check + 23505 mapping + advisory locks on unique values
  (`contactRestoreUseCases.ts:39-86`, `contactUniqueValidation.ts:96-139`).
- Lookup and widget SQL: field/identifier access is whitelisted (`scalarFieldSql`,
  `resolveColumn`); no wildcard projections in the contacts repositories.
- Google tokens are encrypted at rest (`contactGoogleSyncRepository.ts:67-69`), and the redirect
  URI is origin-allowlisted.
- i18n parity is complete (9,476 keys, 0 missing across ar/ur/fa).
