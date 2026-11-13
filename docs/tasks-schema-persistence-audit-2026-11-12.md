# Database Schema & Persistence Layer Review: Task Module

This audit reviews the database schema definitions, persistence layer, Drizzle ORM patterns, constraints, and migration history for the **Task Module** in MMS.

---

## Executive Summary & Architecture Overview

The Task module was introduced in migration `0134_organization_positions_and_tasks.sql` and subsequently updated in `0135`, `0136`, and `0137`. The persistence architecture comprises:
- Core tables: `tasks`, `task_assignees`, and `task_module_preferences`.
- Repositories: `tasksRepository.ts`, `tasksWriteRepository.ts`, `tasksAssigneesRepository.ts`, `tasksTrashRepository.ts`, `tasksBulkRepository.ts`, and `tasksMetricsRepository.ts`.
- Multitenancy: Enforced via PostgreSQL Row-Level Security (`workspace_subdomain = current_setting('app.current_tenant', true)`), composite primary keys `[workspace_subdomain, id]`, and foreign keys referencing `workspaces.subdomain`.

```
+----------------------------------------------------------------------------------------------------+
|                                    Workspaces (subdomain)                                          |
+-------------------------------------------------+--------------------------------------------------+
                                                  | 1:N
                                                  v
                     +-------------------------------------------------------+
                     |                 tasks                                 |
                     |  PK: [workspace_subdomain, id]                        |
                     |  FK: parent_task_id -> tasks(workspace_subdomain, id)   |
                     +---------------------------+---------------------------+
                                                 | 1:N
                                                 v
                     +-------------------------------------------------------+
                     |              task_assignees                           |
                     |  PK: [workspace_subdomain, id]                        |
                     |  FK: task_id -> tasks(workspace_subdomain, id)        |
                     |  FK: faculty_id -> faculty                            |
                     |  FK: user_id -> tenant_users                          |
                     +-------------------------------------------------------+
```

### Critical Findings Matrix

| Dimension | Severity | Issue | Impact | Primary File |
| :--- | :--- | :--- | :--- | :--- |
| **Indexes & Query Paths** | **HIGH** | Missing composite index on `(workspace_subdomain, created_at DESC)` and `(workspace_subdomain, status, due_at)` | Every default work-list query triggers a table scan and memory/disk sort (`Sort` / `Top-N Sort`). | [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts#L50-L69) |
| **Indexes & Query Paths** | **HIGH** | In-memory ID array passing (`inArray(tasks.id, ids)`) during assignee filtering | Loads unbounded task IDs into Node.js heap memory, resulting in oversized SQL `IN (...)` parameters. | [`tasksRepository.ts`](../apps/backend/src/db/repositories/tasksRepository.ts#L104-L123) |
| **Indexes & Query Paths** | **MEDIUM** | Missing polymorphic columns (`entity_type`, `entity_id`) or junction table | Tasks cannot be associated with Students, Admissions, or Finance records. | [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts#L23-L46) |
| **Hierarchy & Ordering** | **HIGH** | No `sort_order` or fractional rank (LexoRank) column for Kanban board positioning | Kanban board columns cannot maintain custom user ordering without `O(N)` updates. | [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts#L23-L46) |
| **Hierarchy & Ordering** | **MEDIUM** | No lightweight checklist table; missing task dependency tracking (`task_dependencies`) | Simple checklist items bloat the main tasks table; blocker relationships cannot be queried. | [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts#L23-L46) |
| **Concurrency & Integrity** | **CRITICAL** | Global Advisory Lock (`lockFacultyHierarchy`) on all task mutations | Serializes all task edits and status changes tenant-wide, blocking unrelated concurrent users. | [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L32) |
| **Concurrency & Integrity** | **HIGH** | Opt-in Timestamp OCC instead of mandatory integer versioning (`occ_version`) | Bypassed when header is omitted; microsecond timestamp truncation causes lost updates. | [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L140-L161) |
| **Concurrency & Integrity** | **HIGH** | Soft delete does not cascade to `task_assignees` | Deleting a task leaves orphaned active assignee rows with `deleted_at IS NULL`. | [`tasksTrashRepository.ts`](../apps/backend/src/db/repositories/tasksTrashRepository.ts#L30-L35) |
| **Drizzle Anti-Patterns** | **MEDIUM** | Omission of Drizzle ORM Relations definitions | Missing `relations(tasks, ...)` forces verbose manual joins and prevents Relational Queries. | [`schema/relations/`](../apps/backend/src/db/schema/relations) |

---

## 1. Indexes & Query Paths

### 1.1 "My Tasks" View & Multi-Predicate Indexing

The primary view accessed by staff and administrators is "My Tasks" (`useTasksWorkTabFilters.ts`), querying tasks assigned to the current user with open statuses (`todo`, `in_progress`, `in_review`, `blocked`), ordered chronologically.

#### The In-Memory Subquery Anti-Pattern
In [`tasksRepository.ts`](../apps/backend/src/db/repositories/tasksRepository.ts#L104-L123):
```ts
if (query.assignedToFacultyId || query.assignedToUserId) {
  const assigneeConditions = [
    eq(taskAssignees.workspaceSubdomain, subdomain),
    isNull(taskAssignees.deletedAt),
  ];
  if (query.assignedToFacultyId) {
    assigneeConditions.push(eq(taskAssignees.facultyId, query.assignedToFacultyId));
  }
  if (query.assignedToUserId) {
    assigneeConditions.push(eq(taskAssignees.userId, query.assignedToUserId));
  }
  const matched = await tx
    .select({ taskId: taskAssignees.taskId })
    .from(taskAssignees)
    .where(and(...assigneeConditions));
  const ids = matched.map((m) => m.taskId);
  if (ids.length === 0) return { tasks: [], total: 0 };
  conditions.push(inArray(tasks.id, ids));
}
```

**Defects**:
1. **Unbounded Heap Allocation**: If a user is assigned to 1,500 tasks over time, all 1,500 IDs are serialized from Postgres into Node.js heap memory, mapped into an array, and then re-sent over the wire in an `IN ($1, $2, ..., $1500)` predicate.
2. **Postgres Planner Inefficiency**: Large `IN (...)` lists defeat index-only plans, generate large query execution trees, and typically cause Postgres to fall back to a Bitmap Heap Scan or Seq Scan.
3. **Missing Covering Index on `task_assignees`**:
   The index `task_assignees_user_active_idx` is indexed solely on `(workspace_subdomain, user_id) WHERE deleted_at IS NULL`. It does not include `task_id`. Therefore, Postgres must perform a heap fetch for every matching row instead of an **Index-Only Scan**.

**Fix**:
Replace the two-step application-level join with a SQL `EXISTS` subquery or direct `INNER JOIN`, supported by a composite covering index.

```ts
// In tasksRepository.ts: Single query via EXISTS
if (query.assignedToFacultyId || query.assignedToUserId) {
  conditions.push(
    exists(
      tx
        .select({ one: sql`1` })
        .from(taskAssignees)
        .where(
          and(
            eq(taskAssignees.workspaceSubdomain, tasks.workspaceSubdomain),
            eq(taskAssignees.taskId, tasks.id),
            isNull(taskAssignees.deletedAt),
            query.assignedToUserId ? eq(taskAssignees.userId, query.assignedToUserId) : undefined,
            query.assignedToFacultyId ? eq(taskAssignees.facultyId, query.assignedToFacultyId) : undefined,
          ),
        ),
    ),
  );
}
```

### 1.2 Default Sort Index Deficiency on `tasks`

Every invocation of `listTasks` specifies:
```ts
.orderBy(desc(tasks.createdAt))
.limit(query.limit)
.offset(query.offset)
```
In [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts#L50-L69), the only indexes defined on `tasks` are:
- `tasks_status_active_idx`: `(workspaceSubdomain, status) WHERE deletedAt is null`
- `tasks_priority_active_idx`: `(workspaceSubdomain, priority) WHERE deletedAt is null`
- `tasks_due_at_active_idx`: `(workspaceSubdomain, dueAt) WHERE deletedAt is null`
- `tasks_parent_task_active_idx`: `(workspaceSubdomain, parentTaskId) WHERE deletedAt is null`
- `tasks_deleted_idx`: `(workspaceSubdomain, deletedAt) WHERE deletedAt is not null`

**None of these indexes index `created_at`**.
Whenever tasks are listed with status filters (`statuses=todo,in_progress`), Postgres must retrieve all matching candidate rows and execute a sort in `work_mem`. On a tenant with tens of thousands of tasks, this introduces high latency and buffer churn.

### 1.3 Missing Creator and Overdue Indexing

- **Creator Filter (`query.createdById`)**: There is no index on `created_by_user_id`. Filtering by creator requires a table scan of all tenant records.
- **Overdue Calculations (`tasks/metrics`)**: The metrics query filters on:
  ```sql
  WHERE workspace_subdomain = $1 AND deleted_at IS NULL
    AND due_at < CURRENT_TIMESTAMP AND status NOT IN ('completed', 'cancelled')
  ```
  Neither index `tasks_status_active_idx` nor `tasks_due_at_active_idx` alone can service this range scan without bitmap intersection and subsequent heap lookups.

### 1.4 Polymorphic Record Association Gaps

In educational institutions, tasks are frequently tethered to specific domain entities:
- A follow-up task on a **Student record** (e.g., student disciplinary review).
- An onboarding task on a **Faculty record**.
- A collection reminder on an **Invoice / Fee Schedule**.

Currently, `tasks` contains zero polymorphic columns:
```ts
// Existing tasks table columns:
id, workspaceSubdomain, title, description, status, priority,
startDate, dueAt, parentTaskId, createdByUserId, assignedByUserId, ...
```
There is no `entity_type` or `entity_id`.

**Recommendation**: Add composite polymorphic columns with a partial index or introduce a `task_entity_links` table:
```sql
ALTER TABLE tasks ADD COLUMN entity_type varchar(64);
ALTER TABLE tasks ADD COLUMN entity_id text;

CREATE INDEX tasks_entity_active_idx
  ON tasks (workspace_subdomain, entity_type, entity_id)
  WHERE deleted_at IS NULL AND entity_type IS NOT NULL;
```

---

## 2. Hierarchy & Ordering

### 2.1 Self-Referencing Subtasks vs. Checklist Items

`tasks` implements subtasks via `parentTaskId`:
```ts
foreignKey({
  columns: [table.workspaceSubdomain, table.parentTaskId],
  foreignColumns: [table.workspaceSubdomain, table.id],
}).onDelete("cascade")
```

#### Hierarchy Cycle Detection
In [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L34-L52), `validateParent` uses a recursive CTE:
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
This protects against self-referencing loops up to depth 20. However:
- **No Progress Rollup**: The parent task table does not track `subtask_count` or `completed_subtask_count`. Computing subtask completion requires subqueries or dynamic counting on read.
- **Absence of a Lightweight Checklist Entity**: A full `tasks` row carries 20 columns, tenant checks, audit records, outbox events, and foreign key validations. When users simply need a checklist for a task (e.g. "Check transcripts", "Call guardian", "Issue card"), modeling each item as a full `tasks` row creates significant database overhead.

**Recommended Schema for Lightweight Checklists**:
```sql
CREATE TABLE task_checklists (
  id                  text NOT NULL,
  workspace_subdomain text NOT NULL,
  task_id             text NOT NULL,
  title               varchar(255) NOT NULL,
  is_completed        boolean NOT NULL DEFAULT false,
  sort_order          integer NOT NULL DEFAULT 0,
  completed_at        timestamptz,
  completed_by_user_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_checklists_pk PRIMARY KEY (workspace_subdomain, id),
  CONSTRAINT task_checklists_task_fk FOREIGN KEY (workspace_subdomain, task_id)
    REFERENCES tasks(workspace_subdomain, id) ON DELETE CASCADE
);
CREATE INDEX task_checklists_task_idx ON task_checklists (workspace_subdomain, task_id, sort_order);
```

### 2.2 Task Dependencies ("Blocked By" / "Blocks")

While `tasks.status` permits `'blocked'`, the schema lacks a `task_dependencies` junction table.

```
+---------------+                +--------------------+                +---------------+
| Task A (Pre)  | <------------- | task_dependencies  | -------------> | Task B (Post) |
| (status=todo) |                | (dependency_type)  |                | status=blocked|
+---------------+                +--------------------+                +---------------+
```

Without this table:
1. It is impossible to declare *which* task is blocking another.
2. When Task A completes, the database cannot automatically evaluate whether Task B should transition from `blocked` to `todo`.
3. Cycle detection between interdependent tasks cannot be enforced.

**Recommended Schema**:
```sql
CREATE TABLE task_dependencies (
  id                    text NOT NULL,
  workspace_subdomain   text NOT NULL,
  predecessor_task_id   text NOT NULL,
  successor_task_id     text NOT NULL,
  dependency_type       varchar(32) NOT NULL DEFAULT 'finish_to_start',
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_dependencies_pk PRIMARY KEY (workspace_subdomain, id),
  CONSTRAINT task_dependencies_no_self_check CHECK (predecessor_task_id <> successor_task_id),
  CONSTRAINT task_dependencies_pred_fk FOREIGN KEY (workspace_subdomain, predecessor_task_id)
    REFERENCES tasks(workspace_subdomain, id) ON DELETE CASCADE,
  CONSTRAINT task_dependencies_succ_fk FOREIGN KEY (workspace_subdomain, successor_task_id)
    REFERENCES tasks(workspace_subdomain, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX task_dependencies_active_uidx 
  ON task_dependencies (workspace_subdomain, predecessor_task_id, successor_task_id);
```

### 2.3 Kanban Board Positioning & Fractional Indexing

In Kanban boards, tasks are arranged in status columns and manually ordered by users.
- In `0134_organization_positions_and_tasks.sql`, `organization_locations` and `organization_positions` both contain `sort_order integer NOT NULL DEFAULT 0`.
- **`tasks` was created without any ordering or position column.**
- The UI is forced to display tasks strictly by `createdAt DESC`.

#### Why Integer `sortOrder` Fails on Kanban Boards
If an integer `sort_order` is used, moving a card between position 2 and 3 requires re-indexing subsequent cards:
```sql
UPDATE tasks SET sort_order = sort_order + 1
WHERE workspace_subdomain = $1 AND status = 'in_progress' AND sort_order >= 3;
```
This causes:
1. Row lock contention across dozens or hundreds of rows in the same column.
2. Deadlocks under concurrent card moves.
3. Excessive write amplification and cache invalidations.

#### Fractional Indexing / LexoRank Solution
Store a deterministic sort key as a string (e.g. LexoRank / mid-point string `varchar(64)`):
- Between `"a"` and `"c"`, the new card is assigned `"b"`.
- Moving a card is an `O(1)` update affecting only the single dragged row.

```sql
ALTER TABLE tasks ADD COLUMN kanban_position varchar(64) NOT NULL DEFAULT '0|hzzzzz:';
CREATE INDEX tasks_kanban_idx ON tasks (workspace_subdomain, status, kanban_position) WHERE deleted_at IS NULL;
```

---

## 3. Concurrency & Integrity

### 3.1 Advisory Lock Concurrency Bottleneck

In [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L32), [`tasksTrashRepository.ts`](../apps/backend/src/db/repositories/tasksTrashRepository.ts#L16), and [`tasksBulkRepository.ts`](../apps/backend/src/db/repositories/tasksBulkRepository.ts#L44):
```ts
await lockFacultyHierarchy(tx, tenant);
```
Where `lockFacultyHierarchy` executes:
```sql
SELECT pg_advisory_xact_lock(hashtextextended(${`faculty:${tenant}`}, 0));
```

#### Problem Analysis
This acquires an exclusive transactional advisory lock across the **entire tenant's faculty hierarchy**.
- **Every** single task creation, status update, title change, soft-delete, restore, or bulk status change acquires this global lock.
- If Teacher A updates the status of Task 1 to `"in_progress"`, and Teacher B simultaneously completes Task 2, Teacher B's transaction is blocked until Teacher A commits.
- Worse, any concurrent faculty assignment update (`validateFacultyAssignment`) also takes this lock.
- Tasks are ordinary work items; taking a global lock intended for faculty tree restructuring during everyday task updates introduces a severe system-wide throughput bottleneck.

**Fix**:
Remove `lockFacultyHierarchy` from normal task CRUD operations. If delegation validation against the faculty tree is needed, validate the target assignee with `SELECT ... FOR SHARE` on the specific `faculty_assignments` record, or only take the advisory lock during designation hierarchy restructuring.

### 3.2 Optimistic Concurrency Control (OCC) Flaws

Current OCC implementation in [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts#L112-L161):
```ts
const versionToken = expectedUpdatedAt?.trim();
const expectedDate = versionToken ? new Date(versionToken) : null;
...
const versionPredicate = expectedDate
  ? or(
      sql`date_trunc('milliseconds', ${tasks.updatedAt}) = ${naiveTimestamp(expectedDate)}::timestamp`,
      sql`date_trunc('milliseconds', ${tasks.updatedAt}) = ${expectedDate}::timestamptz`,
    )
  : undefined;

const updatedRows = await tx
  .update(tasks)
  .set(payload)
  .where(
    and(
      eq(tasks.workspaceSubdomain, subdomain),
      eq(tasks.id, id),
      isNull(tasks.deletedAt),
      versionPredicate,
    ),
  )
  .returning({ id: tasks.id });

if (updatedRows.length === 0 && expectedDate) {
  throw new ConflictError("This task was changed by someone else. Reload it and try again.");
}
```

#### Deficiencies:
1. **OCC is Optional**: If a client does not send the `x-expected-updated-at` header, `expectedDate` is null and `versionPredicate` is omitted. The update silently overwrites concurrent changes without conflict detection.
2. **Timestamp Precision & Timezone Fragility**:
   - PostgreSQL `timestamptz` stores microsecond timestamps (e.g. `2026-11-12 10:15:30.123456+00`).
   - JavaScript `Date` only has millisecond resolution (`.toISOString()` truncates to 3 decimal digits: `.123Z`).
   - The repository attempts to bypass this with `date_trunc('milliseconds', ...)`, which prevents index usage and can still cause false conflict matches or undetected race conditions if two updates occur within the same millisecond.
3. **No Integer Version Counter**:
   An explicit version number column (`version integer NOT NULL DEFAULT 1`) is the robust standard for relational OCC:
   ```sql
   UPDATE tasks
   SET status = $newStatus, version = version + 1, updated_at = now()
   WHERE workspace_subdomain = $subdomain AND id = $id AND version = $expectedVersion;
   ```

### 3.3 Soft-Delete Cascade Gaps & Assignee Thrashing

#### Gap 1: Dangling Active Assignees on Task Deletion
In [`tasksTrashRepository.ts`](../apps/backend/src/db/repositories/tasksTrashRepository.ts#L30-L35):
```ts
const [changed] = await tx
  .update(tasks)
  .set({ deletedAt: now, deletedBy: actorUserId, updatedAt: now })
  .where(and(eq(tasks.workspaceSubdomain, tenant), eq(tasks.id, id), isNull(tasks.deletedAt)))
  .returning({ id: tasks.id });
```
When a task is soft-deleted, its `task_assignees` rows are **not touched**.
- In PostgreSQL, the foreign key constraint:
  ```sql
  CONSTRAINT task_assignees_task_fk
    FOREIGN KEY (workspace_subdomain, task_id)
    REFERENCES tasks (workspace_subdomain, id) ON DELETE CASCADE
  ```
  only triggers on hard `DELETE`, not soft-delete updates.
- As a consequence, `task_assignees` retains active rows (`deleted_at IS NULL`) pointing to a soft-deleted task. Queries aggregating user assignments or metrics must explicitly filter out tasks where `tasks.deletedAt IS NOT NULL`.

#### Gap 2: Destructive Assignee Synchronization
In [`tasksAssigneesRepository.ts`](../apps/backend/src/db/repositories/tasksAssigneesRepository.ts#L101-L123):
```ts
export async function syncTaskAssignees(tx, subdomain, taskId, assignees, actorUserId) {
  await tx
    .update(taskAssignees)
    .set({ deletedAt: new Date(), deletedBy: actorUserId ?? null })
    .where(
      and(
        eq(taskAssignees.workspaceSubdomain, subdomain),
        eq(taskAssignees.taskId, taskId),
        isNull(taskAssignees.deletedAt),
      ),
    );

  if (!assignees.length) return;
  await tx.insert(taskAssignees).values(
    assignees.map((a) => ({
      id: crypto.randomUUID(),
      workspaceSubdomain: subdomain,
      taskId,
      facultyId: a.facultyId,
      facultyAssignmentId: a.facultyAssignmentId ?? null,
      userId: a.userId,
      assignedByUserId: actorUserId ?? "system",
    })),
  );
}
```
Every time a task is edited (even if assignees did not change):
1. **Destroys Historical `assigned_at`**: Existing assignees are soft-deleted and replaced with new records with `assigned_at = now()`.
2. **Loss of Completion State**: If an assignee had completed their assignment (`completed_at`), resaving the task overwrites it with `completed_at = null`.
3. **Table Bloat**: Accumulates dead rows on every save, increasing autovacuum load and table bloat.

**Fix**: Implement diff-based synchronization: only insert newly added assignees and soft-delete removed assignees.

---

## 4. Drizzle ORM Anti-Patterns & Recommendations

### 4.1 Missing Drizzle Relations
In `apps/backend/src/db/schema/relations/`, relations exist for 12 domains (`academic`, `accounting`, `faculty`, `messaging`, etc.), but **there is no `taskRelations.ts`**.

**Defect**:
Drizzle's relational query API (`db.query.tasks.findFirst({ with: { assignees: true, parent: true } })`) cannot be used. Repositories must manually perform multi-table `leftJoin` queries and write custom in-memory grouping loops.

**Fix**: Create `apps/backend/src/db/schema/relations/taskRelations.ts`:
```ts
import { relations } from "drizzle-orm";
import { tasks, taskAssignees } from "../tasksTables.js";
import { faculty } from "../faculty.js";
import { tenantUsers } from "../contacts.js";

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  parent: one(tasks, {
    fields: [tasks.workspaceSubdomain, tasks.parentTaskId],
    references: [tasks.workspaceSubdomain, tasks.id],
    relationName: "taskHierarchy",
  }),
  subtasks: many(tasks, { relationName: "taskHierarchy" }),
  assignees: many(taskAssignees),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.workspaceSubdomain, taskAssignees.taskId],
    references: [tasks.workspaceSubdomain, tasks.id],
  }),
  faculty: one(faculty, {
    fields: [taskAssignees.workspaceSubdomain, taskAssignees.facultyId],
    references: [faculty.workspaceSubdomain, faculty.id],
  }),
  user: one(tenantUsers, {
    fields: [taskAssignees.workspaceSubdomain, taskAssignees.userId],
    references: [tenantUsers.workspaceSubdomain, tenantUsers.id],
  }),
}));
```

---

## 5. Proposed Forward-Only SQL Migration

Below is the concrete migration script (`0138_tasks_persistence_and_performance_hardening.sql`) resolving all flagged index gaps, Kanban positioning, OCC versioning, and cascade integrity.

```sql
-- MMS Forward-only Migration: 0138_tasks_persistence_and_performance_hardening.sql
-- Optimizes task query paths, adds kanban ordering, OCC versioning, and soft-delete triggers.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Add version (OCC), kanban_position, and polymorphic entity columns
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "kanban_position" varchar(64) NOT NULL DEFAULT '0|hzzzzz:',
  ADD COLUMN IF NOT EXISTS "entity_type" varchar(64),
  ADD COLUMN IF NOT EXISTS "entity_id" text;
--> statement-breakpoint

-- 2. Performance Composite Indexes for Task Work-lists and "My Tasks"
-- Default sort order: (workspace_subdomain, created_at DESC)
CREATE INDEX IF NOT EXISTS "tasks_ws_active_created_at_idx"
  ON "tasks" ("workspace_subdomain", "created_at" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Status + Due Date index for open task lists and overdue checks
CREATE INDEX IF NOT EXISTS "tasks_ws_status_due_at_active_idx"
  ON "tasks" ("workspace_subdomain", "status", "due_at")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Creator filtering index
CREATE INDEX IF NOT EXISTS "tasks_ws_creator_active_idx"
  ON "tasks" ("workspace_subdomain", "created_by_user_id", "status")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Kanban board ordering index
CREATE INDEX IF NOT EXISTS "tasks_ws_kanban_pos_active_idx"
  ON "tasks" ("workspace_subdomain", "status", "kanban_position")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Polymorphic entity association index
CREATE INDEX IF NOT EXISTS "tasks_ws_entity_active_idx"
  ON "tasks" ("workspace_subdomain", "entity_type", "entity_id")
  WHERE "deleted_at" IS NULL AND "entity_type" IS NOT NULL;
--> statement-breakpoint

-- 3. Composite Covering Index on Task Assignees for Index-Only Scans
CREATE INDEX IF NOT EXISTS "task_assignees_ws_user_task_active_idx"
  ON "task_assignees" ("workspace_subdomain", "user_id", "task_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- 4. Cascade Soft-Delete Trigger to prevent orphaned assignees
CREATE OR REPLACE FUNCTION cascade_task_soft_delete()
RETURNS trigger AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE task_assignees
    SET deleted_at = NEW.deleted_at,
        deleted_by = NEW.deleted_by,
        deleted_with_cascade = true
    WHERE workspace_subdomain = NEW.workspace_subdomain
      AND task_id = NEW.id
      AND deleted_at IS NULL;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE task_assignees
    SET deleted_at = NULL,
        deleted_by = NULL,
        restored_at = NEW.restored_at,
        restored_by = NEW.restored_by,
        deleted_with_cascade = false
    WHERE workspace_subdomain = NEW.workspace_subdomain
      AND task_id = NEW.id
      AND deleted_with_cascade = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cascade_task_soft_delete'
  ) THEN
    CREATE TRIGGER trg_cascade_task_soft_delete
      AFTER UPDATE OF deleted_at ON "tasks"
      FOR EACH ROW EXECUTE FUNCTION cascade_task_soft_delete();
  END IF;
END $$;
```

---

## Actionable Remediation Checklist

1. **Database Schema & Drizzle Definitions**:
   - Apply migration `0138` adding `version`, `kanban_position`, `entity_type`, `entity_id`, and composite indexes.
   - Update [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts) to declare the new columns and composite indexes in Drizzle syntax.
   - Create `apps/backend/src/db/schema/relations/taskRelations.ts` and export it in `relations/index.ts`.
2. **Repository Query Optimization**:
   - In [`tasksRepository.ts`](../apps/backend/src/db/repositories/tasksRepository.ts), replace the 2-step `inArray(tasks.id, ids)` assignee fetch with a single SQL `EXISTS` subquery.
   - In [`tasksWriteRepository.ts`](../apps/backend/src/db/repositories/tasksWriteRepository.ts), remove `lockFacultyHierarchy` from `createTask` and `updateTask` to eliminate tenant-wide transaction serialization.
   - Implement integer version OCC (`WHERE version = expectedVersion`, incrementing `version = version + 1`).
   - In [`tasksAssigneesRepository.ts`](../apps/backend/src/db/repositories/tasksAssigneesRepository.ts), replace the delete-all/re-insert pattern with set-diff reconciliation to protect historical assignment timestamps and prevent table bloat.
