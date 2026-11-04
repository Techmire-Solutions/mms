# Backend Module Review — Round 2 (Independent Verification)

Independent backend review of **Dashboard, Contacts, Students, Faculty, Tasks** at the current
working tree (`30abb1b41` plus the uncommitted tasks/dashboard changes already present). This
pass treats the existing 83-line `docs/backend-module-review-2026-11-04.md` as a **claim set to
test**, not as evidence. No product, schema, migration, API, or test change was made.

| | |
| --- | --- |
| Runtime | Node 24, Fastify 5, PostgreSQL 16, Drizzle, Redis/BullMQ |
| Method | Route → gate → handler → use case → repository → SQL; schema/migrations; tests; DB/ratchet gates |
| Unit suite | **390 files / 2,650 tests passed** (`pnpm --filter mms-backend test`) |
| DB suite | **59 files / 235 passed, 1 skipped** (`pnpm --filter mms-backend test:db`) |
| RLS suite | **Not run**: `test:rls` refused to run as `postgres` (superuser/BYPASSRLS); 5 tests skipped |
| Static gates | typecheck, DB projections (0), backend boundaries (0), structure, faculty domain, code norms, migration hygiene/indexes — all pass |
| Corpus | Five module reviews + central control-plane audit; no browser/AI UI work |

## 1. Verdict

**Not production-grade. Three Critical findings, 28 Major findings.** The earlier review's
"No Critical findings / all 5 modules are in production-grade health" claim is **false**.

Tenant isolation itself is generally strong: composite tenant keys, tenant predicates on the
reviewed paths, `ENABLE`/`FORCE ROW LEVEL SECURITY` policies, no `SELECT *`, and no proven
cross-tenant read/write path. The Criticals are authorization and lifecycle failures, not
cross-tenant leaks:

1. The dashboard write gate accepts a **read-only settings permission**, so the system
   `auditor` (and `principal`) can rewrite workspace dashboard preferences and hard-delete
   pinned widgets.
2. The faculty **session guard cannot see soft-deleted faculty rows** under FORCE RLS, so a
   linked teacher whose faculty profile was archived can keep module access when the primary
   session revocation is skipped or fails.
3. The faculty **restore/trash lifecycle is unreachable** under the same RLS policy: archived
   faculty, designations and departments return 404/empty, and re-registration creates a new
   profile instead of restoring the old one.

| Module | Verdict | Critical | Major | Summary |
| --- | --- | --- | --- | --- |
| Dashboard | **At risk** | 1 | 4 | Auditor write/delete; stale-role writes; summary fan-in/timeout |
| Contacts | **Needs work** | 0 | 8 | Default PII exposure; stale-role gate; merge/unique/OCC gaps |
| Students | **Needs work** | 0 | 4 | Import retry duplicates; enrollment gate bypass; export allowlist |
| Faculty | **Not ready** | 2 | 5 | Dead session guard; restore/trash unreachable; hierarchy stubs |
| Tasks | **Needs work** | 0 | 5 | No notification delivery; ownership/capability gaps; export/import scope |
| Cross-cutting | **Unproven** | 0 | 2 | RLS runtime proof absent; audit/outbox seams |

## 2. Claims audit of the existing review

| # | Existing claim | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | "No Critical findings" | **False** | Three Criticals in §3 (C1–C3) |
| 2 | "All 5 modules are in production-grade health" | **False** | Faculty archive lifecycle, dashboard auth, contacts PII, tasks notifications |
| 3 | "RLS is strictly enforced fail-closed" | **Unproven** | Policies exist; `test:rls` cannot run under `postgres`; DB suites use the bypass role |
| 4 | "Zero wildcard projections" | **Supported** | `check:db-projections` reports 0 |
| 5 | "Primary keys are composite `(workspace_subdomain, id)`" | **Supported for module tables** | Schema and migrations; join tables use composite pairs |
| 6 | "Soft-delete sextuple … systematically applied" | **Partial / False for faculty** | Faculty reads never opt into `app.include_deleted`; restore/trash/session guard fail |
| 7 | "126 test files / 900 tests pass at 100%" | **Scoped, not full evidence** | Full backend is 390/2,650 green; DB 59/235; the cited suite counts are filtered and do not cover RLS |
| 8 | "Dashboard summary respects caller module access" | **Partial** | Response is filtered; all 10 aggregates (incl. tasks) are computed for every caller and a failure 500s every section |
| 9 | "Contacts sanitizeForUser redacts CNIC/notes unless `contacts.view_sensitive`" | **False** | No such permission exists; seeded fields have `permissions: []` |
| 10 | "Faculty hierarchy uses recursive SQL CTE + advisory locks" | **False** | Assignment hierarchy functions return `[]`; reporting validator is test-only; advisory lock covers appointments only |
| 11 | "Tasks hierarchical delegation evaluates positions" | **Supported (delegation only)** | `taskRecipientRepository` now consumes `delegationScope`; ownership and notification delivery remain open |
| 12 | "Tasks persists `task_comments`" | **False** | No `task_comments` table, schema, route, or DTO exists |
| 13 | "Students persist through `student_setup_configs`; statuses include expelled/withdrawn" | **False** | Actual tables are `student_field_configs`, `student_module_preferences`, `student_lookups`; DB check allows active/inactive/suspended/graduated/transferred only |
| 14 | "Tasks ports/adapters are the real boundary" | **Partial** | Use cases are a value-less pass-through; `mutateTask` imports the singleton and cannot be injected |
| 15 | "Dashboard caching + 10s statement timeout" | **Partial** | 30s cache exists; nested `withTenantRead` resets the timeout budget to the global default |

## 3. Critical findings

### C1 — Dashboard: a read-only role can rewrite preferences and hard-delete widgets

`apps/backend/src/routes/tenant/dashboard.ts:38-43`:

```ts
function canWriteDashboard(user: User): boolean {
  return (
    userHasPermission(user, DASHBOARD_MODULE_MANIFEST.permissions.setupWrite) ||
    userHasPermission(user, DASHBOARD_MODULE_MANIFEST.permissions.customize)
  );
}
```

`DASHBOARD_MODULE_MANIFEST.permissions.customize` is `configuration.view`
(`packages/shared/src/dashboard/dashboardModuleManifest.ts:21`), and
`configuration.view` maps to **settings read** (`packages/shared/src/auth/permissionRules.ts:104`).
The system `auditor` role is defined as `createReadOnlyPermissionMap(ALL_RBAC_MODULE_IDS)`
(`packages/shared/src/auth/userRbacDefaultRoles.ts:163-168`), i.e. settings read; `principal`
also holds `settings: ["read"]`.

The route layer does not compensate: every `/api/dashboard/` route is stamped
`action: "availability"` (`apps/backend/src/lib/moduleRouteActions.ts:105-110`), and
`evaluateModuleAccess` returns `allowed: true` before checking any permission for that action
(`packages/shared/src/settings/moduleAccessPolicy.ts:181`). The mutating handlers call
`canWriteDashboard` only.

**Impact.** An auditor/principal can:

- `PUT /api/dashboard/preferences` — rewrite the workspace dashboard for every user;
- `PUT /api/dashboard/widgets` — replace pinned widgets;
- `PUT /api/dashboard/widgets/reorder`;
- `DELETE /api/dashboard/widgets/:id` — a **hard delete** (the table has no `deleted_at` and no
  trash/restore path).

This is a write capability granted by a read permission, on a workspace-global surface.

**Why CI missed it.** The dashboard integration test only contrasts teacher (denied) with admin
(allowed) (`dashboardSetup.integration.test.ts:100-135`); `moduleAccessCoverage.test.ts` has no
`/api/dashboard/*` expected-action entries, so the `availability` downgrade is unpinned.

**Fix.** Remove `customize` from the write gate or remap it to a write permission; add a
dedicated `dashboard.customize` whose required actions are `create/update`; resolve the
**current tenant role** (not the JWT role) before authorizing; or make the module gate enforce
`setupWrite` on the three mutating routes. Pin auditor/principal → 403 while reads stay 200.

### C2 — Faculty: the soft-delete session guard can never return true

`apps/backend/src/db/repositories/facultyRepository.ts:77-87`:

```ts
return withTenantRead(subdomain, async (tx) => {
  const rows = await tx
    .select({ deletedAt: faculty.deletedAt })
    .from(faculty)
    .where(and(eq(faculty.workspaceSubdomain, subdomain), eq(faculty.userId, userId)))
    .limit(1);
  return Boolean(rows[0]?.deletedAt);
});
```

The `faculty` table carries the `tenant_soft_delete_isolation` policy created for `teachers` in
`0108_soft_delete_schema_rls_and_triggers.sql:346-358` and retained through the rename in
`0112_rename_teachers_to_faculty.sql:6`:

```sql
USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR (
    workspace_subdomain = current_setting('app.current_tenant', true)
    AND (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'true')
  )
)
```

No faculty repository calls `enableIncludeDeleted`/`withIncludeDeletedScope`. The probe
therefore sees no row for an archived faculty and returns `false`. `authenticateTenant` calls
this probe on every authenticated request (`middleware/authenticate.ts:168-176`).

**Impact.** The C2 session guard is dead. A linked teacher whose faculty profile is archived
keeps module access whenever the primary revocation in `facultySoftDeleteSessions` is skipped
or fails — and that failure is caught and only logged. This is a security regression: the
account-level fallback no longer exists.

**Fix.** Opt into `app.include_deleted` inside the probe transaction, and add the same opt-in to
every faculty tombstone query. Prove it under a `NOSUPERUSER NOBYPASSRLS` role: archive a linked
faculty, assert the probe is `true`, and assert the user's next request is 401.

### C3 — Faculty: restore, trash, and implicit restore are unreachable under RLS

`apps/backend/src/faculty/use-cases/facultyRestoreUseCases.ts:21-27`:

```ts
const existing = await repo.findById(tenant, id);
if (!existing) return null;
if (!existing.deletedAt) return existing;
```

`findFacultyById` (`facultyRepository.ts:56-68`) selects with no `app.include_deleted`; the
archived row is filtered by the RLS policy above. Consequences:

- `POST /api/faculty/:id/restore` always returns **404** for an archived record.
- `POST /api/faculty/bulk-restore` returns `{succeeded: 0, failed: N}` with 200.
- `GET /api/faculty?includeDeleted=true`, the trash list, and trash CSV export are empty.
- Designation/department catalog restore and trash reads have the same gap.
- `createFaculty`'s implicit restore branch (`findSoftDeletedFacultyByContactIdSql`) is also
  invisible, so re-registering the same person creates a **new** profile instead of reviving the
  archived one.

**Impact.** The faculty archive lifecycle is effectively one-way in production; operators cannot
restore archived staff or catalogs, and re-registration forks identity/history.

**Why CI missed it.** All faculty DB tests connect as the owning/postgres role, where RLS is
bypassed. `withFacultyRls` exists in `facultyHierarchyFixtures.ts:99` and is never used; restore
and session-guard tests mock the repository (`facultySoftDelete.integration.test.ts`,
`facultySessionGuard.test.ts`).

**Fix.** `enableIncludeDeleted(tx)` inside restore/bulk restore and every `includeDeleted` read
path (faculty, designations, departments, soft-deleted-by-contact lookup), with cascade restore
of assignments/employments/employ-designations. Add a real DB test under `mms_app`.

## 4. Major findings

### 4.1 Dashboard

| ID | Finding | Evidence / impact |
| --- | --- | --- |
| D-M1 | **Write gate trusts the JWT role while the module gate uses the DB role** | `dashboard.ts:74-75` calls `canWriteDashboard(user)`, which uses `user.role`; the same request's module gate resolves `resolveCurrentTenantRole` (`requireTenantModule.ts:68-70`). A demoted admin keeps dashboard write/delete for the access-token TTL. Pin the live role. |
| D-M2 | **One failing section 500s the whole summary; the new tasks metric is inside it** | `dashboardSummaryService.ts:69-99` awaits ten aggregates in one transaction; `getSummary` returns 500 on any rejection (`dashboard.ts:273-278`). The new tasks aggregate (`:83`) is a full-table count plus 11 FILTERs. Isolate sections (`allSettled`) or degrade. |
| D-M3 | **Nested `withTenantRead` resets the statement-timeout budget** | `getTaskMetrics` joins the outer transaction via `withTenantRead` (`tasksMetricsRepository.ts:23`); `tenant-context.ts:88-90` re-applies guards with `undefined`, and the restore in `finally` does not restore `statement_timeout`. The documented 10s budget does not cover the tasks query; `handleDashboardRead`'s 5s budget is also neutralized. |
| D-M4 | **Workspace-global preferences** | `dashboardPreferences` primary key is `workspace_subdomain` only (`db/schema/dashboard.ts:16-31`); personal dashboard customization remains a product decision (prior D1). |

### 4.2 Contacts

| ID | Finding | Evidence / impact |
| --- | --- | --- |
| CT-M1 | **Sensitive fields are exposed to every `contacts.read` holder** | No `contacts.view_sensitive` permission exists; `canViewContactField` treats empty `permissions` as visible (`contactFieldAccess.ts:4-6`), and the seeded CNIC/notes/bank fields use `permissions: []` (`contactFieldSeedIdentity.ts:93-100`). List/detail/picker/duplicate/merge/export all inherit this. |
| CT-M2 | **Demoted users keep contact writes and picker enumeration** | `PUT/PATCH /api/contacts/:id` and `GET /api/contacts/picker` are stamped `availability` (`moduleRouteActions.ts:117-130`); their handlers check `canWriteContacts(user)`/`canUseContactPicker(user)` against the token role (`contactCrudRoutes.ts:164-171`). A demotion is not applied until re-auth. |
| CT-M3 | **Delete-only custom roles get 403 on archive/restore** | Contacts has no DELETE/restore route rule, so the method default is `write` (`moduleRouteActions.ts:207`); the handler re-checks `contacts.delete`. A role with `contacts.delete` but not `contacts.write` can never archive/restore (fails closed, but breaks the contract). |
| CT-M4 | **Merge rejects tenant custom fields at the Fastify boundary** | The route validates `schema: { body: buildContactMergeBodySchema() }` with no extra keys (`contactAuditExportRoutes.ts:121-128`); the tenant-aware re-parse is dead code. A merge preview carrying an enabled custom field returns 400. |
| CT-M5 | **Custom Setup `unique` fields compare against `contacts.name`** | `contactRepositoryLookupSql.ts:39-41` falls back to `lower(trim(contacts.name))` for unknown keys; a unique custom field (e.g. passport) is silently unenforced. |
| CT-M6 | **Merge loses the loser's notes and has no in-transaction audit** | `mergeContacts` excludes `notes` from the merge (`contactMergeUtils.ts:17-35`) and concatenates nothing; the route audits after commit (`contactAuditExportRoutes.ts:149-154`), through a helper that swallows failures. Merge archives a live row and re-parents students/faculty/users; a crash leaves it unaudited. Delete/restore also double-audit (in-tx + post-commit). |
| CT-M7 | **Write responses return the pre-write `updatedAt`** | `contactWriteUseCases.ts:251-259` builds the response from the pre-write record; the DB writes a new `updatedAt` (`repositoryMappers.ts:94-95`). The OCC token handed to the client is already stale, so an immediate second save 409s. |
| CT-M8 | **Duplicate-check/scan hydrate unbounded candidate sets** | `contactRepositoryDuplicateFind.ts:98` selects every matching id with no limit; `contactDuplicateScanUseCases.ts:87-96` hydrates all and runs O(n²) pairing. `POST /duplicate-check` is per-keystroke; read-only users can enqueue the tenant-wide scan. |

### 4.3 Students

| ID | Finding | Evidence / impact |
| --- | --- | --- |
| ST-M1 | **CSV import is not retry-safe** | `studentImportUseCases.ts:37-127` reuses a contact by phone/email but creates a new person when no phone/email exists; BullMQ retries the whole payload (`attempts: 3`), and already-created rows fail the active-contact unique index or duplicate with fresh UUIDs/GRs. No job/row idempotency key. |
| ST-M2 | **Status changes withdraw enrollments without the enrollments gate** | `bulk-status` and `PUT /:id` require only `students.write`; `bulkUpdateStudentStatus` calls `withdrawEnrollmentsEndedByStatus` (`studentOperationUseCases.ts:148`), which cancels enrollments, releases seats, offers waitlists and settles invoices. The sibling `bulk-enroll` route correctly requires `enrollments.write` + module access (`studentOperationRoutes.ts:79-88`). |
| ST-M3 | **Import bypasses the tenant write blueprint and allowlist** | `buildImportPayload` spreads the `.passthrough()` row and calls `createStudent` directly (`studentImportUseCases.ts:65,127`), skipping `validateStudentWrite` and required-tab/type checks. Unknown CSV columns flow into `custom_fields`. |
| ST-M4 | **Export columns are client-controlled** | `studentsExportService.ts:39-52` accepts arbitrary `columns` ids; `filterExportColumnsByVisibility` keeps any column without a Setup row (`filterExportColumns.ts:134`), and the cell extractor falls back to raw record properties (`customFields`, `restoredBy`, `deletionReason`). A reader can export hidden/custom values. |

### 4.4 Faculty

| ID | Finding | Evidence / impact |
| --- | --- | --- |
| FA-M1 | **Assignment hierarchy endpoints are stubs** | `facultyAssignmentHierarchyRepository.ts:6-38` returns `[]`; routes return 200 with `{tree: []}`/`{chain: []}` after a 404 existence check (`facultyAssignmentHierarchyRouteHandlers.ts:35-36,71-72`). Clients render an empty org chart as fact. |
| FA-M2 | **Reporting-hierarchy writes are stripped, so cycle prevention is test-only** | `faculty.dto.ts:253-271` deletes `reportingFacultyId`/`hierarchyRank`/`subordinateCount`; `validateReportingHierarchy` is imported only by its test, and its CTE walks designation parents, not reporting edges. |
| FA-M3 | **Closed appointments never become inactive and hierarchy reads ignore dates** | `closeAssignment` sets only `end_date` (`facultyAssignmentWriteRepository.ts:58`); `findSubordinates`/`findDirectSupervisorsBatch`/`countSubordinatesBatch` filter `status='active'` but not the date window, so closed appointments keep granting relationships and inflating counts. |
| FA-M4 | **Two “current appointment” SSOTs are not reconciled** | Directory/Work reads use `faculty_employ_designations` (`facultyPrimaryAppointmentSql.ts:19`); supervisor/count/delete reads use `faculty_assignments`. Assignment writes never update the employ-designation tenure; `syncPrimaryAppointment` is skipped when `departmentId` is null. |
| FA-M5 | **`reassignSubordinatesTo` returns 200 and changes nothing** | `facultyRepositorySubordinateCounts.ts:71-80` returns `0`; the delete guard calls it without checking the count, so deleting a supervisor with this parameter silently orphans subordinates. Without the parameter the same delete is a hard 409. |

### 4.5 Tasks

| ID | Finding | Evidence / impact |
| --- | --- | --- |
| TK-M1 | **Assignment/status notifications are emitted and never delivered** | `taskNotificationService.ts:39-60` writes `task.assigned`/`task.status_changed` outbox rows; the only consumer (`worker/processors/outboxCdcProcessor.ts:113-116`) handles soft-delete/restore and falls through for everything else. Setup exposes notification toggles that are silent no-ops. |
| TK-M2 | **Any `tasks.write` holder can mutate/archive any task; `assignees: []` bypasses delegation** | `tasksRoutes.ts:132-136` gates PATCH on `tasks.write` only; `taskDelegationService.ts:51` returns valid for an empty assignee array, and `updateTask` then soft-deletes every assignee. No creator/assignee/ownership predicate exists. |
| TK-M3 | **`tasks.assign`/`tasks.complete` are not separable capabilities** | `tasks.write` requires `["create","update"]` and is matched with `.some` (`permissionRules.ts:84`, `permissions.ts:96`); a role with only `tasks:["update"]` passes it, and `tasks.complete` can set any status (cancelled/blocked/reopen), not just completion. |
| TK-M4 | **CSV export ignores selected ids and filters** | `tasksExportService.ts:67-75` never reads `includeIds`, `statuses`, `priorities`, `dueOn`; hard-codes `overdue: false`. Exporting three selected tasks returns the whole workspace; the “Notes/Comments” column is always empty. |
| TK-M5 | **A retried import re-creates already-imported tasks** | `taskImportUseCases.ts:127` creates one task per row with no row key/checkpoint; BullMQ retries (`attempts: 3`) re-run from row 1, duplicating rows committed before the failure. |

### 4.6 Cross-cutting

| ID | Finding | Evidence / impact |
| --- | --- | --- |
| X-M1 | **RLS is not proven by CI** | `test:rls` fails under the local `postgres` role; `test:db` runs as the owning role with RLS bypass. Faculty's two Criticals and the contacts cross-tenant test gap are invisible. The existing review's “strictly enforced” claim is unsupported. |
| X-M2 | **Audit/outbox atomicity is inconsistent** | Merge and dashboard audits are post-commit with swallowed failures; task notifications open their own transaction after the mutation commits, so an outbox failure returns 500 for a committed write and a retry can duplicate. |

## 5. Minor findings

| Module | Finding | Path |
| --- | --- | --- |
| Dashboard | No OCC/409 on preferences/widgets (workspace singleton) | `dashboard.contract.ts:43-76` |
| Dashboard | Reorder has no array cap/int4 bound and reports success for unknown ids | `dashboard.contract.ts:94-101`; `dashboardWidgetsRepository.ts:175-187` |
| Dashboard | Widget list caps at 200 while PUT accepts 500 | `dashboardWidgetsRepository.ts:84`; `dashboardWidgetSchema.ts:247` |
| Dashboard | Four write handlers swallow errors with no log | `dashboard.ts:136,176,220,250` |
| Dashboard | `tasksCommandMetricsSnapshotSchema` is never parsed | `tasksModuleManifest.ts:184`; `dashboard.contract.ts:122` |
| Contacts | Queued import uses enqueue-time `viewerRole` for field stripping | `contactImportJobUseCases.ts:84` |
| Contacts | Picker exposes name/phone/email/city tenant-wide to students/faculty readers | `rbacCanModuleHelpers.ts:71` |
| Contacts | `bulkSaveContacts` writes soft-delete columns from payload | `contactRepositoryBulkSave.ts:59` |
| Contacts | Restore/bulk contracts omit 400/403/409 | `contactsCrud.contract.ts:116-140` |
| Contacts | Idempotent enqueue returns a terminal job | `contactRouteHelpers.ts:79` |
| Students | Bulk-enroll audit is post-commit; GR backfill is unaudited | `studentOperationRoutes.ts:99`; `studentOperationUseCases.ts:216-231` |
| Students | `status` is unvalidated/un-normalized (DB 23514 → 500; `"Active"` invisible) | `students.dto.ts:31`; `studentRepositoryPersist.ts:88` |
| Students | Bulk delete audits rows the UPDATE did not change | `studentSoftDeleteUseCases.ts:64` |
| Students | Widget aggregates expose raw values of hidden fields | `studentRepositoryWidgetsAggregate.ts:83` |
| Students | `skipCount=true` returns `total: 0` | `studentRepositoryListPage.ts:49` |
| Students | `_blueprintId` persists into `custom_fields` | `studentRepositoryPersist.ts:59` |
| Students | Import row numbers drift after validation failures | `studentImportUseCases.ts:105` |
| Faculty | Past `designationEndDate` makes the whole save 400 | `facultyWriteHelpers.ts:67` |
| Faculty | Assignment writes reconcile contacts after commit, no outbox | `facultyAssignmentRouteHandlers.ts:135` |
| Faculty | Catalog handlers turn infrastructure failures into 400 without logging | `facultyDesignationRouteHandlers.ts:151` |
| Faculty | Assignment DELETE maps every error to 500 | `facultyAssignmentRouteHandlers.ts:232` |
| Faculty | Inactive primary with open end date blocks future primaries | `facultyAssignmentValidation.ts:46` |
| Faculty | Widget grouping over `reportingFacultyId` fabricates “Unknown” | `facultyRepositoryWidgetFilters.ts:39` |
| Tasks | Notification emission after commit uses a pre-transaction diff | `taskMutationService.ts:26-53` |
| Tasks | `GET /api/tasks` uses `.parse()` → malformed filters are 500 | `tasksReadRoutes.ts:13` |
| Tasks | DELETE unknown/foreign id returns 200 `{success:false}` | `tasksSoftDeleteRoutes.ts:24` |
| Tasks | Legacy `/export-audit` is still registered and trusts a client count | `tasksExportRoutes.ts:19` |
| Tasks | Bulk restore skips a child whose parent is restored in the same request | `tasksBulkRepository.ts:118` |
| Tasks | Bulk status omits `updated_by` and uses a stale transition snapshot | `tasksBulkRepository.ts:209` |
| Tasks | Parent-cycle CTE rejects legitimate trees deeper than 21 | `tasksWriteRepository.ts:36` |
| Tasks | No `(ws, created_at)` index for the default directory/metrics scan | `tasksRepository.ts:125` |
| Tasks | Tenant normalization inconsistent in trash/metrics repositories | `tasksTrashRepository.ts:30` |
| Tasks | Restore audits/emits even when the UPDATE changed no row | `tasksTrashRepository.ts:79` |
| Tasks | Ports/use-cases layer is a pass-through; new tests assert identity only | `tasksUseCases.ts:11`; `tasksRepository.test.ts` |

## 6. Prior-open reconciliation

| Prior item | Status | Current-tree evidence |
| --- | --- | --- |
| Dashboard D1 per-user preferences | **Open** | Workspace singleton PK (`db/schema/dashboard.ts:16-31`) |
| Dashboard m1 analytics permission | **Partial/Open** | `/api/dashboard/*` action is `availability`; section filtering works, route read permission does not |
| Dashboard m2 date cache key | **Open** | Raw `date` in `redisKeys.dashboardSummary`; only format is bounded |
| Contacts R4-10 custom unique | **Open** | Custom key falls back to `contacts.name` |
| Contacts R4-12 stale OCC token | **Open** | Pre-write `updatedAt` returned |
| Contacts R4-16 duplicate scan | **Open** | Unbounded id scan/hydration; read-only trigger |
| Contacts merge audit (m-3) | **Partial** | In-tx merge audit absent; post-commit swallowed |
| Students M1 import idempotency | **Open** | No row/job idempotency |
| Students M2 bulk-enroll gate | **Fixed** | `studentOperationRoutes.ts:79-88` + inject test |
| Students M3 settings fail-closed | **Fixed** | `studentWriteValidation.ts:97-100` |
| Students M4 restore provenance | **Fixed** | `restoredIds`-driven audit/cascade |
| Faculty M1 reassign subordinates | **Open** | Returns 0 |
| Faculty M2 restore permission guard | **Unreachable** | Restore itself is dead under RLS |
| Faculty M4 workload producer | **Partial** | `subordinateCount` produced; `assignedClasses` has no producer |
| Faculty M5 reporting hierarchy | **Open** | Writes stripped; validator test-only |
| Tasks M1 delegation scope | **Fixed** | `delegationScope` consumed; DB test exists |
| Tasks M2 ownership policy | **Open** | Any writer mutates any task; empty assignees wipe |
| Tasks M3 capability separation | **Partial** | Actions still collapse into `.some` create/update |
| Tasks M4 notification delivery | **Open** | No consumer for task events |
| RLS runtime evidence | **Missing** | `test:rls` blocked by postgres role |

## 7. Verified-clean surfaces

- **Tenant isolation on the reviewed paths**: composite tenant keys, explicit
  `workspace_subdomain` predicates, composite FKs, and no proven cross-tenant read/write.
- **RLS policies exist** on contacts/students/faculty/tasks/dashboard, with `ENABLE` + `FORCE`
  and `app.current_tenant` / `app.include_deleted` semantics; the defect is that faculty reads
  never set the opt-in.
- **Module gates** are present on all five modules; students/faculty/tasks DELETE/restore actions
  are pinned; contacts/dashboard have the gaps above.
- **Contacts round-5 fixes hold**: archive loser before survivor save, `ConflictError`→409,
  cause-bearing database errors.
- **Students round-3 fixes hold**: bulk-enroll enrollment gate, settings fail-closed, restore
  provenance, `createdAt` stripping, export paging, GR sequencing in the caller transaction.
- **Faculty**: advisory lock + primary-overlap concurrency test, designation cycle CTE, linked-user
  role-sync actor check, `userId` strip, workspace-local day, delete/restore route actions.
- **Tasks**: hierarchical delegation now real, status transitions centralized, bulk paths
  set-based/bounded, soft-delete invariants, export/import runners registered, dashboard section
  filtering correct (response-level).
- **Dashboard**: composite PK/RLS, tenant-scoped widget statements, 404 on missing delete,
  DTO caps/unknown-key stripping, cache-then-filter does not leak sections.
- **Static gates**: 0 wildcard projections, 0 route→storage offenders, all structure/norm/
  migration ratchets pass.

## 8. Test gaps

1. **No tenant-role RLS run.** `test:rls` cannot run as `postgres`; no CI evidence for the
   faculty Criticals or contacts cross-tenant isolation.
2. **Faculty restore/session tests mock the repository**; `withFacultyRls` is defined but unused.
3. **Contacts has no `crossTenantIsolation` rows and no `EXPECTED_MODULE_ROUTE_ACTIONS` entries**,
   so the delete/restore gate bug and tenant isolation are unpinned.
4. **Tasks has no cross-tenant/RLS DB test**; the delegation proof is opt-in `test:db`, excluded
   from the default unit run.
5. **Dashboard tests mock `loadDashboardSummary`**; no auditor/principal write test and no
   dashboard action pins.
6. **Students import/export/withdrawal tests do not exercise** retry, blueprint enforcement,
   custom export columns, or the enrollment gate.
7. **New tasks ports tests are tautological** (function identity/forwarding), not behavioral.

## 9. Remediation plan

### P0 — before the next release

1. **Dashboard authorization**: remove `customize` from `canWriteDashboard` or add a write-scoped
   permission; enforce `setupWrite` at the route/gate; resolve the live tenant role. Add
   auditor/principal → 403 tests for all four mutating routes.
2. **Faculty RLS opt-in**: `enableIncludeDeleted` in the session probe, restore/bulk restore,
   `includeDeleted` list/detail, catalog trash/restore, and soft-deleted-by-contact lookup. Add
   real `mms_app` DB tests for archive → session 401 and archive → restore 200.
3. **Faculty cascade restore**: assignments, employments, employ-designations; ensure
   re-registration restores the original id.

### P1 — next patch

4. **Contacts**: add `contacts.view_sensitive` (or a declared sensitive set) and strip PII by
   default; make PUT/picker use the live tenant role; add DELETE/restore route actions; fix the
   merge body boundary; resolve custom unique fields or fail closed; add in-tx merge audit and
   notes preservation; return the persisted `updatedAt`; bound duplicate scans.
5. **Tasks**: deliver task notifications or remove the toggles; enforce ownership/assignee
   authorization and treat empty assignees as a removal requiring `assign_anywhere`; separate
   `assign`/`complete` capabilities; honour export ids/filters; make imports retry-safe.
6. **Students**: row-level import idempotency and resume; run the write blueprint for imports;
   require the enrollments gate for status-driven withdrawal; whitelist export columns; fix
   status validation/normalization.
7. **Faculty**: implement the hierarchy endpoints or return 501/remove them; re-enable reporting
   writes + reporting-edge cycle CTE, or delete the dead validator; make closed appointments
   temporal; reconcile the two appointment SSOTs; implement or reject `reassignSubordinatesTo`.
8. **Dashboard summary**: isolate sections and propagate/restore the statement timeout; clamp
   the cache `date` or split date-independent sections.

### P2 — follow-up

9. Merge/dashboard audit transactionality; OCC/409 for dashboard preferences/widgets; reorder and
   list caps; bulk status actor stamping; restore/delete audit guards; task depth/index fixes.
10. Add tenant-role RLS CI (provision `mms_app` in CI only), contacts/tasks cross-tenant DB tests,
    and dashboard action pins.

## 10. Limitations and hypotheses

- **Static + test evidence**, not a live production audit. Critical/Major paths were read and
  checked by a second pass; the dashboard/contacts stale-role findings and merge-custom-field 400
  are code-path-proven but not executed against a running tenant.
- **No runtime RLS proof**: the local database connects as `postgres`; `test:rls` refuses to run
  and the DB suite bypasses RLS. Tenant isolation findings are limited to static predicates,
  policies, and the passing `test:db` suites.
- **No production data, load test, queue fault injection, or browser/UI testing.**
- The uncommitted tasks/dashboard changes are reviewed as current-tree code; they are not
  attributed to this review.
- **Hypotheses not proven**: import retry frequency in production; export/widget exposure depends
  on tenant field permissions; faculty `leaveDetails` schema mismatch; concurrent faculty saves
  causing spurious 409; task OCC behaviour under non-UTC Node timezone; deep task trees in real
  tenants.
- The earlier review's 126-file/900-test count is a filtered scope, not the full backend; this
  pass uses 390/2,650 unit and 59/235 DB results.

## 11. Reproduction

```bash
pnpm --filter mms-backend typecheck
pnpm --filter mms-backend test
pnpm --filter mms-backend test:db
pnpm --filter mms-backend test:rls          # fails loudly under postgres/BYPASSRLS
pnpm check:db-projections
pnpm check:backend-boundaries
pnpm check:backend-structure
pnpm check:faculty-domain
pnpm check:code-norms
pnpm check:migration-hygiene
pnpm check:migration-indexes
```

RLS suite output at review time:

```text
Error: RLS suite must run as a NOSUPERUSER NOBYPASSRLS role; connected as postgres.
Test Files 1 failed (1) | Tests 5 skipped (5)
```
