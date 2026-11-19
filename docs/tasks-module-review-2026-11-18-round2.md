# MMS Tasks Module Review — 2026-11-18 (round 2)

Second dedicated review of the Tasks domain, at `main` HEAD `7a730976e` (working tree clean at
review time). It re-verifies every finding left open by the [2026-11-04 review](tasks-module-review-2026-11-04.md)
and reconciles the [2026-11-12 domain/lifecycle audit](tasks-domain-lifecycle-audit-2026-11-12.md), then surfaces
what is still open today.

**Scope.** `packages/shared/src/tasks/**`, `contracts/tasks.contract.ts`, `dataTransfer/**/tasksTransferSchema.ts`,
`auth/{permissionRules,permissions,userRbac*}.ts`; `apps/backend/src/routes/tenant/tasks*.ts`,
`apps/backend/src/tasks/**`, `services/task*.ts` + `tasksExportService.ts` + `backgroundJobTasksRunners.ts`,
`db/repositories/task*.ts`, `db/schema/tasksTables.ts` + `taskSettingsTables.ts`, `lib/moduleRouteActionRules.ts`
+ `rbacPermissionMaps.ts`; `apps/frontend/src/tenant/features/tasks/**`,
`tenant/hooks/collections/tasks.ts`, `lib/config/routeAccess.ts`.

**Method.** Read-only static verification on the path production runs — route → module gate/permission →
use case → repository → SQL/DDL → shared DTO. Findings cite `file:line` at `7a730976e` and quote the
offending code. "Untested" is a test gap (§6), never a defect; unprovable concerns are hypotheses (§10).

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm run check:code-norms` | Pass — 0 explicit `any`, 4 files > 300-line ceiling, 0 arbitrary-colour expressions |
| `pnpm lint` | Pass (all 5 packages, turbo cache) |
| `check:i18n` / `check:i18n-unused` / `check:shared-purity` / `check:work-directory` / `check:db-projections` / `check:backend-boundaries` / `check:faculty-domain` | Pass |
| Backend tasks suites (`moduleAccessCoverage`, `tasksAssign.integration`, `tasksWriteRepository`, `tasksBulkRepository`, `tasksAssigneesRepository`, `taskDelegationService`, `taskNotificationService`, `taskPermissionService`, `tasksImportUseCases`, `tasksExportService`, `tasksUseCases`) | **58/58 passed** (11 files) |
| Frontend `routeAccess` + `features/tasks` | **93/93 passed** (23 files) |
| `pre-pr-review.sh` (full) | 3 gates reported ✗ under parallel execution; re-run serially → code-norms ✓, eslint ✓. The `check:accounting-route-injection` gate fails with a pnpm `RetryOperation` `TypeError` (infrastructure, unrelated to Tasks). TDD-pairing advisory names 3 **messaging** files (unrelated). |

**Audits were static:** the two DB-integration specs that pin the delegation scope and OCC
(`taskDelegationScopeDb.integration.test.ts`, the "Tasks optimistic concurrency" section of
`occWritesDb.integration.test.ts`) were **not** executed (no live DB); they are verified by reading only.

## 2. Verdict

**Tasks has moved from "not finished" to "structurally sound, with a delegation model that now actually
delegates."** Every Tier-1 finding from the 11-04 review (C1/C2/M3/M5/M6/M7/M8) is closed in code and
pinned by tests: the CSV runners exist, the directory is server-paginated, the route→action map is correct,
the form stops resubmitting assignees, status transitions are enforced with an explicit-reopen menu, selection
clears on window change, and bulk operations are set-based. The delegation-scope setting (M1) is genuinely
implemented — a recursive designation-subtree walk wired from the route and covered by a DB-integration spec —
so a line manager can now assign to their direct reports or full reporting line, not just themselves.

What remains is a small, stable residue: **the notification pipeline is still emitted-and-never-delivered
(M4)**, **there is still no task-ownership or assignee-removal predicate (M2)**, and the two domain/lifecycle
gaps the 11-12 audit raised — **no subtask-completion barrier** and **the transactional-outbox split-brain** —
are still open. These are the items that block calling Tasks production-complete; the rest of the residue is
minor consistency/perf debt. No Critical defect class (cross-tenant leak, RLS bypass, mass-assignment, `SELECT *`)
reproduces.

## 3. Findings summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| M2 | **Major** | Authorization | No ownership or assignee-removal predicate: any `tasks.write` holder mutates/archives any task, and `PATCH {assignees: []}` still strips every assignee (delegation short-circuits on empty input) |
| M4 | **Major** | Notifications | `task.assigned`/`task.status_changed` outbox rows are still emitted and never delivered — `recipientUserIds` has no consumer; Setup toggles are silent no-ops |
| A1 | **Major** | Lifecycle | A task can be marked `completed` while active child subtasks remain unresolved (no barrier in `updateTask`/bulk status) |
| A5 | **Major** | Transactional integrity | Mutation (Tx1) and notification-intent outbox (Tx2) are separate transactions; a crash between them loses the event, and a Tx2 failure cannot roll back Tx1 |
| A6 | **Major** | Architecture | Status/bulk-status routes leak domain orchestration — they import and dispatch notification intents directly instead of through `mutateTask`, so non-HTTP callers get no notifications |
| m1 | **Minor** | Validation | `startDate ≤ dueAt` enforced only in the frontend (`taskFormPayload.ts`), never in `createTask`/`updateTask` |
| m3 | **Minor** | API | `DELETE /api/tasks/:id` returns `200 {success:false}` for an unknown/foreign id instead of 404 |
| m5 | **Minor** | Dates | Due filters and export render UTC day boundaries, not the workspace day |
| m7 | **Minor** | Metrics | `/metrics` ignores list filters, so the KPI strip and a filtered directory can disagree |
| m14 | **Minor** | Performance | No `(workspace_subdomain, created_at DESC)` index behind the default `ORDER BY created_at DESC` list |
| m15 | **Minor** | Dead data | `mapTaskRow` drops `assignedByUserId`/`completedAt`/`cancelledAt`/`createdBy`/`updatedBy`; `creatorName` is never populated; `task_assignees.completed_at` is a dead column |
| N1 | **Minor** | API | `GET /api/tasks` parses the query with `.parse()` → a malformed query throws → 500 instead of 400 |
| N2 | **Minor** | Data layer | Tenant-key normalization is inconsistent (`listTasks` lowercases; metrics/trash use raw `request.tenant.id`) |

## 4. Findings detail

### M2 — Major — no ownership predicate; empty assignees still bypass delegation
**Evidence.** The write routes gate only on capability, never on relationship.
`routes/tenant/tasksRoutes.ts:132-174` checks `tasks.write`; `services/taskMutationService.ts:31-36` validates
`mutation.data.assignees ?? []` through `validateTaskDelegation`, and that service short-circuits the empty case —
`services/taskDelegationService.ts:51`:
```ts
if (!inputs.length) return { valid: true, resolvedAssignees: [] };
```
`tasksWriteRepository.ts:101-193` (`updateTask`) has no creator/assignee predicate and, when
`recipients !== undefined`, calls `syncTaskAssignees` with the (possibly empty) set, which soft-deletes every
active assignee (`tasksAssigneesRepository.ts:113-122`).

**Path → consequence.** A principal holding `tasks.write` (which, per `auth/permissionRules.ts:102,104`,
is byte-for-byte the same grant as `tasks.assign`) sends `PATCH /api/tasks/<any-id> { "assignees": [] }`. The
assign gate at `tasksRoutes.ts:146-153` passes (they hold the capability), delegation returns valid on the empty
list, and every assignee is archived. The same route re-titles/re-dates/re-prioritises/re-parents any task, and
`DELETE /api/tasks/:id` archives any task regardless of who created or was assigned to it.

**Fix.** (1) Resolve the *current* assignee set inside the transaction and require `assign_anywhere` (or
per-assignee eligibility) before removing anyone — an empty array must not be a free pass. (2) Constrain mutation
to creator OR assignee OR `assign_anywhere`, else 403 — or explicitly document the workspace-communal model and
ship the product decision (11-04 §9 decision #2). Pin with `inject()` deny cases for both.

### M4 — Major — assignment/status notifications reach nobody
**Evidence.** `taskNotificationService.ts:37-64` writes `task.assigned`/`task.status_changed` with
`recipientUserIds`; the only outbox consumer still falls through for them —
`worker/processors/outboxCdcProcessor.ts:103-116`:
```ts
if (row.eventType === "entity.soft_deleted") { … }
else if (row.eventType === "entity.restored") { … }
else {
  // entity.hard_purge or unknown — just evict cache
  await redisDelPattern(cacheEvictPattern(row.workspaceSubdomain, row.entityType));
}
```
A repo-wide grep confirms `recipientUserIds` appears only in the emitter, the payload type, tests, and docs.

**Consequence.** `notifyOnAssignment`/`notifyOnStatusChange` (Setup tab, translated in all four locales) promise
behaviour that does not exist; the module's core loop — assign work, tell the assignee — is silent.

**Fix.** Wire a consumer (in-app notification + `broadcastTenantUpdate`, or messaging) for these two event types,
or remove the toggles from the DTO/UI. Pin with a delivery assertion, not an outbox-row assertion.

### A1 — Major — a parent can be completed with unresolved subtasks
**Evidence.** `tasksWriteRepository.ts:125-135` validates only the transition edge; `bulkUpdateTaskStatusBatch`
(`tasksBulkRepository.ts:200-205`) likewise. Neither checks for active children before `status = "completed"`.

**Consequence.** "Prepare Accreditation" can be `completed` while its "Submit"/"Review" children are still
`todo`/`blocked`, stranding active work under a completed parent and corrupting the metrics/report story.

**Fix.** Before a `→ completed` transition, reject with `409` if any active non-terminal child exists (offer an
explicit `forceCompleteSubtasks` override). Same rule in the bulk path. Pin with an `inject()`/DB-integration case.

### A5 — Major — transactional-outbox split-brain on task mutations
**Evidence.** `taskMutationService.ts:26-60`:
```ts
const previous = mutation.kind === "update" ? await findTaskById(tenant, mutation.id) : null;
const next = await withTenant(tenant, async (tx) => { … return updateTask(…); });   // Tx1
if (next) { … await emitTaskNotificationIntents({ … }); }                            // Tx2 (new transaction)
```
The status/bulk-status routes do the same: `tasksRoutes.ts:214-224` and `:251-261` run the mutation, then emit
intents in a second `withTenant` block.

**Consequence.** If the process dies between Tx1 commit and Tx2, the mutation is durable but the event is never
written; if Tx2 fails, Tx1 cannot be rolled back. (Today this is masked by M4 — nothing reads the events — but it
is a latent correctness defect in the outbox pattern and must not survive M4's fix.)

**Fix.** Emit the outbox events inside the same `withTenant` callback as the mutation, passing the `tx` through
`emitTaskNotificationIntents`.

### A6 — Major — domain orchestration leaks into the route handlers
**Evidence.** `tasksRoutes.ts:214-224` and `:251-261` import `taskNotificationService` and call
`emitTaskNotificationIntents`/`emitTaskBulkStatusNotifications` directly, while `POST /api/tasks` and
`PATCH /api/tasks/:id` route through `mutateTask` (which owns delegation + notify).

**Consequence.** `updateTaskStatus`/`bulkUpdateTaskStatus` invoked from any non-HTTP caller (worker, seed, script)
silently skips notifications; there are two inconsistent mutation seams for the same domain.

**Fix.** Fold status-change notification into the use-case layer (e.g. `mutateTask`-style `updateTaskStatusUseCase`)
and have the routes call only that. This also closes A5 for the status path.

## 5. Minor findings

| ID | Finding |
| --- | --- |
| m1 | `startDate ≤ dueAt` is enforced only client-side (`lib/taskFormPayload.ts:16-25`); `createTask`/`updateTask` accept any pair. Backend invariant still absent |
| m3 | `deleteTask` returns `false` for unknown and already-deleted ids (`tasksTrashRepository.ts:30-35`) → `DELETE /api/tasks/:id` answers `200 {success:false}` instead of 404 |
| m5 | `dueFrom`/`dueTo`/`dueOn`/`overdue` bound UTC days (`tasksRepository.ts:61-97`); export renders `dueAt.slice(0,10)` (`tasksExportService.ts:115`) — not the workspace day |
| m7 | `getTaskMetrics` takes no filter args (`tasksMetricsRepository.ts:22-41`), so the Work-tab KPI strip and a filtered directory can disagree |
| m14 | No `(workspace_subdomain, created_at DESC)` index; the default list is `ORDER BY created_at DESC` over a tenant predicate only (`tasksRepository.ts:135`) |
| m15 | `SELECT_COLS` fetches `assignedByUserId`/`completedAt`/`cancelledAt`/`createdBy`/`updatedBy`/`deletedBy`… and `mapTaskRow` drops them (`tasksRowMapping.ts:4-49`); `creatorName` is never set, and `task_assignees.completed_at` is never written (dead column, 11-12 §1.3) |
| N1 | `GET /api/tasks` uses `taskListQuerySchema.parse(request.query)` (`tasksReadRoutes.ts:13`) — `?limit=abc` throws `ZodError` → 500. Every other handler in the module uses `safeParse` + 400 |
| N2 | Tenant normalization is inconsistent: `listTasks`/`findTaskById` call `.trim().toLowerCase()` while `getTaskMetrics`/single-trash paths use raw `request.tenant.id` (`tasksMetricsRepository.ts:41`, `tasksTrashRepository.ts:33`) |

## 6. Test gaps

| ID | Gap |
| --- | --- |
| T1 | M2 has no deny-case: no spec asserts that a non-owner `tasks.write` holder is rejected, nor that `PATCH {assignees:[]}` without `assign_anywhere` is rejected. `tasksAssign.integration.test.ts` covers the gate, not the relationship |
| T2 | A1/A5/A6 are unpinned: no test drives `completed` with an open child, asserts outbox emission inside the mutation transaction, or proves status changes notify from a non-HTTP caller |
| T3 | M4 is "green" only because `taskNotificationService.test.ts` asserts emission, never delivery |
| T4 | `taskDelegationScopeDb.integration.test.ts` and the Tasks section of `occWritesDb.integration.test.ts` were not executed in this audit (no live DB); RLS/CTE/OCC claims are read-only verified |

## 7. Verified-clean surfaces

| Surface | Evidence |
| --- | --- |
| CSV export/import runners registered (C1) | `backgroundJobTasksRunners.ts:14-33`; export streams every page (`tasksExportService.ts:122-161`); import resolves assignees against the eligible set and enforces `tasks.assign` (`taskImportUseCases.ts:52-70,104-108`); worker binds tenant via `runWithTenant` (`backgroundJobWorkerService.ts:156`) |
| Server pagination + filters (C2) | `useTasksPageController.ts:66-76`, `TasksPaginationFooter`, `tasksServerFilters.ts`; `listTasks` honours `limit`/`offset`/`statuses`/`priorities`/`dueOn`/`overdue` (`tasksRepository.ts:47-152`) |
| Delegation scope implemented + wired (M1) | `taskRecipientRepository.ts:34-127` recursive `scope_designations` CTE (depth 1 = direct_reports, 20 = descendants); route threads `settings.delegationScope` (`tasksRoutes.ts:48-54`); `taskDelegationScopeDb.integration.test.ts` |
| Route→action map correct (M3) | `moduleRouteActionRules.ts:120-140`: DELETE/:id, bulk-delete/bulk-restore/:id/restore → `delete`; status/bulk-status → `availability` (handler-owned); pinned by `moduleAccessCoverage.test.ts` |
| Status transitions enforced + explicit reopen (M6) | `TASK_STATUS_TRANSITIONS` (`tasksModuleManifest.ts:24-31`); `updateTask` throws `ValidationError` on illegal edge (`tasksWriteRepository.ts:125-131`); `TaskStatusMenu` 44px trigger with `aria-label` |
| Edit form omits unchanged assignees (M5) | `taskFormPayload.ts:50-71`; `assigneesChanged` compares normalized faculty ids |
| Selection clears on window change (M7) | `useTaskSelectionScope` keyed by `buildTaskFilterScopeKey({…, page})` (`TasksWorkTab.tsx:119-130`) |
| Bulk ops set-based (M8) | one `UPDATE … WHERE id = ANY($1)` + batched `emitOutboxEvents` + per-row audit (`tasksBulkRepository.ts`); >500 ids rejected by schema `max(500)` |
| OCC wired end to end (H6) | `expectedUpdatedAt` on `updateTask` (`tasksWriteRepository.ts:114-163`, 409 on stale); client sends `x-expected-updated-at` (`useTasksApi.ts:129-135`) |
| Cycle check, composite FKs, RLS, unique assignee | `validateParent` CTE (`tasksWriteRepository.ts:34-52`); composite FKs (`tasksTables.ts:77-80,129-144`); `task_assignees_recipient_active_uidx` (`:126-128`) |
| No `SELECT *`, batched assignee hydration | `SELECT_COLS` + `inArray` (`tasksRowMapping.ts:4-28`, `tasksAssigneesRepository.ts:64-70`) |
| i18n / norms | all `tasks.*` keys in en/ar/ur/fa; zero `any`; no raw `fetch`; max file length within the 300-line band |

## 8. Adversarial audit

**Edge cases.** The sharpest remaining edge is the empty-assignee payload (M2): a syntactically valid body that
means "remove everyone" and skips delegation. A tree deeper than 20 levels is rejected as "Invalid parent"
(`c.depth < 20`), and `parentTaskId === id` is caught only by `validateParent`, not a DB `CHECK` (11-12 §2.2) —
the composite FK and CTE make it unreachable through the API, but the schema lacks the self-parent guard other
hierarchy tables carry.

**Failure modes.** M4/A5 combine into the canonical silent failure: the module promises notification and writes
the intent, but nothing delivers it, and the intent can be lost outright on a crash between Tx1 and Tx2. N1 is a
second, smaller one: a bad query string on the list endpoint yields a 500 stack instead of a 400. The bulk status
path is now correctly invalidated on settle (`useTasksApi.ts:241-243`), closing the 11-04 stale-cache class.

**Security / multi-tenancy.** Every query is tenant-predicated and the cross-table edges are composite FKs
carrying `workspace_subdomain`, so forged `parentTaskId`/`facultyId`/`userId` from another tenant are rejected by
the database even if application validation were bypassed — still the strongest part of the module
(`tasksTenantIsolation.integration.test.ts` exists). Exposure remains *intra*-tenant: authorization is
module-granular only, so `tasks.read` sees every task and `tasks.write` edits every task (M2). Trash reads now
require `tasks.delete` (`tasksReadRoutes.ts:17-21`), matching the archive boundary.

**Concurrency.** Writes serialize per workspace via `lockFacultyHierarchy` in every write/trash/bulk path,
preventing assignee-uniqueness and cycle races. OCC (`expectedUpdatedAt`) now covers single `update`/status, but
`previous` is still read before the lock (`taskMutationService.ts:26`) and before the write, so the notification
*diff* can be skewed by a concurrent writer (11-04 H5 — now material because notifications are emitted). Bulk
status has no OCC token; it applies the transition to whatever state the rows are in at lock time.

## 9. Resolution plan

### Tier 1 — blocking (product decision + correctness)

| Item | Change | Guard |
| --- | --- | --- |
| **M2** | Add ownership + assignee-removal predicates (creator/assignee/`assign_anywhere`); empty `assignees` never strips without `assign_anywhere`. Or document the communal model and still guard stripping | `inject()` deny cases + DB-integration |
| **M4** | Consumer for `task.assigned`/`task.status_changed` → in-app notification + `broadcastTenantUpdate`, or delete the toggles | delivery assertion |
| **A1** | Subtask-completion barrier on `→ completed` (single + bulk), `forceCompleteSubtasks` override | `inject()`/DB-integration case |
| **A5/A6** | Move notification emission into the use-case layer inside the mutation transaction; routes stop importing `taskNotificationService` | assert outbox row is written in the same transaction as the mutation |

### Tier 2 — minors

| Item | Change |
| --- | --- |
| m1 | enforce `startDate ≤ dueAt` in the shared DTO/`updateTask` (not just the form) |
| m3 | `deleteTask` returns not-found vs already-deleted; route maps to 404/200 |
| m5 | workspace-local day bounds for due filters and export dates |
| m7 | accept filter params on `/metrics` (or drop the KPI strip when filtered) |
| m14 | add `(workspace_subdomain, created_at DESC)` index |
| m15 | stop selecting dropped columns; populate `creatorName`; write `task_assignees.completed_at` or drop the column |
| N1 | `taskListQuerySchema.safeParse` + 400 in `tasksReadRoutes.ts` |
| N2 | normalize tenant once at the route boundary for metrics/trash |

### Product decisions (unchanged from 11-04 §9)

1. **Delegation model** — resolved in code (hierarchical scope). Only the *depth* cap (20) and the missing
   dependency-graph feature (11-12 §2.2) remain un-scoped.
2. **Task ownership** — still undecided: workspace-communal (as built) vs creator/assignee-scoped. M2 is the
   consequence of leaving this open.
3. **Notification delivery** — ship in-app notifications or remove the toggles. Emitting events nobody reads is
   the worst of both worlds (M4).

## 10. Hypotheses not proven

- **H1 — tenant-casing divergence is inert.** `listTasks` normalises while `getTaskMetrics`/single-trash do not
  (N2). Whether this can ever mis-resolve depends on `authenticate`/host resolution binding a lowercased
  subdomain; not traced to the binding site, so left as a consistency note rather than a defect.
- **H2 — `creatorName` is user-visible-but-always-empty.** `TaskRecord.creatorName` exists and is never populated
  (m15); no frontend surface currently renders it, so the impact is zero until one does.

## 11. Status of prior findings (2026-11-04 → 2026-11-18)

| ID | Status | Note |
| --- | --- | --- |
| C1 | **Closed** | runners registered + import/export implemented |
| C2 | **Closed** | server pagination + filters + footer |
| M1 | **Closed** | delegation scope implemented, wired, DB-integration tested |
| M2 | **Open** | no ownership predicate; empty-assignee strip survives |
| M3 | **Closed** | route→action rules correct; `tasks.assign`/`tasks.complete` permission-model cleanup still deferred (see §3 note) |
| M4 | **Open** | emitted, never delivered |
| M5 | **Closed** | form omits unchanged assignees |
| M6 | **Closed** | transitions + explicit-reopen menu |
| M7 | **Closed** | selection scope key |
| M8 | **Closed** | set-based bulk + batched outbox |
| m1 | **Partial** | frontend-only check; backend invariant missing |
| m2 | **Closed** | illegal parent now 400; depth-20 residual folded into A4 note |
| m3 | **Open** | still `200 {success:false}` |
| m4 | **Closed** | update audit carries old/new state; assignee deltas in `task_assignees` audit |
| m5 | **Open** | UTC day bounds |
| m6 | **Closed** | `formatDate` short-circuits date-only strings |
| m7 | **Open** | metrics ignore filters |
| m8 | **Closed** | 44px status trigger with label |
| m9 | **Closed** | 44px copy button |
| m10 | **Closed** | empty-state create action + keyboard shortcut |
| m11 | **Partial** | `saving` prop wired; no idempotency key (minor residual) |
| m12 | **Closed** | status `onError` toast |
| m13 | **Closed** | `canSelect = canWrite \|\| canDelete` |
| m14 | **Open** | index still absent |
| m15 | **Open** | mapper still drops columns; `creatorName` empty |
| H1 | **Open** | import assignee resolver now exists; import is per-row partial-success by design |
| H5/H6 | **H6 closed** (OCC added); **H5 open** (notification diff read pre-lock) |

## 12. Remediation status (2026-11-19, in progress)

Implemented against the approved plan (M2 scoped ownership · M4 configurable channel · A1 barrier · A5/A6
atomic outbox + status use-cases · Tier-2 minors), with TDD specs. All three packages typecheck and the
code-norms / i18n / migrations-forward-only / db-projections gates hold.

| Item | Status | Notes |
| --- | --- | --- |
| Shared contracts (`notificationChannel`, `forceCompleteSubtasks`, notification kinds, i18n) | **Done** | `tasksModuleManifest.ts`, `tenantNotifications.ts`, 4× i18n packs |
| Schema + migration | **Done (code)** | `notification_channel`, `recipient_user_id`, `(ws, created_at DESC)` index, drop `task_assignees.completed_at`; migration `0266` + journal written. Drizzle snapshot still needs `drizzle-kit generate` against a live DB |
| M2 ownership (mutation) + assignee-removal guard | **Done** | `taskMutationService` via `taskOwnership.canActorMutateTask`; spec `taskMutationService.test.ts` (5) |
| M2 ownership (archive/restore, single + bulk) | **Done** | `deleteTask`/`restoreTask` + `bulkDeleteTasksBatch`/`bulkRestoreTasksBatch` skip non-creator rows without `assign_anywhere` (`forbidden` skip reason) |
| A1 subtask barrier (single + bulk) | **Done** | `tasksWriteRepository` + `tasksBulkRepository`; spec `tasksWriteRepository.test.ts` (+3) |
| m1 backend date validation | **Done** | `createTask`/`updateTask`; spec (+1) |
| m3 delete 404 | **Done** | `deleteTask` → `deleted\|already_deleted\|not_found`; spec `tasksSoftDeleteErrors` (+2) |
| N1 list query safeParse | **Done** | `tasksReadRoutes.ts` |
| N2 tenant normalization | **Done** | metrics + single trash paths |
| m15 mapper trim | **Partial** | dead columns removed; `creatorName` still unpopulated |
| A5/A6 atomic outbox + status use-cases | **Done** | `emitTaskNotificationIntents(tx, …)` inside the mutation transaction; `changeTaskStatus`/`changeTasksBulkStatus` replace route-level orchestration |
| M4 delivery consumer (in-app + messaging) | **Done (email messaging)** | `outboxCdcProcessor` → `deliverTaskNotification`: user-targeted in-app rows + plain-text email via `sendTenantEmail`. SMS/WhatsApp deferred (needs contact-phone resolution) |
| m5 (workspace day bounds) | **Done** | `lib/workspaceDayBounds.ts` + `listTasks` now use the workspace timezone for `dueFrom`/`dueTo`/`dueOn` (spec `workspaceDayBounds.test.ts`) |
| m7 (filtered metrics) | **Resolved** | KPI strip is intentionally workspace-wide; directory footer already reflects the filtered `total` |
| Frontend Setup channel selector | **Done** | `TasksSetupTab` `notificationChannel` select (in-app / messaging / both) |

**Verification run this round:** `pnpm --filter @mms/shared build && typecheck` ✓ · backend `typecheck` ✓ ·
frontend `typecheck` ✓ · `check:code-norms` / `check:i18n` / `check:migrations-forward-only` /
`check:db-projections` ✓ · backend tasks+notifications suites ✓ (incl. new `taskMutationService.test.ts`) ·
frontend tasks+notifications suites ✓ (93 + notification suites).

(End of file)
