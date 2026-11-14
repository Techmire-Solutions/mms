# MMS Tasks Module Review — 2026-11-04

First dedicated review of the Tasks domain at `main` HEAD `60245210a` (working tree clean at review time).

**Scope.** `packages/shared/src/tasks/tasksModuleManifest.ts`, `contracts/tasks.contract.ts`,
`obligations/tasksSecurity.test.ts`; `apps/backend/src/routes/tenant/tasks{Routes,ExportRoutes,SoftDeleteRoutes}.ts`,
`apps/backend/src/tasks/**`, `services/task*.ts`, `db/repositories/task*.ts` + `taskRecipientRepository.ts`,
`db/schema/tasksTables.ts` + `taskSettingsTables.ts`, migrations `0134`–`0137`/`0161`;
`apps/frontend/src/tenant/features/tasks/**`, `tenant/hooks/collections/tasks.ts`, `lib/routing/moduleRegistry.ts`;
`lib/moduleRouteActions.ts`, `settings/moduleAccessPolicy.ts` + `globalSettingsModuleRegistry.ts`,
`auth/{permissions,permissionRules,userRbacDefaultRoles}.ts`.

**Method.** Read-only static verification on the path production uses — route → module gate/permission check →
use case → repository → SQL/DDL → shared DTO. Findings cite `file:line` from the reviewed tree (`60245210a`) and
quote the offending code. Unprovable concerns are hypotheses (§10); absent coverage is a test gap (§6), never a
defect.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` (shared/backend/frontend) | Pass |
| `check:code-norms` / `work-directory` / `db-projections` / `frontend-structure` / `backend-boundaries` / `faculty-domain` | Pass |
| `moduleAccessCoverage.test.ts` / `routeAccess.test.ts` | 1 / 1 · 11 / 11 passed |
| Backend `task dashboard` / frontend `features/tasks features/dashboard` | 41 / 72 tests passed |

Audits were **static**: no `test:db`, `test:rls`, Playwright or axe run, so the RLS policies, composite FKs,
cycle CTE and assignee uniqueness in §7 were not exercised against real SQL, and the browser behaviours in
C2/M7 are asserted from the code path only.

## 2. Verdict

**Do not treat Tasks as a finished module.** The persistence layer is well built — composite tenant FKs on both
sides of the parent/assignee edges, `FORCE ROW LEVEL SECURITY` + `tenant_isolation_policy` + `forbid_hard_delete`
on all three tables, a real recursive-CTE cycle check, explicit projections, batched assignee hydration, strict
write DTOs that cannot forge `workspaceSubdomain`/`deletedAt`/`createdAt`. No students-module defect class
(mass-assignment, `SELECT *`, cross-tenant subquery, cache-before-commit) reproduces.

What is missing is a working delegation model: the advertised hierarchy collapses in the code, because the
delegation-scope setting is threaded into a query that never references it, the only real recipient gate is
admin-only, and two of four declared capabilities are logically unreachable. Both data-transfer surfaces are
wired end to end except for the job runner, so they fail after the UI claims success, and the directory hides
everything past row 50. Being a first review, most findings are structural gaps, not regressions.

## 3. Findings summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| C1 | **Critical** | Export / import | CSV export and import enqueue jobs with no registered runner — both fail after returning 202 |
| C2 | **Critical** | Directory | The Work directory only ever fetches the server-default 50 tasks; no pagination, all filters client-side |
| M1 | **Major** | Authorization | `delegationScope` is stored, rendered, then never used — the only real recipient gate is admin-only `tasks.assign_anywhere` |
| M2 | **Major** | Authorization | Any `tasks.write` holder mutates/archives any task, and `PATCH {assignees: []}` bypasses delegation to strip every assignee |
| M3 | **Major** | Module gate | No tasks rule in `MODULE_ROUTE_ACTION_RULES`: trash routes resolve to `write` (handlers need `delete`); `tasks.complete`/`tasks.assign` are implied by `tasks.write` — dead capabilities |
| M4 | **Major** | Notifications | `task.assigned`/`task.status_changed` outbox rows are written but no consumer reads `recipientUserIds`; assigning notifies nobody |
| M5 | **Major** | Frontend | The edit form always resubmits the full assignee array → a non-admin gets 403 on any edit of a task assigned to someone else |
| M6 | **Major** | Write correctness | No status-transition validation; the one-click badge cycles `completed → todo`, clearing `completedAt` |
| M7 | **Major** | Directory UX | Bulk selection survives filter/search changes → a bulk archive can hit rows no longer on screen |
| M8 | **Major** | Data layer | Bulk archive/restore are N+1 loops (≤500 × 4 round trips, one `NOTIFY` each, silent 500-id truncation); bulk status is N unbatched PATCHes |

## 4. Findings detail

### C1 — Critical — CSV export and import have no job runner
**Evidence.** `tasksExportRoutes.ts:19-37` registers both surfaces and `lib/registerModuleCsvExportRoutes.ts:99-112`
enqueues `enqueueCsvExportJob({ moduleId, … })` then returns `202 { job }` (import likewise,
`registerModuleCsvImportRoutes.ts:73-95`). Execution resolves a runner by key — `backgroundJobWorkerService.ts:57-58,116-118`:
```ts
const key = `${moduleId}:${kind}`;
const runner = runners.get(key);
    await runContext.fail(`No runner registered for ${key}`);
```
Runners exist for contacts, students, sessions, enrollments, users, messaging and three faculty modules
(`backgroundJobRunnerService.ts:83,128,149,171,190,209,229`; `backgroundJobFacultyRunners.ts:28,59,81`); nothing in
`backgroundJob*.ts` or `registerModuleCsv*.ts` mentions tasks.

**Path → consequence.** `TasksPage.tsx:51-57` → `useGenericModuleExport({ path: "/api/tasks/export/csv" })` → gate
`read` passes → `executeJob(… "tasks","export" …)` → `fail(...)`; import (`TasksCsvImportDialog.tsx:22`) behaves the
same. Both PageHeader controls are dead on arrival: "Exporting tasks…", a tray entry, then a failed job. The transfer
schemas are fully specified, so the defect is purely the missing runner registration.

**Fix.** Register both runners via `createModuleExportService`/`createModuleImportService`, or remove the controls and
schemas. Pin with a registry assertion that any module exposing transfer schemas has both runners.

### C2 — Critical — the directory only ever sees the first 50 tasks
**Evidence.** `TasksPage.tsx:59-61` calls `useTasks({ includeDeleted })` with no `limit`, and `useTasksApi.ts:47-60`
forwards paging only when supplied —
```ts
...(query?.limit ? { limit: query.limit } : {}),
...(query?.offset ? { offset: query.offset } : {}),
```
so the schema default applies (`tasksModuleManifest.ts:116-117`: `limit: … .default(50)`), honoured at
`tasksRepository.ts:77-83`. Every filter then runs in the browser over that one page (`useTasksWorkTabFilters.ts:18-58`);
no page/offset state exists under `features/tasks/**`.

**Path → consequence.** `GET /api/tasks` returns 50 rows + `total`; the page keeps `tasksData.tasks` and uses `total`
only as a metrics fallback (`TasksPage.tsx:145`), while the footer prints the rendered length. A tenant with 200 tasks
can see and act on 25% of them with nothing signalling truncation — search covers page 1 only, and the server
`search`/`assignedTo*`/`dueFrom`/`dueTo` parameters that would fix it (`tasksRepository.ts:28-68`) are never sent. Same
class as students C1.

**Fix.** Drive the list from server pagination (limit/offset or keyset) plus existing filters, footer from `total`, page
or "load more"; never render a directory where `total > tasks.length` without a truncation notice.

### M1 — Major — `delegationScope` is decorative
**Evidence.** Defined at `tasksModuleManifest.ts:22-23,125`, read at `tasksRoutes.ts:63-69`, then dropped — the sole
consumer (`taskRecipientRepository.ts:62-65`) uses only two of the three options:
```sql
WHERE (
  (o.user_id = ${actorUserId} AND ${options.allowSelfAssignment ?? true})
  OR (o.user_id <> ${actorUserId} AND ${options.canAssignAnywhere ?? false})
)
```
Elsewhere it is only a type field (`:6`), a pass-through (`tasksRoutes.ts:67`) and Setup UI (`TasksSetupTab.tsx:25,61-74`).

**Path → consequence.** `PUT /api/tasks/settings` persists it, Setup shows "All Descendants (Full Sub-tree)", and
`GET /api/tasks/eligible-assignees` returns the same list for either value. The setting is a lie, and what *is*
implemented is far narrower: `canAssignAnywhere` maps to `tasks.assign_anywhere`, granted by default only to
`admin`/`super_admin` (`userRbacDefaultRoles.ts:31,39`; `userRbacDefaults.test.ts:141-145` asserts `principal` lacks it),
so a principal can assign only to *themselves* — every other recipient is rejected by `taskDelegationService.ts:30-35`.
The persona the feature exists for cannot delegate.

**Fix.** Implement the scope over the actor's faculty reporting line (direct reports vs subtree, cycle-marked,
depth-bounded), keeping `canAssignAnywhere` as bypass; pin with a DB-integration test.

### M2 — Major — any writer mutates any task; empty assignees bypass delegation
**Evidence.** No ownership or relationship predicate exists on the write path. `tasksRoutes.ts:147-184` gates only on
`tasks.write`; `taskMutationService.ts:17-38` validates `assignees ?? []`, and the empty case short-circuits before any
lookup — `taskDelegationService.ts:51`:
```ts
if (!inputs.length) return { valid: true, resolvedAssignees: [] };
```
`tasksWriteRepository.ts:119-127` then applies it (`syncTaskAssignees(…, recipients, actorUserId)`), and
`tasksAssigneesRepository.ts:101-112` soft-deletes every active assignee.

**Path → consequence.** Principal (`tasks.write` + `tasks.assign` true, `assign_anywhere` false) sends
`PATCH /api/tasks/<admin-created-id> {"assignees": []}` → assign gate passes → delegation returns valid → all assignee
rows archived. The same route accepts `title`/`status`/`priority`/`dueAt`/`parentTaskId` for any task, and
`DELETE /api/tasks/:id` (`tasksSoftDeleteRoutes.ts:17-23`) archives any task. Task integrity is workspace-communal: a
line manager can silently unassign, reprioritise or archive the admin's tasks, and the audit diff does not name the
removed assignees (m4). `tasks.assign` is the only assignment authority and is implied by `tasks.write` (M3), so no
boundary remains beyond recipient eligibility.

**Fix.** Resolve the current assignee set inside the transaction and require `assign_anywhere` (or per-assignee
eligibility) before removal — an empty array must not be a free pass; constrain mutation to creator OR assignee OR
`assign_anywhere`, else `403`.

### M3 — Major — gate action ≠ handler requirement; two dead capabilities
**Evidence.** `lib/moduleRouteActions.ts:22-126` has no tasks entry, so `:141-149` applies the method default
(`mutating ? "write" : "read"`): the gate demands `tasks.write` (`moduleAccessPolicy.ts:120-127`) while handlers require
`tasks.delete` (`tasksSoftDeleteRoutes.ts:19,35,54,67`). `tasksRoutes.ts:186-193` accepts an alternative —
```ts
!(await canPerformTaskAction(request, "tasks.write")) &&
!(await canPerformTaskAction(request, "tasks.complete"))
```
— but the capabilities are inseparable (`permissionRules.ts:84-88`: write/assign → `["create","update"]`, complete →
`["update"]`), matched with `some` (`permissions.ts:96`), so any role with `update` holds all three.

**Consequence.** Same family as students `m1`, wider: the declared requirement is wrong for four routes, and the RBAC
matrix exposes `tasks.complete`/`tasks.assign` rows that grant nothing on their own. Admin masks it (`permissions.ts:128`).

**Fix.** Add tasks rows mirroring students (trash routes → `delete`; optionally status → `availability`), then either
remove `tasks.complete`/`tasks.assign` or give them their own module ids. Pin via `EXPECTED_MODULE_ROUTE_ACTIONS`.

### M4 — Major — assignment notifications reach nobody
**Evidence.** `taskNotificationService.ts:31-49` gates correctly and emits `emitOutboxEvent(tx, "task.assigned", {
… recipientUserIds: newAssigneeIds … })`. That field appears only in the emitter (`:44,57`) and the payload type
(`outboxEventService.ts:64`) — nothing reads it, and CDC dispatch falls through to the unknown branch
(`outboxCdcProcessor.ts:103-117`):
```ts
} else {
  // entity.hard_purge or unknown — just evict cache
  await redisDelPattern(cacheEvictPattern(row.workspaceSubdomain, row.entityType));
}
```

**Consequence.** `notifyOnAssignment`/`notifyOnStatusChange` (`TasksSetupTab.tsx:91-109`, translated in all four locales)
promise behaviour that does not exist; the module's core loop — assign work, tell the assignee — is silent, and
`taskNotificationService.ts:3-4` documents a consumer that was never written.

**Fix.** Wire a consumer turning `TaskNotifyPayload` into in-app notifications + `broadcastTenantUpdate`, or drop
`notifyOn*` from the DTO and UI. Pin with a delivery assertion, not an outbox-row assertion.

### M5 — Major — the edit form resubmits assignees, blocking non-admin edits
**Evidence.** `useTaskFormController.ts:127-140` always builds the array, seeded from the record (`:44-50`):
```ts
const assignees = selectedAssignees.map((a) => ({ facultyId: a.facultyId }));
const payload: TaskInsert = { title: trimmedTitle, …, assignees };
```
`tasksRoutes.ts:161-168` therefore demands `tasks.assign`, and `validateTaskDelegation` re-validates the whole list
against the actor's eligible set (`taskRecipientRepository.ts:62-65` → self only without `assign_anywhere`).

**Consequence.** A principal cannot rename, re-date or re-prioritise any task assigned to someone else unless they first
clear the assignees (M2's destructive path). With M1, the module is effectively admin-only in daily use.

**Fix.** Send `assignees` only when the picker changed (`isDirty` already compares at `:175-193`); an omitted array
already means "leave alone" (`tasksWriteRepository.ts:126`). Validate only added recipients.

### M6 — Major — no status transitions; the badge reopens completed tasks
**Evidence.** `tasksWriteRepository.ts:110-114` accepts any status and re-stamps lifecycle (`:12-17`);
`taskStatusUpdateSchema` (`tasksModuleManifest.ts:94-98`) checks enum membership only. The UI control cycles —
`tasksWorkBatchColumns.tsx:12-19`:
```ts
export const TASK_NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  …
  completed: "todo",
  cancelled: "todo",
};
```
rendered at `:68-73` and fired immediately by `handleCycleStatus` (`TasksListDesktopTable.tsx:66-69`).

**Consequence.** One tap writes `status: "todo"` and nulls `completedAt`, with no confirmation and no error surface (m12);
metrics, `completedAt` history and notification diffs become unreliable, and nothing prevents `cancelled → in_progress`
or `blocked → completed`.

**Fix.** Declare `TASK_STATUS_TRANSITIONS` in `@mms/shared`, enforce it in `updateTask` (400 on illegal edges), and
replace the cycling badge with a menu that confirms terminal states.

### M7 — Major — selection outlives the filtered view
**Evidence.** `TasksPage.tsx:43-44,174-185` owns selection via `useWorkSelection`; the only `clearSelection()` calls are
the trash toggle and the post-success callbacks in `TasksWorkTab.tsx:106,122,138`. Filters live in a sibling hook
(`useTasksWorkTabFilters.ts:11-16`) that cannot reach the selection, and bulk handlers bind the raw set
(`TasksWorkTab.tsx:101-115`: `const targets = [...selectedIds]; bulkDeleteMutation.mutate(targets, …)`).

**Consequence.** Select all 50 → search narrows to 2 → the bar still says "50 selected" → confirm → 48 invisible rows
archived (Undo recovers, but nobody intended it). Exactly students M3, which contacts solves with a `selectionScopeKey`
(`contacts/hooks/useContactsDirectoryFilters.ts:42-52`); C2 amplifies it.

**Fix.** Clear on any change to a `${filterKey}|${offset}` scope key, or intersect with visible ids at action time.

### M8 — Major — bulk paths are N+1 and unbatched
**Evidence.** `tasksTrashRepository.ts:175-210` (and `:109-160`) loop per id, one audit insert and one outbox emit each:
```ts
for (const id of ids.slice(0, 500)) {
  const children = await tx.select({ id: tasks.id })…
  const [changed] = await tx.update(tasks).set({…})…
  await recordModernAuditEvent(tx, { … });
  await emitOutboxEvent(tx, "entity.soft_deleted", { … });
}
```
`slice(0, 500)` silently drops the rest. Bulk status has no endpoint — `useTasksApi.ts:208-228` fans out
`Promise.all(ids.map(… updateStatus …))`, and `TasksWorkTab.tsx:131-146` clears the selection only in `onSuccess`.

**Consequence.** Against `mms-data-layer` §6.9/§5.10: a 500-row archive issues ~2,000 statements and 500 `NOTIFY`s in one
transaction; a restore whose parents are archived silently `continue`s (`:129`) and reports those ids as neither restored
nor failed; a partially-failed bulk status leaves the cache stale.

**Fix.** One `UPDATE … WHERE id = ANY($1) AND deleted_at IS NULL AND NOT EXISTS (active child)` plus one batched
`emitOutboxEvents`, returning `{ done, skipped }`; add `POST /api/tasks/bulk-status`; invalidate in `onSettled`.

## 5. Minor findings

| ID | Finding |
| --- | --- |
| m1 | No `startDate ≤ dueAt` validation (`tasksModuleManifest.ts:72-92`, `tasksWriteRepository.ts:104-118`) |
| m2 | An illegal/deep parent is a **500**, not 400 — `validateParent` throws `Error("Invalid parent task")` (`tasksWriteRepository.ts:44`) and routes catch only `TaskDelegationError`; `c.depth < 20` (`:34`) rejects legitimate deep trees |
| m3 | `DELETE /api/tasks/:id` answers `200 {success:false}` for an unknown/foreign id instead of 404 (`tasksSoftDeleteRoutes.ts:22-24` + `tasksTrashRepository.ts:34`) |
| m4 | Audit `oldState` carries only `{status, priority}`; delete/restore carry none (`tasksWriteRepository.ts:134`; `tasksTrashRepository.ts:35-41,81-87`) — assignee removals unprovable (§5.1) |
| m5 | Due filters use UTC day boundaries (`tasksRepository.ts:32-43`) and the client compares `new Date().toISOString().slice(0,10)` (`useTasksWorkTabFilters.ts:20`) — not the workspace day (§8.5) |
| m6 | `formatDate(task.startDate)` on a date-only string shifts the day west of UTC (`TaskDetailDrawer.tsx:93` via `settingsDateFormattersCore.ts:17-23`) |
| m7 | `/metrics` ignores list filters (`tasksMetricsRepository.ts:41`), so KPIs and the filtered directory disagree; the strip falls back to rendered length (`TasksPage.tsx:145`) |
| m8 | The status badge is display *and* mutation at `size="sm"` with no action-labelled accessible name (`TaskBadges.tsx:62-71`) — below the 44×44px floor |
| m9 | `CopyBtn className="h-6 w-6"` in the drawer is 24×24px (`TaskDetailDrawer.tsx:80`) |
| m10 | `onAddNew` is discarded (`TasksWorkTab.tsx:60`) and `primaryAction` hardcoded `undefined` (`:148`), so the empty state has no create action; no `ModuleEntityIoToolbar` IO row on the Work tab |
| m11 | `TaskFormModal` gets no `saving` prop (`TasksPage.tsx:199-204`) and `POST /api/tasks` has no idempotency key — double click can duplicate |
| m12 | `handleUpdateStatus` passes no `onError` and no success toast (`TasksPage.tsx:91-93`) — failures are silent |
| m13 | `canSelect={canDelete}` (`TaskCardItem.tsx:89`) and the table checkbox mean a write-only user cannot select rows, though bulk status needs only write |
| m14 | No `(workspace_subdomain, created_at DESC)` index while the default list is `ORDER BY created_at DESC` (`tasksRepository.ts:81`) |
| m15 | `SELECT_COLS` fetches `createdBy`/`updatedBy`/`assignedByUserId`/`completedAt`/`cancelledAt` but `mapTaskRow` drops them and `creatorName` is never populated (`tasksRowMapping.ts:15-49`) |

## 6. Test gaps

| ID | Gap |
| --- | --- |
| T1 | **No Tasks DB-integration or cross-tenant spec.** `__tests__/db-integration/` has 40+ suites and none for tasks; `crossTenantIsolation.integration.test.ts` has zero `task` references. RLS, composite FKs, the cycle CTE and assignee uniqueness have never run against real SQL |
| T2 | `tasksAssign.integration.test.ts:31` stubs the gate away (`vi.mock(…registerModuleAccess: vi.fn()…)`) and mocks every repository, so M2/M3 are invisible to the only route test |
| T3 | `EXPECTED_MODULE_ROUTE_ACTIONS` (`moduleAccessCoverage.test.ts:323-335`) has **no tasks rows** — nothing pins `DELETE → delete` or the status action; absence is not staleness |
| T4 | `taskDelegationService.test.ts` covers only the pure `resolveTaskRecipients`; `findEligibleTaskRecipientRows` — where `delegationScope` is ignored — is untested (M1 unpinned) |
| T5 | No test asserts that modules exposing transfer schemas have job runners, so C1 passes every suite |
| T6 | `taskNotificationService.test.ts` asserts emission, never delivery (M4 green). No frontend test covers the fetch window (C2) or selection-vs-filter (M7); `useTasksWorkTabFilters.test.tsx` covers predicates only |

## 7. Verified-clean surfaces

| Surface | Evidence |
| --- | --- |
| Cross-tenant parent linkage impossible | `tasksTables.ts:77-80` composite FK `(workspaceSubdomain, parentTaskId)`; `tasksWriteRepository.ts:27-44` anchors the CTE on the tenant and rejects a missing anchor |
| Assignee identity workspace-bound | `tasksTables.ts:129-144` composite FKs to `faculty`/`faculty_assignments`/`tenant_users`; `taskRecipientRepository.ts:43-56`; forged tuples rejected (`taskDelegationService.test.ts:21-36`) |
| Recipients need an active dated appointment | `taskRecipientRepository.ts:52-56`, workspace-timezone `business_day` CTE at `:36-38` |
| RLS + hard-delete guard on all three tables | `0134:328-333,389-394`; `0135:26-33` for `task_module_preferences` |
| Cycle check covers self, ancestors, existing loops | `tasksWriteRepository.ts:27-36` (`ARRAY[id] AS path`, `p.id = ANY(c.path)`, `row.id === id`, depth cap) |
| Server-owned fields unforgeable | `.strict()` DTOs omitting `workspaceSubdomain`/`createdById`/`createdAt`/`deletedAt`, pinned by `tasksSecurity.test.ts:43-52`; session stamping at `tasksWriteRepository.ts:67-70` |
| No `SELECT *`, no assignee N+1 on reads | `tasksRowMapping.ts:4-28`; `tasksRepository.ts:87-91` batches via `inArray` (`tasksAssigneesRepository.ts:63-69`) |
| Soft-delete filtering consistent | `tasksRepository.ts:25,107`; `tasksMetricsRepository.ts:41`; joins `tasksAssigneesRepository.ts:36,44,52,60,67` |
| Trash restore needs an active parent | `tasksTrashRepository.ts:57-66` (`isNotNull(deletedAt)` on read and write); `:113-129` bulk |
| Status CHECK matches the enum | `0134:218` shipped a stale `done` set; `0135:3-7` drops/recreates it and migrates `done → completed` |
| No 23505-on-restore class | `tasks` has no unique index beyond the composite PK — the students `m6` race is structurally absent (N/A, not untested) |
| Dates render in the workspace timezone | `formatDate`/`formatDateTime` (`settingsDateFormattersCore.ts:20-23`) in table (`tasksWorkBatchColumns.tsx:109`), cards (`TaskCardItem.tsx:128`), drawer (`TaskDetailDrawer.tsx:98`) |
| i18n / norms | all 84 `tasks.*` keys present in en/ar/ur/fa; max 286 (`TasksWorkTab.tsx`) and 281 (`useTasksApi.ts`) lines; zero `any`, zero raw `fetch`, `apiContract` + `signal` throughout |
| Setup tier | dirty-gated Save (`TasksSetupTab.tsx:42,118`); `canEditSetup` disables controls and hides Save; audit in-transaction (`taskSettingsService.ts:41-48`); `setupWrite` declared (`tasksRoutes.ts:83`) |

## 8. Adversarial audit

**Edge cases.** Cycles are caught three ways (explicit `row.id === id`, `p.id = ANY(c.path)`, composite FK) but surface as
500 not 400 (m2), and a tree deeper than 20 is rejected. The sharpest edge is the empty assignee array: a valid payload
that silently means "remove everyone" and skips delegation (M2). `dueAt` is an instant while `startDate` is a calendar
day, with no cross-check (m1). `includeDeleted` returns *only* deleted rows — consistent with the trash toggle though the
name misleads. Restoring a child whose parent is archived is a 400 single and a silent skip in bulk (M8).

**Failure modes.** C1 is the canonical silent failure: 202, progress in the tray, and only the worker knows the job died.
Bulk status is the second: `Promise.all` discards remaining writes on first rejection, `onSuccess` never runs, and the
cache is never invalidated though some writes committed (M8). Status changes have no `onError` (m12). `mutateTask`
computes the notification diff from a read outside the transaction (H5) — and because of M4 nobody observes it either way.

**Security / multi-tenancy.** Every query stays tenant-predicated, and both cross-table edges are composite FKs carrying
`workspace_subdomain`, so a forged `parentTaskId`/`facultyId` from another tenant is rejected by the database even if
application validation were bypassed — the strongest part of the module. Exposure is *intra*-tenant: authorization is
module-granular only, so `tasks.read` sees every task and `tasks.write` edits every task, and the delegation matrix
constrains whom you may assign but never which task you may touch or whether you may strip assignees (M2). Attribution
cannot be forged, but a non-owner mutation is indistinguishable from the owner's in the trail (m4).

**Concurrency.** Writes serialize per workspace via `lockFacultyHierarchy` (advisory xact lock on `faculty:{tenant}`) in
every write/trash path, preventing assignee-uniqueness and cycle races. Two gaps remain: no per-row lock or version
check, so read-modify-write is last-writer-wins with no 409 (H6); and `previous` is read before that lock (H5). Bulk
operations hold the lock for up to 500 × 4 statements (M8), blocking every other task write in the tenant.

## 9. Resolution plan

### Tier 1 — blocking, contained in the module

| Item | Change | Guard to add |
| --- | --- | --- |
| **C1** | Register `tasks:export`/`tasks:import` runners (or remove the controls and schemas) | Registry assertion: every module with transfer schemas has both runners |
| **C2** | Send `limit`/`offset` + existing server filters; footer from `total`; page or "load more" | Frontend test: second page loads, filter resets offset, truncation visible |
| **M3** | tasks rows in `MODULE_ROUTE_ACTION_RULES` (trash → `delete`); resolve `tasks.complete`/`tasks.assign` | `EXPECTED_MODULE_ROUTE_ACTIONS` entries + stale-entry check |
| **M5** | Omit `assignees` unless the picker changed; validate only added recipients | Form-controller test: title-only edit sends no `assignees` |
| **M7** | Selection scope key `${filterKey}|${offset}`, or intersect with visible ids at action time | Hook test: filter change clears `selectedIds` |

### Tier 2 — correctness and performance

| Item | Change | Guard to add |
| --- | --- | --- |
| **M1** / **M2** | Implement `delegationScope` over the reporting line; add ownership + assignee-removal predicates | DB-integration: down-line vs cross-line; "principal mutates admin's task" → 403 |
| **M4** | Consumer → in-app notifications + `broadcastTenantUpdate`, or drop `notifyOn*` | Delivery assertion, not just an outbox row |
| **M6** | `TASK_STATUS_TRANSITIONS` enforced in `updateTask`; badge becomes a confirming menu | Shared transition test + inject test for an illegal edge → 400 |
| **M8** | Single-statement bulk `UPDATE`, batched `emitOutboxEvents`, `{ done, skipped }`, bulk-status route, `onSettled` | DB-integration: one statement per bulk call; partial-failure contract |
| m1–m15 | Validation, 400/404 mapping, `oldState`, workspace-local day bounds, date-only rendering, filtered metrics, 44px hit areas, IO row + empty-state action, `saving` + idempotency key, status `onError`, selection gated by write, `(tenant, created_at DESC)` index, mapper cleanup | Targeted unit/inject specs per item |

### Product decisions

1. **Delegation model.** Hierarchical delegation (implement M1, widen `assign_anywhere` beyond admin) or flat team board
   (delete `delegationScope` and its copy). The UI promises the former; the code does neither.
2. **Task ownership.** Workspace-communal (as built) or scoped to creator/assignee with an elevated override. M2 is "by
   design" only if the former is explicit — and assignee stripping still needs a guard.
3. **Notification delivery.** Ship in-app assignment/status notifications, or remove the toggles. Outbox rows nobody reads
   is the worst of both.

## 10. Hypotheses not proven

- **H1 — import rows unusable even with a runner.** `tasksImportRowSchema` makes `title` optional and models `assignee` as
  free text (`schemas/opsModuleImport.dto.ts:71-79`) with no name→faculty resolver. Unprovable today (no runner).
- **H2 — tenant-key casing divergence.** `listTasks` normalises (`tasksRepository.ts:21`) while `getTaskMetrics`
  (`tasksMetricsRepository.ts:41`) and the trash paths (`tasksTrashRepository.ts:21,32,61,…`) compare the raw
  `String(request.tenant?.id)`; a mixed-case binding would silently return zero rows. `authenticate.ts:272` binds
  `{ id: tenant }` from host resolution, which I did not trace.
- **H3 — duplicate creation on double-submit.** No idempotency key and no `saving` prop (m11); whether a double click
  really duplicates depends on `FormModal`'s internal pending guard, which I did not read.
- **H4 — assignee history loss.** `syncTaskAssignees` archives and re-inserts on every write including assignees
  (`tasksAssigneesRepository.ts:101-123`), resetting `assignedAt` and minting new ids. Churn proven; dependency on row
  identity is not.
- **H5 — stale notification diff.** `mutateTask` reads `previous` before the transaction (`taskMutationService.ts:17`) and
  writes inside it (`:19`); a concurrent writer can skew the diff. No test or lock covers it; race not constructed.
- **H6 — no optimistic concurrency.** No `expectedUpdatedAt`, no version column, so a contested `PUT`/`PATCH` is
  last-write-wins (no 409). Proven as *absent*; whether that is unacceptable is a product decision.

## 11. Implementation status (2026-11-04)

Tier 1 landed in the same change set after this review:

| ID | Status | Change | Guard |
| --- | --- | --- | --- |
| C1 | **Fixed** | `tasks:export` / `tasks:import` runners registered (`backgroundJobTasksRunners.ts`), streaming/buffered CSV export and a validated import batch that goes through `mutateTask` | `tasksExportService.test.ts`, `tasksImportUseCases.test.ts` |
| C2 | **Fixed** | Server pagination (`limit`/`offset` + real `total`) and additive multi-status/multi-priority/overdue/due-on filters; the directory now sends the filters instead of filtering one page client-side | `tasksServerFilters.test.ts`, repository filter conditions (typechecked; no DB case yet), `features/tasks` suite |
| M3 | **Partial** | `tasks.delete` rules added for `DELETE/:id`, restore and bulk trash; status route is `availability`. `tasks.assign`/`tasks.complete` remain implied by `tasks.write` (permission-model cleanup deferred) | `moduleAccessCoverage.test.ts` expected-action entries |
| M5 | **Fixed** | The edit form omits `assignees` unless the picker changed, so a non-admin can edit another user's assigned task | `taskFormPayload.test.ts` |
| M7 | **Fixed** | Bulk selection clears on any filter/search/page change | `useTaskSelectionScope.test.tsx` |

| M6 | **Fixed** | `TASK_STATUS_TRANSITIONS` in `@mms/shared` is enforced by `updateTask` (400 via the status route); the badge is now a menu of legal transitions (explicit reopen for terminal states) and the edit form only offers reachable statuses | `tasksStatusTransitions.test.ts`, `tasksAssign.integration.test.ts` (illegal edge → 400), `TaskStatusMenu.test.tsx` |
| M8 | **Fixed** | Bulk archive/restore are one `UPDATE … RETURNING` per batch with batched outbox events and per-row audit; >500 ids is a 400; skipped rows carry a reason. Bulk status is one route/one update (legal transitions only) and the client invalidates on settle | `tasksBulkRepository.test.ts`, bulk-status inject tests |

Still open (Tier 2): M1 delegation scope, M2 ownership policy, M4 notification delivery, and the minors in §5. The three product decisions in §9 remain unanswered.
