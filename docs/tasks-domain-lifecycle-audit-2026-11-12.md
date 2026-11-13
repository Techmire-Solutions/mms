# Domain Use Cases & Business Logic Audit: Task Module

This audit reviews the domain use cases, business invariants, dependency validation, transactional boundaries, and architecture structure of the **Task Module** in MMS.

---

## Executive Summary & Architecture Analysis

The task domain logic is distributed across three distinct layers:
1. **HTTP Layer**: [`tasksRoutes.ts`](../apps/backend/src/routes/tenant/tasksRoutes.ts), [`tasksReadRoutes.ts`](../apps/backend/src/routes/tenant/tasksReadRoutes.ts), [`tasksSoftDeleteRoutes.ts`](../apps/backend/src/routes/tenant/tasksSoftDeleteRoutes.ts).
2. **Domain & Services Layer**: [`taskMutationService.ts`](../apps/backend/src/services/taskMutationService.ts), [`taskDelegationService.ts`](../apps/backend/src/services/taskDelegationService.ts), [`taskNotificationService.ts`](../apps/backend/src/services/taskNotificationService.ts), [`tasksUseCases.ts`](../apps/backend/src/tasks/use-cases/tasksUseCases.ts).
3. **Persistence & Integrity Layer**: [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts), [`tasksBulkRepository.ts`](../apps/backend/src/db/repositories/tasksBulkRepository.ts), [`tasksTrashRepository.ts`](../apps/backend/src/db/repositories/tasksTrashRepository.ts).

```
+----------------------------------------------------------------------------------------------------+
|                                     FASTIFY ROUTE HANDLERS                                         |
|  POST /api/tasks           PATCH /api/tasks/:id           PATCH /api/tasks/:id/status (LEAK!)     |
+-----------------------------------+----------------------------------------+-----------------------+
                                    |                                        | Bypasses mutateTask!
                                    v                                        v
                    +-------------------------------+       +------------------------------------+
                    |     taskMutationService       |       |  tasksUseCases.updateTaskStatus   |
                    | (Delegation check + Notify)   |       | (Anemic Proxy -> Repository)      |
                    +---------------+---------------+       +-----------------+------------------+
                                    |                                         |
                                    +--------------------+--------------------+
                                                         |
                                                         v
                                    +-----------------------------------------+
                                    |        tasksWriteRepository             |
                                    |  (Status Invariants, validateParent)    |
                                    +--------------------+--------------------+
                                                         |
                              +--------------------------+--------------------------+
                              |                                                     |
                              v                                                     v
          +---------------------------------------+             +---------------------------------------+
          |             TRANSACTION 1             |             |             TRANSACTION 2             |
          |  INSERT/UPDATE tasks                  |             |  INSERT outbox_events                 |
          |  syncTaskAssignees                    |             |  (SPLIT-BRAIN RISK: Crashes between   |
          |  recordModernAuditEvent               |             |   Tx1 and Tx2 lose notifications!)    |
          +---------------------------------------+             +---------------------------------------+
```

### Critical Findings Matrix

| Focus Area | Severity | Finding | Root Cause | Primary File |
| :--- | :--- | :--- | :--- | :--- |
| **Lifecycle & Invariants** | **HIGH** | Parent tasks can be marked `completed` while child subtasks remain unresolved | No subtask completion barrier in `updateTaskStatus` or `bulkUpdateTaskStatusBatch`. | [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L124-L135) |
| **Lifecycle & Invariants** | **MEDIUM** | Inconsistent Assignee Completion | Marking a task `completed` does not update `completedAt` on `task_assignees` records. | [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L130-L135) |
| **Dependency Graph** | **CRITICAL** | Zero task dependency modeling (`task_dependencies` absent) | No way to model "A blocks B"; circular dependency checks cannot be implemented. | [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts#L23-L46) |
| **Dependency Graph** | **HIGH** | Excessive subtask nesting depth (up to 20 levels) and missing DB self-parent constraint | Recursive CTE caps at 20 levels; table lacks `CHECK (parent_task_id <> id)`. | [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L34-L52) |
| **Transactional Integrity** | **CRITICAL** | Transactional Outbox split-brain on task mutations | Task write and outbox notification emission run in two separate database transactions. | [`taskMutationService.ts`](../apps/backend/src/services/taskMutationService.ts#L28-L60) |
| **Clean Architecture** | **HIGH** | Route handlers leaking domain orchestration | Route handlers manually import services and dispatch notification intents for status changes. | [`tasksRoutes.ts`](../apps/backend/src/routes/tenant/tasksRoutes.ts#L214-L224) |
| **Transactional Integrity** | **HIGH** | Bulk status updates omit outbox events entirely | `bulkUpdateTaskStatusBatch` writes audit logs but never emits outbox events. | [`tasksBulkRepository.ts`](../apps/backend/src/db/repositories/tasksBulkRepository.ts#L208-L254) |

---

## 1. Lifecycle & Invariants Audit

### 1.1 Status Transition Matrix Evaluation

Task statuses and their allowed transitions are defined in `@mms/shared` (`tasksModuleManifest.ts`):
```ts
export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  todo: ["in_progress", "blocked", "cancelled"],
  in_progress: ["in_review", "blocked", "completed", "cancelled"],
  in_review: ["in_progress", "completed", "cancelled"],
  blocked: ["todo", "in_progress", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["todo"],
};
```

#### Transition Invariant Verification

| Current Status | Target Status | Transition Allowed? | Domain Rationale & Invariants |
| :--- | :--- | :--- | :--- |
| `todo` | `completed` | **REJECTED** | Work must be picked up (`in_progress`) or reviewed before completion. |
| `blocked` | `completed` | **REJECTED** | Blocked work must move back to `todo` or `in_progress` first. |
| `completed` | `todo` | **REJECTED** | Reopening completed work must transition to `in_progress` (explicit work re-engagement). |
| `cancelled` | `in_progress`| **REJECTED** | Cancelled tasks must restart from `todo`. |
| `in_progress` | `completed` | **ALLOWED** | Primary happy path. |
| `in_review` | `completed` | **ALLOWED** | Quality review approval path. |

The status state machine is formally verified by `@mms/shared/src/obligations/tasksStatusTransitions.test.ts`.

### 1.2 Broken Invariant: Unresolved Subtasks Barrier

#### The Problem
In [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L124-L135) and [`tasksBulkRepository.ts`](../apps/backend/src/db/repositories/tasksBulkRepository.ts#L200-L205):
When a task transitions to `completed`:
- The code validates `isTaskStatusTransitionAllowed(current.status, "completed")`.
- **It does NOT check whether child subtasks are completed!**

```
                     +----------------------------------------+
                     | Parent Task: "Prepare Accreditation"   |
                     | Status: COMPLETED  <-- ALLOWED!        |
                     +-------------------+--------------------+
                                         |
            +----------------------------+----------------------------+
            |                                                         |
            v                                                         v
+-----------------------+                                 +-----------------------+
| Subtask 1: "Submit"   |                                 | Subtask 2: "Review"   |
| Status: TODO (Active) |                                 | Status: BLOCKED       |
+-----------------------+                                 +-----------------------+
```

A user can mark a parent task as `completed` while multiple subtasks remain in `todo`, `in_progress`, or `blocked` states. This leaves active work stranded under a completed parent.

#### Recommended Invariant Rule
Before transitioning a task to `completed`, query whether active, uncompleted subtasks exist. Unless an explicit override flag (`forceCompleteSubtasks: true`) is provided, reject the transition with a `ConflictError`:

```ts
if (data.status === "completed" && !data.forceCompleteSubtasks) {
  const [unresolvedChild] = await tx
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceSubdomain, subdomain),
        eq(tasks.parentTaskId, id),
        isNull(tasks.deletedAt),
        notInArray(tasks.status, ["completed", "cancelled"]),
      ),
    )
    .limit(1);

  if (unresolvedChild) {
    throw new ConflictError(
      `Cannot complete task while subtask "${unresolvedChild.title}" is unresolved. Resolve subtasks or override.`
    );
  }
}
```

### 1.3 Assignee Lifecycle State Inconsistency

The table `task_assignees` contains a `completed_at` column:
```ts
// tasksTables.ts
completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" })
```
However, in [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L130-L135) and `updateTaskStatus`:
- When `tasks.status` is updated to `completed`, `tasks.completedAt` is updated to `now()`.
- **`task_assignees.completed_at` is never updated.**
- Conversely, when a task is reopened (`completed -> in_progress`), `tasks.completedAt` is cleared to `null`, but if any assignee had a timestamp, it is desynchronized.
- **Fix**: Synchronize `task_assignees.completed_at` whenever the parent task's completion status transitions.

### 1.4 Soft-Delete (Archive) Invariants

In [`tasksTrashRepository.ts`](../apps/backend/src/db/repositories/tasksTrashRepository.ts#L17-L28):
```ts
const children = await tx
  .select({ id: tasks.id })
  .from(tasks)
  .where(
    and(
      eq(tasks.workspaceSubdomain, tenant),
      eq(tasks.parentTaskId, id),
      isNull(tasks.deletedAt),
    ),
  )
  .limit(1);
if (children.length) throw new ConflictError("Task has active subtasks");
```
- **Positive Invariant**: An active parent cannot be archived if it has active child subtasks.
- **Gap**: A task can be archived directly from `in_progress` without first being `completed` or `cancelled`. The task disappears from work-lists without resolving the work lifecycle or recording why it was abandoned.

---

## 2. Dependency Graph & Hierarchy Validation

### 2.1 Subtask Hierarchy & Nesting Depth Limits

Hierarchy validation is handled in [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L26-L52) via `validateParent`:

```sql
WITH RECURSIVE chain AS (
  SELECT id, parent_task_id AS parent_id, ARRAY[id] AS path, FALSE AS cycle, 0 AS depth
  FROM tasks WHERE workspace_subdomain = ${tenant} AND id = ${parent} AND deleted_at IS NULL
  UNION ALL
  SELECT p.id, p.parent_task_id, array_append(c.path, p.id), p.id = ANY(c.path), c.depth + 1
  FROM chain c JOIN tasks p ON p.id = c.parent_id
  WHERE p.workspace_subdomain = ${tenant} AND p.deleted_at IS NULL AND NOT c.cycle AND c.depth < 20
) SELECT id, parent_id, cycle FROM chain
```

#### Defect 1: Excessive Depth Limit (20 Levels)
The recursive query allows subtask trees to nest up to **20 levels deep**.
- In operational management (e.g. Jira, Linear, Asana), subtasks are strictly limited to **1 or 2 levels** (Task -> Subtask).
- Allowing 20 levels leads to severe UI layout collapse, unreadable indentation, complex recursive joins, and potential stack overflows in frontend tree viewers.
- **Recommendation**: Restrict subtask nesting to a maximum depth of **2** (e.g., `c.depth < 2` or `c.depth < 3`).

#### Defect 2: Missing Self-Parent Database Check Constraint
In `0134_organization_positions_and_tasks.sql`:
- `organization_locations` enforces:
  `CHECK ("parent_location_id" IS NULL OR "parent_location_id" <> "id")`
- `organization_positions` enforces:
  `CHECK ("parent_position_id" IS NULL OR "parent_position_id" <> "id")`
- **`tasks` does not have this constraint.**
- If `parentTaskId === id` is passed directly or created in raw queries, it is only caught if `validateParent` executes. The database schema itself allows self-referencing rows.

### 2.2 Complete Absence of Task Dependency Modeling

The user request specifies:
> *"Check parent-child subtask nesting limits and task dependency rules to ensure circular references (A blocks B, B blocks A) are strictly rejected."*

#### Finding: Zero Dependency System
In the existing codebase:
- There is **no table, entity, repository, or service** representing task dependencies (e.g., `predecessorTaskId`, `successorTaskId`, `dependencyType`).
- A task can only have a scalar status `blocked`.
- The system cannot record:
  - What task is blocking Task B.
  - What tasks are dependent on Task A.
  - Finish-to-Start (FS), Start-to-Start (SS), or Start-to-Finish (SF) constraints.

#### Recommended Dependency Graph & Cycle Detection Architecture
To satisfy the domain requirement, introduce a `task_dependencies` entity and enforce cycle prevention using depth-first search or recursive SQL:

```ts
export async function validateNoDependencyCycle(
  tx: TenantTransaction,
  tenant: string,
  predecessorId: string,
  successorId: string,
): Promise<void> {
  if (predecessorId === successorId) {
    throw new ValidationError("A task cannot depend on itself");
  }

  // Check if successorId already precedes predecessorId (cycle detection)
  const result = await tx.execute<{ cycle: boolean }>(sql`
    WITH RECURSIVE dep_path AS (
      SELECT predecessor_task_id, successor_task_id, ARRAY[predecessor_task_id] AS visited
      FROM task_dependencies
      WHERE workspace_subdomain = ${tenant} AND predecessor_task_id = ${successorId}
      UNION ALL
      SELECT d.predecessor_task_id, d.successor_task_id, array_append(p.visited, d.predecessor_task_id)
      FROM task_dependencies d
      JOIN dep_path p ON d.predecessor_task_id = p.successor_task_id
      WHERE d.workspace_subdomain = ${tenant} AND NOT (d.successor_task_id = ANY(p.visited))
    )
    SELECT EXISTS (
      SELECT 1 FROM dep_path WHERE successor_task_id = ${predecessorId}
    ) AS cycle;
  `);

  if (result.rows[0]?.cycle) {
    throw new ConflictError("Circular task dependency detected (A blocks B and B blocks A)");
  }
}
```

---

## 3. Transactional Integrity & Boundaries

### 3.1 Transactional Outbox Split-Brain Anomaly

In [`taskMutationService.ts`](../apps/backend/src/services/taskMutationService.ts#L28-L60):

```ts
export async function mutateTask(...) {
  const previous = mutation.kind === "update" ? await findTaskById(tenant, mutation.id) : null;

  // TRANSACTION 1: Mutation (Tasks, Assignees, Audit)
  const next = await withTenant(tenant, async (tx) => {
    await lockFacultyHierarchy(tx, tenant);
    ...
    if (mutation.kind === "create") {
      return createTask(tenant, mutation.data, delegation.resolvedAssignees, actorId);
    }
    return updateTask(tenant, mutation.id, ...);
  });

  // TRANSACTION 2: Outbox Notification Intent
  if (next) {
    const settings = await getTenantTaskSettings();
    await emitTaskNotificationIntents({
      tenant,
      settings,
      actorUserId: actorId,
      previous,
      next,
    });
  }
  return next;
}
```

And in [`taskNotificationService.ts`](../apps/backend/src/services/taskNotificationService.ts#L37-L64):
```ts
await withTenant(tenant, async (tx) => {
  if (shouldNotifyAssignment) {
    await emitOutboxEvent(tx, "task.assigned", ...);
  }
  if (shouldNotifyStatus && creatorId) {
    await emitOutboxEvent(tx, "task.status_changed", ...);
  }
});
```

#### Why This Violates the Transactional Outbox Pattern
The Transactional Outbox Pattern relies on inserting domain events into `outbox_events` **inside the exact same database transaction** that modifies the domain entity.
Here, two separate transactions are executed:
1. `Transaction 1` modifies `tasks`, updates assignees, and writes audit records, then **commits**.
2. If Node.js terminates (OOM, container redeployment, network disconnect, SIGTERM) between line 49 and 53, `Transaction 2` is never initiated.
3. The database state is updated, but **zero outbox events are generated**. Downstream consumers (push notifications, SMS, emails, websocket relays) are never notified.
4. If `Transaction 2` fails due to a database deadlock or timeout, the task mutation cannot be rolled back because it has already committed.

**Remediation**:
Pass the active transaction `tx` into `emitTaskNotificationIntents` so that `emitOutboxEvent` runs inside `Transaction 1`:

```ts
// Inside withTenant:
const next = await withTenant(tenant, async (tx) => {
  ...
  const task = mutation.kind === "create" 
    ? await createTask(tx, tenant, ...)
    : await updateTask(tx, tenant, ...);

  await emitTaskNotificationIntents(tx, {
    tenant,
    settings,
    actorUserId: actorId,
    previous,
    next: task,
  });

  return task;
});
```

### 3.2 Domain Logic Leaking into Fastify Route Handlers

Clean Architecture mandates that HTTP route handlers only parse inputs, verify request-level authentication, delegate to domain use cases, and serialize HTTP responses.

In [`tasksRoutes.ts`](../apps/backend/src/routes/tenant/tasksRoutes.ts#L176-L267), domain orchestration leaks directly into route controllers:

#### Leak 1: `/api/tasks/:id/status`
```ts
// tasksRoutes.ts lines 196-224
updated = await updateTaskStatus(tenant, request.params.id, parsed.data.status, user.id, ...);
...
const settings = await getTenantTaskSettings();
const { emitTaskNotificationIntents } =
  await import("../../services/taskNotificationService.js");
await emitTaskNotificationIntents({
  tenant,
  settings,
  actorUserId: user.id,
  previous,
  next: updated,
});
```

#### Leak 2: `/api/tasks/bulk-status`
```ts
// tasksRoutes.ts lines 242-261
result = await bulkUpdateTaskStatus(tenant, parsed.data.ids, parsed.data.status, user.id);
...
if (result.changes.length > 0) {
  const settings = await getTenantTaskSettings();
  const { emitTaskBulkStatusNotifications } =
    await import("../../services/taskNotificationService.js");
  await emitTaskBulkStatusNotifications({
    tenant,
    settings,
    actorUserId: user.id,
    changes: result.changes,
  });
}
```

#### Impact of Domain Leakage:
1. **Broken Encapsulation**: A caller invoking `updateTaskStatus` or `bulkUpdateTaskStatus` from a background worker, seed script, or domain service receives no notifications because the notification logic lives inside the Fastify handler.
2. **Inconsistent Mutators**: `POST /api/tasks` and `PATCH /api/tasks/:id` delegate to `mutateTask`, while `PATCH /api/tasks/:id/status` bypasses `mutateTask` and calls the repository directly.

### 3.3 Bulk Status Updates Omit Outbox Events

In [`tasksBulkRepository.ts`](../apps/backend/src/db/repositories/tasksBulkRepository.ts):
- `bulkDeleteTasksBatch` calls `await emitOutboxEvents(...)` for `"entity.soft_deleted"`.
- `bulkRestoreTasksBatch` calls `await emitOutboxEvents(...)` for `"entity.restored"`.
- **`bulkUpdateTaskStatusBatch` NEVER calls `emitOutboxEvents`!**
- It records audit rows in `audit_trail_events`, but leaves `outbox_events` empty.
- When 100 tasks are updated in bulk, zero outbox events are stored in the database transaction.

### 3.4 CSV Task Import Transactional Strategy

In [`taskImportUseCases.ts`](../apps/backend/src/tasks/use-cases/taskImportUseCases.ts#L98-L138):
- `runTasksImportJob` iterates over each CSV row and calls `mutateTask` sequentially.
- **Behavior**: Every single row executes its own independent transaction and advisory lock acquisition.
- **Failure Model**: If row 250 of 500 fails, rows 1 through 249 are committed, while the remaining rows fail.
- **Trade-off**: This design prioritizes partial success over atomic rollback ("A bad row fails alone; valid rows still import"). While acceptable for bulk user imports, there is no option for an **all-or-nothing transactional import** (`rollbackOnError: true`), which is required for batch data migrations and automated course setup.

---

## 4. Anemic Use Cases & Layering Recommendations

[`tasksUseCases.ts`](../apps/backend/src/tasks/use-cases/tasksUseCases.ts) currently acts as an anemic pass-through proxy to repository functions:
```ts
export function createTasksUseCases(repo: TasksRepository = tasksRepositoryAdapter) {
  return {
    listTasks: repo.listTasks,
    findTaskById: repo.findTaskById,
    createTask: repo.createTask,
    updateTask: repo.updateTask,
    updateTaskStatus: repo.updateTaskStatus,
    ...
  };
}
```

### Proposed Refactored Use Case Layer

Unify task mutations into cohesive domain use cases where validation, execution, audit logging, and outbox event emissions execute atomically:

```ts
// tasks/use-cases/updateTaskStatusUseCase.ts
export async function updateTaskStatusUseCase(input: {
  tenant: string;
  taskId: string;
  newStatus: TaskStatus;
  actorUserId: string;
  expectedVersion?: number;
  forceCompleteSubtasks?: boolean;
}): Promise<TaskRecord> {
  return withTenant(input.tenant, async (tx) => {
    const current = await tasksRepo.findById(tx, input.tenant, input.taskId);
    if (!current) throw new NotFoundError("Task not found");

    // 1. Invariant check: Status transition matrix
    if (!isTaskStatusTransitionAllowed(current.status, input.newStatus)) {
      throw new ValidationError(`Cannot transition from ${current.status} to ${input.newStatus}`);
    }

    // 2. Invariant check: Unresolved subtasks blocking completion
    if (input.newStatus === "completed" && !input.forceCompleteSubtasks) {
      await assertAllSubtasksResolved(tx, input.tenant, input.taskId);
    }

    // 3. Invariant check: Unresolved dependencies blocking completion
    await assertAllBlockersResolved(tx, input.tenant, input.taskId);

    // 4. Persistence update with OCC versioning
    const updated = await tasksRepo.updateStatus(tx, input.tenant, input.taskId, {
      status: input.newStatus,
      expectedVersion: input.expectedVersion,
      actorUserId: input.actorUserId,
    });

    // 5. Atomic Outbox Event in the SAME transaction
    await outboxRepo.emit(tx, "task.status_changed", {
      entityId: updated.id,
      previousStatus: current.status,
      newStatus: updated.status,
      actorUserId: input.actorUserId,
      creatorId: updated.createdById,
    });

    // 6. Audit Trail in the SAME transaction
    await auditRepo.record(tx, {
      actionType: "STATUS_UPDATE",
      recordId: updated.id,
      oldState: { status: current.status },
      newState: { status: updated.status },
    });

    return updated;
  });
}
```

---

## Actionable Remediation Checklist

1. **Enforce Subtask Completion Barrier**:
   - In `tasksWriteRepository.ts` and `bulkUpdateTaskStatusBatch`, verify that child subtasks are resolved (`completed` or `cancelled`) before allowing a parent task to transition to `completed`.
2. **Eliminate Transactional Outbox Split-Brain**:
   - Refactor `mutateTask` and `emitTaskNotificationIntents` to accept and execute inside a single continuous `tx` transaction.
3. **Encapsulate Route Handlers**:
   - Move notification intent emission from [`tasksRoutes.ts`](../apps/backend/src/routes/tenant/tasksRoutes.ts#L214-L260) into dedicated domain use cases (`updateTaskStatusUseCase` and `bulkUpdateTaskStatusUseCase`).
4. **Implement Task Dependency Graph & Cycle Detection**:
   - Create the `task_dependencies` table and implement recursive cycle detection to ensure $A \rightarrow B$ and $B \rightarrow A$ are strictly rejected.
5. **Tighten Subtask Nesting Limits**:
   - Reduce recursive CTE depth check from `c.depth < 20` to `c.depth < 2` or `3`, and add a database check constraint `CHECK (parent_task_id IS NULL OR parent_task_id <> id)`.
6. **Synchronize Assignee Completion Timestamps**:
   - Update `task_assignees.completed_at` when a task transitions to `completed`, and reset it when reopened.
