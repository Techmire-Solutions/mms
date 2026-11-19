# MMS Tasks Module — Backend Review — 2026-11-19

Read-only review of the Tasks **backend** surface at `HEAD e720b0dd9` (the full remediation plus the residual-gap and messaging-dispatch commits). It verifies the remediation did not introduce regressions and surfaces new defects on the production code path.

**Scope.** `routes/tenant/tasks*.ts`; `tasks/use-cases/*`; `services/task{Ownership,Mutation,Notification,NotificationDelivery,Settings,Permission,EligibleAssignees,Delegation}Service.ts` + `tasksExportService.ts` + `backgroundJobTasksRunners.ts` + `outboxEventService.ts`; `db/repositories/tasks*` + `taskRecipientRepository.ts` + `tenantNotificationsRepository.ts` + `tenantUserRepositoryHydrate.ts`; `worker/processors/outboxCdcProcessor.ts`; `db/schema/{tasks,taskSettings,tenantNotifications}Tables.ts`; migration `0266`; `users/use-cases/usersUseCases.ts`; `lib/workspaceDayBounds.ts`.

**Method.** Static read on the production path (route → module gate/permission → use-case → repository → SQL → DTO), plus the gate/test baseline. Findings cite `file:line` at `e720b0dd9`.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend typecheck` | Pass |
| Backend task/notification/outbox/soft-delete suites | **234 passed** (34 files) |
| `check:backend-structure` | Pass (66/66 services storage imports; 51/51 companion tests) |
| `check:code-norms` | Pass (4 files > 300-line ceiling) |
| `check:migration-hygiene` / `check:migrations-forward-only` / `check:db-projections` | Pass (verified in the prior round; unchanged since) |
| `db:migrate` / `db:check` | Pass (267 = 267); migration `0266` applied |

## 2. Verdict

The remediation is structurally sound and the tree is green, but the review found **two Major authorization/correctness defects introduced (or left un-closed) by the change set**, plus a set of minors. Both Majors are in the **M4 delivery** and **M2 bulk-status** paths — the two areas that received the most new code.

## 3. Findings summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| B1 | **Major** | M4 delivery | Email fallback maps emails to users **by array index**, but the underlying query has no `ORDER BY` — a recipient can be messaged at another recipient's email address |
| B2 | **Major** | M2 ownership | `changeTasksBulkStatus` ignores its `canAssignAnywhere` argument and `bulkUpdateTaskStatusBatch` applies no ownership predicate — a `tasks.write`/`tasks.complete` holder can bulk-change the status of any task, bypassing the scoped-ownership gate now enforced on the single paths |
| B3 | **Minor** | M4 delivery | In-app notification insert has no `dedupeKey`, so a CDC retry after a partial commit can emit a duplicate `task.assigned`/`task.status_changed` notification |
| B4 | **Minor** | Layering | `taskNotificationDeliveryService` imports `dispatchMessagingCampaignDirect` from `routes/tenant/messaging/` (services → routes dependency) |
| B5 | **Minor** | DRY | `getTaskMetrics` duplicates the ~50 lines of `listTasks` filter conditions (status/priority/due/search/overdue) |
| B6 | **Minor** | i18n | `composeTaskMessage` hardcodes English prose ("You were assigned a task: …", "status changed to") |
| B7 | **Minor** | Data | `getTaskMetrics` `overdue` WHERE uses JS `new Date()` while the `overdue` FILTER aggregate uses DB `CURRENT_TIMESTAMP` — the two can disagree under clock skew |

## 4. Findings detail

### B1 — Major — email fallback can deliver to the wrong recipient

**Evidence.** `services/taskNotificationDeliveryService.ts:112-121`:
```ts
if (withoutContact.length > 0) {
  const emails = await usersUseCases.loadUserEmailsByTenant(tenant, withoutContact);
  const byUser = new Map(
    withoutContact.map((userId, index) => [userId, emails[index] ?? undefined]),
  );
  for (const userId of withoutContact) {
    const email = byUser.get(userId);
    if (email) recipients.push({ id: userId, email });
  }
}
```
`usersUseCases.loadUserEmailsByTenant` (`users/use-cases/usersUseCases.ts:143-151`) returns
`rows.map((row) => row.loginEmail)` in whatever order `repo.listTenantUsersByIds` returns, and
`listTenantUsersByIds` (`db/repositories/tenantUserRepositoryHydrate.ts:82-90`) runs
`SELECT … WHERE id IN (…)` with **no `ORDER BY`**. Positional mapping `emails[index]` therefore
cannot be trusted to correspond to `withoutContact[index]`.

**Path → consequence.** A task assigned to two contactless users can notify each at the other's
login email — a wrong-person notification and a cross-user email disclosure. The test
(`taskNotificationDeliveryService.test.ts`) masks it by mocking `loadUserEmailsByTenant` to return
emails in input order.

**Fix.** Make the lookup return a `Map<userId, email>` (key by user id, not position), e.g. change
`loadUserEmailsByTenant` to return `Map<string, string>` and drop the positional `byUser` map. Pin
with a test that returns the rows out of input order.

### B2 — Major — bulk status bypasses the scoped-ownership gate

**Evidence.** `services/taskMutationService.ts:135-156`:
```ts
export async function changeTasksBulkStatus(
  tenant, actorId, _canAssignAnywhere, ids, status,
) {
  return withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    const settings = await getTenantTaskSettings();
    const result = await bulkUpdateTaskStatus(tenant, ids, status, actorId);
    …
```
`_canAssignAnywhere` is prefixed-but-unused, and `bulkUpdateTaskStatusBatch`
(`db/repositories/tasksBulkRepository.ts`) has no creator/assignee predicate (it already loads
`createdById` per row, but never checks it). By contrast, single status (`changeTaskStatus`) and
single update (`mutateTask`) both enforce `canActorMutateTask`.

**Path → consequence.** A `tasks.write` (or `tasks.complete`) holder who is neither the creator nor
an assignee of a task can call `POST /api/tasks/bulk-status` and change its status, whereas the same
actor is rejected by `PATCH /api/tasks/:id/status`. This re-opens the M2 "any writer mutates any
task" gap on the bulk path.

**Fix.** Reuse `loadAssignedTaskIds`/`resolveActionableIds` (or `canActorMutateTask` per row) in
`bulkUpdateTaskStatusBatch`: skip (reason `forbidden`) rows the actor neither created nor is assigned
to nor may touch via `assign_anywhere`. Pin with a bulk-status integration case (non-owner → skipped,
owner/assignee/admin → updated).

### B3 — Minor — in-app notification delivery is not idempotent

`deliverTaskNotification` calls `notificationsUseCases.notify(tenant, { kind, …, recipientUserId })`
without a `dedupeKey`. `insertTenantNotification` is `ON CONFLICT DO NOTHING` on
`(workspace_subdomain, dedupe_key)`, so a stable key (e.g. `task-${reason}-${entityId}-${recipientUserId}`)
would make retries no-ops. Today, if the CDC processor delivers and then crashes before marking the
outbox row processed, the retried event inserts a second notification. **Fix:** pass a deterministic
`dedupeKey`.

### B4 — Minor — service imports a route helper

`taskNotificationDeliveryService.ts:14` imports `dispatchMessagingCampaignDirect` from
`routes/tenant/messaging/messagingDirectDispatch.js` — a services→routes dependency. The
`check:backend-structure` ratchet does not flag it (it guards services→`db/repositories`), but it is a
layering smell. **Fix:** relocate `messagingDirectDispatch.ts` to `services/` (or a `messaging/`
module) and update the two dispatch-route callers.

### B5 — Minor — metrics filter logic duplicates `listTasks`

`getTaskMetrics` (`tasksMetricsRepository.ts`) re-implements the status/priority/createdById/due/search
conditions already built in `listTasks` (`tasksRepository.ts`). A shared `buildTaskListConditions(query, subdomain, timezone)` would keep the two in lockstep (a future filter added to one is currently silently missing from the other).

### B6 — Minor — hardcoded English notification copy

`composeTaskMessage` hardcodes the surrounding prose ("You were assigned a task:", "status changed to")
in English; only the task title is tenant-authored. For en/ar/ur/fa tenants the messaging channel will
deliver English. **Fix:** store a localized template (or at minimum a per-locale key) and render at
dispatch time.

### B7 — Minor — `overdue` clock mismatch

`getTaskMetrics` adds `lt(tasks.dueAt, new Date())` (app-server clock) for the `overdue` WHERE filter,
while the `overdue` FILTER aggregate still uses DB `CURRENT_TIMESTAMP`. Under clock skew the "overdue"
KPI can differ from a `?overdue=true` filtered count. **Fix:** compute "now" once and pass it, or use
`CURRENT_TIMESTAMP` consistently.

## 5. Test gaps

| ID | Gap |
| --- | --- |
| T1 | No test exercises the email-fallback **ordering** (B1 is masked by in-order mocks) |
| T2 | No bulk-status ownership deny-case (B2 is unpinned) |
| T3 | No test asserts the in-app notification is deduped on CDC retry (B3) |
| T4 | Messaging dispatch (SMS/WhatsApp) is unit-mocked but not exercised against the real `dispatchMessagingCampaignDirect` + message-log claim path in a DB-integration spec |

## 6. Verified-clean surfaces

- Tenant isolation: every tasks query is workspace-predicated; composite FKs on `parent_task_id`/`faculty_id`/`user_id` carry `workspace_subdomain`; `task_assignees_recipient_active_uidx` prevents duplicate active assignees.
- Scoped ownership on single update/status and single+bulk archive/restore (`canActorMutateTask`, `isAssigned`, `resolveActionableIds`).
- Atomic outbox: `emitTaskNotificationIntents(tx, …)` runs inside the mutation transaction (A5); status orchestration moved to use-cases (A6).
- Subtask barrier on `→ completed` (single + bulk, `forceCompleteSubtasks`).
- Workspace-timezone day bounds for list filters and CSV export (`workspaceDayBounds.ts`).
- Migration `0266` regenerated with snapshot; `db:check` clean.
- Delegation scope CTE and OCC verified against real Postgres (`test:db` 9/9).

## 7. Resolution

| ID | Priority | Change |
| --- | --- | --- |
| B1 | **Fix now** | key emails by user id (Map), not position; add an out-of-order spec |
| B2 | **Fix now** | ownership predicate + `forbidden` skips in `bulkUpdateTaskStatusBatch`; deny-case spec |
| B3 | Follow-up | deterministic `dedupeKey` on the in-app notification |
| B4 | Follow-up | move `messagingDirectDispatch.ts` out of `routes/` |
| B5 | Follow-up | extract shared `buildTaskListConditions` |
| B6 | Follow-up | localize `composeTaskMessage` |
| B7 | Follow-up | single "now" source for the overdue filter |
