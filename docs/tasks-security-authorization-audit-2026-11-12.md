# Task Module — Security, Authorization & Audit Review

> **Scope**: Read-only audit of tenant isolation, role-based access control, and audit logging for the Task module.
> **Branch audited**: `main` · **Date**: 2026-11-12

---

## Table of Contents

1. [Tenant Isolation](#1-tenant-isolation)
2. [Visibility & Role Permissions](#2-visibility--role-permissions)
3. [Audit Logging](#3-audit-logging)
4. [Findings Summary](#4-findings-summary)
5. [Strengths](#5-strengths)

---

## 1. Tenant Isolation

### 1.1 RLS GUC Mechanism

Every task request flows through a layered tenant enforcement stack:

```
authenticate.ts (9-stage)
  └─ requireTenantModule("tasks")           ← all task subrouters
       └─ withTenant(subdomain, tx, fn)
            └─ applyTenantTransactionGuards()
                 ├─ SET LOCAL app.current_tenant = '<subdomain>'
                 ├─ SET LOCAL app.rls_bypass = 'off'
                 └─ SET LOCAL app.current_user_id = '<userId>'
```

**Migration `0001_platform_session_rls.sql`** installs the RLS policy dynamically on every table that has a `workspace_subdomain` column:

```sql
CREATE POLICY tenant_isolation_policy ON <table> FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK ( ... same condition ... );
```

All task tables (`tasks`, `task_assignees`, `task_recipient_scopes`) carry `workspace_subdomain` and are covered by this policy. `FORCE ROW LEVEL SECURITY` is set via the same loop, ensuring the policy applies even to the table owner role.

### 1.2 Fail-Closed Guards

| Guard | Location | Behavior |
|---|---|---|
| `resolveTenantScope` | `tenantScopeGuard.ts` | Throws on `""`, `"undefined"`, `"null"` — no empty-string tenant leaks |
| `rlsRoleGuard` | Boot-time assertion | Verifies DB role is **not** `superuser` / `BYPASSRLS`; refuses to start if assertion fails |
| `requireTenantModule("tasks")` | Registered on ALL task subrouters incl. trash, export | 403 before any handler runs if module not licensed |

The system is **fail-closed**: a missing or malformed tenant string terminates the request, not silently passes it through.

### 1.3 Defense-in-Depth — Explicit `eq(workspaceSubdomain)` Predicates

In addition to PostgreSQL RLS, every query function adds an explicit ORM-level predicate. This provides defense-in-depth if RLS is ever misconfigured:

| Repository function | Guard |
|---|---|
| `listTasks` | `withTenantRead(subdomain)` + `eq(tasks.workspaceSubdomain, subdomain)` |
| `findTaskById` | `withTenantRead(subdomain)` + `eq(tasks.workspaceSubdomain, subdomain)` |
| `createTask` | Inserted with `workspaceSubdomain: subdomain` literal |
| `updateTask` | `WHERE eq(workspaceSubdomain) AND eq(id) AND isNull(deletedAt)` |
| `deleteTask` | `WHERE eq(workspaceSubdomain) AND eq(id)` |
| `restoreTask` | `WHERE eq(workspaceSubdomain) AND eq(id)` |
| `fetchAssigneesByTaskIds` | `WHERE eq(workspaceSubdomain, subdomain)` |
| `syncTaskAssignees` | Delete + insert both scoped to `subdomain` |
| `bulkUpdateTaskStatusBatch` | `WHERE eq(workspaceSubdomain, subdomain)` on every row |
| `bulkDeleteTasksBatch` | `WHERE eq(workspaceSubdomain, subdomain)` |
| `bulkRestoreTasksBatch` | `WHERE eq(workspaceSubdomain, subdomain)` |
| `tasksMetricsRepository` | `withTenantRead(tenant)` + `eq(workspaceSubdomain)` |
| `taskRecipientRepository` (raw SQL) | All CTEs include `workspace_subdomain = ${subdomain}` |

### 1.4 Cross-Tenant Parent Task Prevention

The `tasks` table uses a **composite primary key** `(workspace_subdomain, id)` and the `parentTaskId` FK is `(workspace_subdomain, parent_task_id) → (workspace_subdomain, id)`. This makes cross-tenant parent-child relationships structurally impossible at the database layer — a foreign key violation would occur before any application logic runs.

### 1.5 Cross-Tenant Assignee Injection Prevention

All foreign keys on `task_assignees` include `workspace_subdomain`. Before any assignee is persisted, `taskDelegationService.ts` validates every facultyId against the eligible-assignees set (itself scoped to the tenant). An arbitrary facultyId from a different tenant cannot pass this pre-flight check.

### 1.6 Cross-Tenant Polymorphic Link Prevention

`task_recipient_scopes` CTE queries include `workspace_subdomain = ${subdomain}` on every branch. The `taskRecipientRepository` raw SQL is fully parameterized with no string concatenation.

### 1.7 Audit Trail Immutability — Finding 7 Resolution

`audit_trail_events` does **not** have a `workspace_subdomain` column — it is a platform-wide cross-tenant table by design and correctly has **no RLS policy**.

Immutability is enforced by **migration `0235_audit_trail_immutability.sql`**, which installs a `BEFORE UPDATE OR DELETE` trigger on the table (propagated to all partitions via declarative partitioning):

```sql
CREATE TRIGGER "trg_audit_trail_immutable"
  BEFORE UPDATE OR DELETE ON "audit_trail_events"
  FOR EACH ROW EXECUTE FUNCTION "audit_trail_events_forbid_mutation"();
```

The trigger raises `check_violation` unless `app.allow_audit_purge = 'on'` or `app.allow_hard_purge = 'true'` is set — escape hatches reserved for retention jobs and test isolation.

> [!NOTE]
> The trigger approach is architecturally correct: RLS is per-tenant, but the audit log is intentionally cross-tenant. The immutability guarantee is enforced at the row level, not the access-control level.

> [!WARNING]
> **F-8 (Low)**: The `app.allow_audit_purge` escape hatch is a GUC string that any connection with `SET` privilege can set. If the application DB role has `SET` privilege (typical), a compromised application process could bypass the trigger by setting this GUC before a DELETE. Consider restricting `SET app.allow_audit_purge` to a dedicated retention role only.

---

## 2. Visibility & Role Permissions

### 2.1 Authentication Pipeline (9-Stage)

All task routes pass through `authenticate.ts` before reaching any handler:

1. Extract & verify JWT signature
2. Reject `refresh` or `platform_access` token types on tenant routes
3. Load live tenant record (workspace disabled → 403)
4. Verify `tenantSubdomain` JWT claim matches URL param (mismatch → 401)
5. Load live user record (deleted/disabled → 401)
6. Load live role matrix — **not stale JWT claims**
7. Enforce 2FA if tenant policy requires it
8. Bind tenant + user to async-local-storage request context
9. `requireTenantModule("tasks")` — module license gate

### 2.2 Permission Matrix

| Permission Key | Routes Gated | Enforcement Point |
|---|---|---|
| `tasks.read` | `GET /api/tasks`, `GET /api/tasks/:id`, `GET /api/tasks/metrics`, `GET /api/tasks/eligible-assignees`, `GET /api/tasks/settings` | `requirePermission` pre-handler |
| `tasks.write` | `POST /api/tasks`, `PATCH /api/tasks/:id`, `PATCH /api/tasks/:id/status` | `requirePermission` pre-handler |
| `tasks.assign` | `POST /api/tasks` (with assignees), `PATCH /api/tasks/:id` (with assignees) | `validateTaskDelegation` in service layer |
| `tasks.assign_anywhere` | Same assign routes — bypasses hierarchy scope entirely | `taskDelegationService.ts` |
| `tasks.complete` | `PATCH /api/tasks/:id/status` | `requirePermission` OR `tasks.write` |
| `tasks.delete` | `DELETE /api/tasks/:id`, `POST /api/tasks/bulk-delete`, `POST /api/tasks/bulk-restore`, `GET /api/tasks?includeDeleted=true` | `requirePermission` pre-handler + `includeDeleted` flag gated |
| `settings.global.write` | `PUT /api/tasks/settings` | `requirePermission` pre-handler |

### 2.3 Role Resolution

`taskPermissionService.canPerformTaskAction()` calls `resolveCurrentTenantRole()` which reads the **live role matrix** from the database — not the stale JWT claim. A role change takes effect on the user's next request without requiring token rotation.

### 2.4 Delegation Hierarchy Scope

| `tasks.assign_anywhere` | Scope | Eligible Assignees |
|---|---|---|
| `true` | Unrestricted | All faculty in tenant |
| `false` + `descendants` | Hierarchy depth 20 | Subtree of assigning user |
| `false` + `direct_reports` | Depth 1 | Direct reports only |

`taskDelegationService.validateTaskDelegation()` fetches the eligible set and rejects any `assigneeId` not present in it before the write reaches the repository.

### 2.5 `includeDeleted` Guard

`GET /api/tasks?includeDeleted=true` requires `tasks.delete` permission. Without that permission the flag is silently ignored and soft-deleted tasks are excluded from results. ✅

### 2.6 Finding F-4 — No Private/Team Task Visibility

> [!IMPORTANT]
> **F-4 (Informational)**: The `tasks` table has no `visibility` column. All tasks within a workspace are readable by any user holding `tasks.read` — there is no row-level privacy differentiation (private / team / public) within a tenant. This is a product gap rather than a security vulnerability, but means a user can read tasks assigned exclusively to other users, which may not be the intended UX.

---

## 3. Audit Logging

### 3.1 Audit Trail Architecture

`auditTrailService.recordModernAuditEvent()` produces hash-chained, tamper-evident events:

- **5-dimension hash chain**: `tenantId + tableName + recordId + actorId + hash`
- **Per-shard lock**: `pg_advisory_xact_lock(shardId)` inside the transaction — prevents concurrent chain forks
- **Canonical serialization**: RFC 8785 deterministic JSON before hashing — eliminates key-order tampering
- **PII scrubbing**: `sanitizeAuditState()` strips sensitive fields before the state is stored
- **Subject-state encryption**: Right-to-erasure key rotation without breaking the chain
- **Cross-tenant write guard**: `requestTenant !== subdomain` → throws before any write (application layer)
- **DB-layer immutability**: `trg_audit_trail_immutable` trigger (append-only, as documented in §1.7)

### 3.2 Event Coverage

| Event | Status | Notes |
|---|---|---|
| Task **CREATE** | ✅ Full | `createTask` in `tasksWriteRepository.ts`; `newState: { status, priority, recipients }` |
| Task **UPDATE** (status/priority) | ✅ Full | `updateTask`; `oldState` + `newState` both capture `status`, `priority` |
| Task **UPDATE** (title/dueAt/description) | ⚠️ Partial | `updateTask` records `tableName + recordId + UPDATE` but `oldState/newState` only carry `status`, `priority` — **F-2** |
| Status transition (single) | ✅ Full | Via `updateTask` audit with status in diff |
| Status transition (bulk) | ✅ Full | Per-row `UPDATE` audit in `bulkUpdateTaskStatusBatch` |
| Assignee add/remove | ⚠️ Partial | Parent `updateTask` captures final recipient list in `newState.recipients`; granular add/remove diff at `task_assignees` level absent — **F-1** |
| Task soft-DELETE (single) | ✅ Full | `deleteTask`; `DELETE` audit event |
| Task soft-DELETE (bulk) | ✅ Full | Per-row `DELETE` audit in `bulkDeleteTasksBatch` |
| Task RESTORE (single) | ✅ Full | `restoreTask`; `RESTORE` audit event |
| Task RESTORE (bulk) | ✅ Full | Per-row `RESTORE` audit in `bulkRestoreTasksBatch` |
| Task settings UPDATE | ✅ Full | `updateTenantTaskSettings`; `UPDATE` audit event |
| CSV export queued | ✅ Full | `registerModuleCsvExportRoutes`; `UPDATE` audit event on queue |
| Notification outbox (single task) | ⚠️ Separate TX | `emitTaskNotificationIntents` opens a **new** `withTenant` TX after main commit — **F-3** |
| Notification outbox (bulk) | ⚠️ In-process | `emitTaskBulkStatusNotifications` called after commit, no outbox in TX — **F-5** |

### 3.3 Finding F-1 — `syncTaskAssignees` Missing Granular Audit

> [!WARNING]
> **F-1 (Medium)**: `syncTaskAssignees` in `tasksAssigneesRepository.ts` soft-deletes all existing `task_assignees` rows and inserts the new set without calling `recordModernAuditEvent`. The parent `updateTask` audit captures the final `recipients` list in `newState`, but an auditor cannot determine which specific users were added vs. removed from the diff. For compliance scenarios (who was responsible at time T), this granularity matters.
>
> **Recommended fix**: Call `recordModernAuditEvent` inside `syncTaskAssignees` with `actionType: 'ASSIGN'`, `oldState: { assignees: previousIds }`, `newState: { assignees: nextIds }`.

### 3.4 Finding F-2 — `updateTask` Audit Missing Field Diff for Title/DueAt/Description

> [!WARNING]
> **F-2 (Medium)**: `tasksWriteRepository.updateTask` records:
> ```ts
> oldState: { status: task.status, priority: task.priority }
> newState: { status: updates.status, priority: updates.priority, recipients: ... }
> ```
> A due-date change, title rename, or description edit records a correct `tableName + recordId + UPDATE` row but the `oldState`/`newState` diff carries no field-level evidence of what changed. The hash chain proves the event occurred; it does not prove what value changed.
>
> **Recommended fix**: Expand `oldState`/`newState` to include `{ status, priority, dueAt, title, description }` with `null` sentinels for unchanged fields.

### 3.5 Finding F-3 — Notifications in a Second, Non-Atomic Transaction

> [!CAUTION]
> **F-3 (Medium)**: `taskMutationService.mutateTask` calls `emitTaskNotificationIntents` **after** the main `withTenant` transaction commits. Inside, `emitTaskNotificationIntents` opens a **new** `withTenant(tenant, tx, ...)` block to write outbox events. These are two separate PostgreSQL transactions. If the process crashes, is OOM-killed, or the connection drops between the two commits, the notification outbox event is **permanently lost** — the task is saved correctly, but no notification fires.
>
> The same pattern applies to `emitTaskBulkStatusNotifications`.
>
> **Recommended fix**: Pass the existing `tx` handle into `emitTaskNotificationIntents` and write the outbox INSERT inside the same transaction as the task mutation. This is the standard transactional outbox pattern.

---

## 4. Findings Summary

| ID | Severity | Finding | File(s) |
|---|---|---|---|
| **F-1** | 🟡 Medium | `syncTaskAssignees` emits no audit row — add/remove diff at `task_assignees` level is not captured | `tasksAssigneesRepository.ts` |
| **F-2** | 🟡 Medium | `updateTask` audit `oldState`/`newState` only carries `status`/`priority` — `dueAt`, `title`, `description` changes have no field-level evidence | `tasksWriteRepository.ts` |
| **F-3** | 🟡 Medium | Notification outbox written in a **second transaction** after main task write commits — crash between the two silently drops notifications | `taskMutationService.ts` / `taskNotificationService.ts` |
| **F-4** | ℹ️ Informational | No `visibility` column on `tasks` — all tasks in a workspace are readable by any user with `tasks.read`; no private/team/public differentiation | Schema gap |
| **F-5** | 🟢 Low | `bulkUpdateTaskStatusBatch` notifications emitted in-process after commit; no durable outbox inside the transaction | `tasksBulkRepository.ts` / `taskNotificationService.ts` |
| **F-6** | 🟢 Low | `lockFacultyHierarchy` advisory lock acquired twice per mutation (outer `withTenant` + inner `createTask`/`updateTask`) — harmless but wasteful | `taskMutationService.ts` |
| **F-7** | 🟢 Low | `tasksExportService` ignores the `tenant` parameter passed by the job runner; calls `requireTenant()` from async-storage — job throws (not leaks) if ALS context is absent | `tasksExportService.ts` |
| **F-8** | 🟢 Low | `app.allow_audit_purge` GUC escape hatch on the immutability trigger can be set by any connection with `SET` privilege — consider restricting to a dedicated retention role | `0235_audit_trail_immutability.sql` |

---

## 5. Strengths

The Task module's security posture is strong. The following are verified positive findings:

### Tenant Isolation
- **9-stage auth middleware** covers token type discrimination, 2FA enforcement, workspace-disabled check, and tenant claim mismatch — all before any handler runs.
- **RLS GUC mechanism** (`SET LOCAL app.current_tenant`) ensures the PostgreSQL session is tenant-scoped for the duration of the transaction; `SET LOCAL` rolls back automatically if the transaction aborts.
- **Fail-closed tenant scope guard** (`resolveTenantScope`) throws on empty, `"undefined"`, or `"null"` strings — no silent pass-through.
- **Boot-time DB role assertion** (`rlsRoleGuard`) refuses to start if the application DB role is `superuser` or `BYPASSRLS` — prevents accidental privilege escalation at deploy time.
- **Defense-in-depth**: explicit `eq(workspaceSubdomain)` predicates on all 13 task repository functions, independent of RLS.
- **Composite PKs and FKs** `(workspace_subdomain, id)` on `tasks` and `task_assignees` make cross-tenant parent linking and cross-tenant assignee injection **structurally impossible** at the database layer.
- **Delegation validation** in `taskDelegationService.ts` rejects arbitrary `facultyId` values not in the eligible set before any write.
- **Raw SQL fully parameterized** in `taskRecipientRepository` — no string concatenation, no injection surface.

### Role Permissions
- **Live role resolution** in `canPerformTaskAction` reads the current role matrix from the database — stale JWT claims cannot be used to retain a dropped permission.
- **`includeDeleted` flag** requires `tasks.delete` permission — soft-deleted task disclosure is properly gated.
- **Hierarchy scope enforcement** limits assignee selection to configured subtree depth (1 or 20) unless `tasks.assign_anywhere` is explicitly granted.

### Audit Logging
- **Hash-chained audit trail** with RFC 8785 canonical JSON — insertion order and field values are tamper-evident.
- **Per-shard advisory lock** prevents concurrent writes from forking the chain within the same transaction.
- **`sanitizeAuditState` PII scrubbing** applied before state is stored in the audit chain.
- **Subject-state encryption** supports right-to-erasure key rotation without breaking chain integrity.
- **Application-layer cross-tenant write guard** in `auditTrailService.ts` — `requestTenant !== subdomain` throws before any audit row is written.
- **DB-layer append-only trigger** (`trg_audit_trail_immutable`, migration 0235) — UPDATE and DELETE on `audit_trail_events` raise `check_violation` unless the purge escape hatch is explicitly set by an authorized retention job.
- **Bulk operations produce per-row audit entries** — `bulkUpdateTaskStatusBatch`, `bulkDeleteTasksBatch`, and `bulkRestoreTasksBatch` all call `recordModernAuditEvent` per affected row inside the transaction.
