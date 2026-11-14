# Task Module — Specialized Domain Subsystems Audit

**Module**: Task  
**Audit Scope**: Recurrence Engine · Kanban Reordering · Dependency & SLA Cascades  
**Workspace**: `c:\Users\syedm\Desktop\mms v2\mms`  
**Date**: 2026-11-12  
**Status**: Read-only analysis — no code changes made

---

## Executive Summary

All three specialized subsystems audited in this report — the Recurrence Engine, Kanban Board Reordering, and Dependency/SLA Cascade systems — are **entirely unimplemented feature gaps**. This is not a defect report against existing code; it is a gap report confirming that the codebase contains zero infrastructure for any of these three subsystems. The findings below document what is missing, the highest-risk failure modes if each subsystem is implemented naively, and recommended architectural approaches.

---

## Section 1: Recurrence Engine

### 1.1 Executive Finding

**Status: FEATURE GAP — NOT IMPLEMENTED.**

An exhaustive search across `apps/backend/src`, `apps/frontend/src`, and `packages/shared/src` found **zero files** matching patterns `recur`, `rrule`, `cron`, `interval`, or `schedule` within any task-related code path. No recurring task infrastructure exists anywhere in the codebase.

### 1.2 Evidence of Absence

| Search Target | Expected Location | Found |
|---|---|---|
| `recurrence_rule` column | [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts) | ❌ Not present |
| `timezone` / `next_occurrence_at` column | `tasksTables.ts` | ❌ Not present |
| `recurring_parent_id` column | `tasksTables.ts` | ❌ Not present |
| RRULE parsing library | `package.json` / any import | ❌ Not present |
| Recurrence BullMQ worker | [`backgroundJobTasksRunners.ts`](../apps/backend/src/services/backgroundJobTasksRunners.ts) | ❌ Not present — only CSV import/export runners registered |
| Recurrence types / schemas | [`tasksModuleManifest.ts`](../packages/shared/src/tasks/tasksModuleManifest.ts) | ❌ Not present |
| Recurrence settings | [`taskSettingsTables.ts`](../apps/backend/src/db/schema/taskSettingsTables.ts) `task_module_preferences` | ❌ Not present — only `delegationScope`, `allowSelfAssignment`, `notifyOnAssignment`, `notifyOnStatusChange` |
| Recurrence UI controls | `apps/frontend/src/tenant/features/tasks/**` | ❌ Not present |

### 1.3 Risk Analysis — Failure Modes If Implemented Naively

> [!CAUTION]
> These are **anticipated future bugs** that must be designed against, not existing bugs in deployed code.

| Risk | Description | Severity |
|---|---|---|
| **Infinite spawn loop** | If recurrence is "completion-triggered" (spawn next on complete), and the spawned task inherits the same handler, a programmatic batch-complete could spawn thousands of tasks. Must be guarded with an idempotency token and `is_recurring_spawn = true` flag. | Critical |
| **DST boundary skips** | Scheduling daily at `23:00 America/New_York` will skip or double-fire on DST transition days if stored as a UTC offset instead of an IANA timezone name. `2025-03-09T23:00-05:00` does not exist in that timezone. | High |
| **Orphaned occurrences** | If the parent recurring task is deleted or archived, spawned child occurrences must also be cancelled. Without a `recurring_parent_id` FK with cascade rules, orphaned occurrences accumulate. | High |
| **Missing backfill logic** | If the recurrence worker is offline for 3 days (e.g., Redis outage), it will either skip occurrences silently or backfill all missed instances at once — causing a spawn storm. | High |
| **Split-brain spawn** | The advisory lock `lockFacultyHierarchy` is called on every task CRUD operation (see [`task_database_persistence_review.md`](./tasks-schema-persistence-audit-2026-11-12.md)). If the recurrence worker shares this lock, it will serialize with all user-facing task mutations and become a severe bottleneck. | Medium |

### 1.4 Recommended Architecture

```sql
-- Schema additions required
ALTER TABLE tasks ADD COLUMN recurrence_rule        TEXT,          -- RFC 5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR"
ALTER TABLE tasks ADD COLUMN recurrence_timezone    TEXT,          -- IANA tz name, e.g. "America/New_York"
ALTER TABLE tasks ADD COLUMN next_occurrence_at     TIMESTAMPTZ,   -- Computed by worker after each spawn
ALTER TABLE tasks ADD COLUMN recurring_parent_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
ALTER TABLE tasks ADD COLUMN is_recurring_instance  BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX tasks_recurrence_pending_idx ON tasks(next_occurrence_at)
  WHERE next_occurrence_at IS NOT NULL AND deleted_at IS NULL;
```

**Worker design** (BullMQ repeatable job, e.g., every 5 minutes):
1. `SELECT * FROM tasks WHERE next_occurrence_at <= now() AND recurrence_rule IS NOT NULL AND deleted_at IS NULL LIMIT 100 FOR UPDATE SKIP LOCKED`
2. Within a single transaction: clone task row (with `is_recurring_instance = true`, `recurring_parent_id = id`), advance `next_occurrence_at` using the `rrule` npm library respecting `recurrence_timezone`, persist both.
3. Emit outbox event `task.recurrence_spawned` within the same transaction.
4. Use job idempotency key `task:{id}:occurrence:{next_occurrence_at}` to prevent duplicate spawns during worker restarts.

---

## Section 2: Kanban Board Reordering

### 2.1 Executive Finding

**Status: FEATURE GAP — NOT IMPLEMENTED.**

No Kanban board view exists in the frontend. The tasks schema has no ordering column. No drag-and-drop or positional sorting infrastructure exists anywhere.

### 2.2 Evidence of Absence

| Search Target | Expected Location | Found |
|---|---|---|
| `sort_order` / `kanban_position` / `rank` column on `tasks` | [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts) | ❌ Not present — `sort_order` exists on `organization_locations` and `organization_positions` tables only |
| Kanban view in directory views | [`tasksModuleManifest.ts`](../packages/shared/src/tasks/tasksModuleManifest.ts) `TASKS_MODULE_MANIFEST.work.directoryViews` | ❌ Only `["table", "cards"]` defined — no `"kanban"` |
| Kanban board component | `apps/frontend/src/tenant/features/tasks/**` | ❌ Only `TasksListDesktopTable.tsx` and `TasksListCards.tsx` exist |
| Drag-and-drop handler | `useTasksPageController.ts` | ❌ Only `setPageIndex`, `serverFilters`, offset-based pagination — no position mutation |
| LexoRank / fractional index algorithm | Anywhere in codebase | ❌ Not present |
| Reorder API endpoint | [`tasksRoutes.ts`](../apps/backend/src/routes/tenant/tasksRoutes.ts) | ❌ Not present |

### 2.3 Risk Analysis — Failure Modes If Implemented Naively

| Risk | Description | Severity |
|---|---|---|
| **Precision exhaustion** | If using simple midpoint fractional indexing (e.g., `0.5`, `0.25`, `0.125`…), after ~52 moves between the same two cards, the string representation exceeds `DOUBLE PRECISION` precision and multiple cards get the same rank, causing indeterminate ordering. | Critical |
| **Concurrent reorder conflicts** | Two users reordering the same column simultaneously without optimistic locking will produce a last-write-wins collision — one user's reorder silently overwrites the other's. The existing OCC mechanism uses `x-expected-updated-at`, but a reorder does not update `updated_at` semantically. | High |
| **Full-column rebalance storm** | When precision exhausts, rebalancing rewrites every row's `kanban_position` in the column. For a column with 500+ tasks, this is a full-table update that blocks reads. Must use `FOR UPDATE SKIP LOCKED` and paginated batches. | High |
| **Index cardinality collapse** | If `kanban_position` is a nullable float that defaults to `0` for all existing tasks, a composite index on `(workspace_subdomain, status, kanban_position)` will be useless until every task has a unique position assigned. | Medium |

### 2.4 Recommended Architecture

**Use LexoRank or base-36 midpoint strings** (not floating-point):

```sql
-- Schema additions required
ALTER TABLE tasks ADD COLUMN kanban_position VARCHAR(64) NOT NULL DEFAULT '0|hzzzzz:';

CREATE INDEX tasks_ws_kanban_pos_active_idx
  ON tasks(workspace_subdomain, status, kanban_position)
  WHERE deleted_at IS NULL;
```

**Algorithm**:
- Represent position as an alphanumeric string (lexicographically orderable).
- When inserting between positions `A` and `B`: compute the lexicographic midpoint string.
- Trigger rebalance (redistribute evenly across the full range) when `LENGTH(kanban_position) > 50` to prevent precision exhaustion.
- Rebalance atomically via advisory lock scoped to the workspace+status column, **not** the global `lockFacultyHierarchy` lock.

**API shape**:
```
PATCH /tasks/:id/position
Body: { afterId?: string, beforeId?: string, columnStatus: TaskStatus }
```

---

## Section 3: Dependency & SLA Cascades

### 3.1 Executive Finding

**Status: FEATURE GAP — NOT IMPLEMENTED.**

No task dependency graph exists. No SLA breach monitoring or automated cascade system exists. The only "overdue" logic in the codebase is a **read-only metric count** in [`tasksMetricsRepository.ts`](../apps/backend/src/db/repositories/tasksMetricsRepository.ts):

```sql
count(*) FILTER (WHERE due_at < CURRENT_TIMESTAMP AND status NOT IN ('completed', 'cancelled'))
```

This count is never used to trigger status changes, escalations, or notifications.

### 3.2 Evidence of Absence

| Search Target | Expected Location | Found |
|---|---|---|
| `task_dependencies` table | Any schema / migration file | ❌ Not present |
| `predecessor_task_id` / `successor_task_id` / `blocker_task_id` | `tasksTables.ts` | ❌ Not present — `parent_task_id` exists for subtask nesting only |
| Dependency type enum | `tasksModuleManifest.ts` | ❌ Not present |
| `sla_due_at` / `sla_breached_at` columns | `tasksTables.ts` | ❌ Not present |
| SLA breach BullMQ worker | `backgroundJobTasksRunners.ts` | ❌ Not present |
| Cascade service (blocker complete → unblock successor) | `taskMutationService.ts` / any service file | ❌ Not present |
| Dependency cycle detection (recursive CTE) | Any repository | ❌ Not present |

### 3.3 The `blocked` Status Is a Dead-End

The `tasks` schema includes `blocked` as a valid `task_status` enum value, but:
- There is **no foreign key** tracking which task is blocking it.
- There is **no service logic** that automatically transitions a `blocked` task to `open` or `in_progress` when its blocker is completed.
- Marking a task as `blocked` is purely a manual label — it carries no semantic enforcement.

This means the `blocked` status currently functions as an informational tag, not a system-enforced state. Any task can be manually set to `blocked` without any blocking task existing, and no cascade occurs when a "blocker" is completed.

### 3.4 Risk Analysis — Failure Modes If Implemented Naively

| Risk | Description | Severity |
|---|---|---|
| **Circular dependency A→B→A** | Without recursive CTE cycle detection before persisting a dependency edge, circular references will silently form. Any cascade operation on A will then loop until stack overflow or timeout. | Critical |
| **Cascade storm** | If completing one task unblocks 200 downstream tasks simultaneously, and each unblock emits its own outbox event + notification job, Redis and the notification worker will be flooded. Must batch-unblock and emit a single `task.bulk_unblocked` event. | High |
| **SLA breach duplicate events** | If the SLA worker runs every 5 minutes and does not atomically set `sla_breached_at`, two overlapping worker instances will both find the same breached tasks and emit duplicate breach notifications. Must use `UPDATE ... WHERE sla_breached_at IS NULL RETURNING id` pattern. | High |
| **Transitive cascade depth** | A→B→C→D chain: completing A must cascade to B, then B's completion (triggered automatically) must cascade to C, etc. Without depth-limiting or iterative processing, a long chain may cause recursive trigger storms. | Medium |
| **Missed cascade on soft-delete** | If a blocking task is soft-deleted (not completed), its `blocked` successors should be automatically unblocked. Currently soft-delete does not cascade to task assignees (confirmed in prior audit) — dependency unblocking would have the same gap. | Medium |

### 3.5 Recommended Architecture

#### 3.5.1 Dependency Graph Schema

```sql
CREATE TABLE task_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  workspace_id    UUID NOT NULL,
  predecessor_id  UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('blocks', 'relates_to', 'duplicates')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(predecessor_id, successor_id, dependency_type)
);

CREATE INDEX task_deps_predecessor_idx ON task_dependencies(predecessor_id);
CREATE INDEX task_deps_successor_idx ON task_dependencies(successor_id);
CREATE INDEX task_deps_tenant_idx ON task_dependencies(tenant_id);
```

**Cycle detection** (must run before INSERT):
```sql
WITH RECURSIVE cycle_check AS (
  SELECT successor_id AS node FROM task_dependencies WHERE predecessor_id = :newSuccessorId
  UNION ALL
  SELECT d.successor_id FROM task_dependencies d JOIN cycle_check c ON d.predecessor_id = c.node
)
SELECT 1 FROM cycle_check WHERE node = :newPredecessorId LIMIT 1;
-- If this returns a row, reject the new dependency with a 409 Conflict
```

#### 3.5.2 SLA Schema and Worker

```sql
-- Schema additions
ALTER TABLE tasks ADD COLUMN sla_due_at      TIMESTAMPTZ,
ALTER TABLE tasks ADD COLUMN sla_breached_at TIMESTAMPTZ;

CREATE INDEX tasks_sla_pending_idx ON tasks(sla_due_at)
  WHERE sla_due_at IS NOT NULL AND sla_breached_at IS NULL AND deleted_at IS NULL;
```

**Worker pattern** (BullMQ repeatable, every 5 minutes):
```sql
-- Atomic: only marks tasks not yet breached; returns affected IDs for event emission
UPDATE tasks
SET sla_breached_at = now()
WHERE sla_due_at < now()
  AND sla_breached_at IS NULL
  AND status NOT IN ('completed', 'cancelled')
  AND deleted_at IS NULL
RETURNING id, tenant_id, workspace_id;
```
Emit a single batched outbox event `task.sla_breached_batch` with the returned IDs — do not emit one event per task.

---

## Section 4: Cross-Cutting Gaps Summary

| Subsystem | Implementation Status | Highest Risk If Built Without Care |
|---|---|---|
| **Recurrence Engine** | ❌ Not built | Infinite spawn loop on completion-triggered recurrence; DST boundary double-fire |
| **Kanban Reordering** | ❌ Not built | Float precision exhaustion after ~52 moves; concurrent reorder last-write-wins collision |
| **Dependency Cascades** | ❌ Not built | Circular dependency A→B→A with no cycle detection; cascade storm on bulk unblock |
| **SLA Cascades** | ❌ Not built | Duplicate SLA breach events from concurrent worker runs; missed cascade on soft-delete |

> [!IMPORTANT]
> The `blocked` task status is currently a manual label with no system enforcement. Any team planning to implement dependency cascades must audit all existing tasks currently in `blocked` status before go-live — they carry no blocker metadata and cannot be automatically migrated to the new dependency graph.

---

## Section 5: Cross-References to Prior Audit Findings

The three missing subsystems will interact with previously identified defects once built. Implementers must address these intersecting issues:

| Prior Finding | Impact on New Subsystem |
|---|---|
| **Advisory lock `lockFacultyHierarchy` on every task CRUD** ([DB audit](./tasks-schema-persistence-audit-2026-11-12.md)) | Recurrence worker spawning tasks will contend with this global lock, serializing against all user-facing mutations. The lock scope must be narrowed before the recurrence worker is introduced. |
| **Outbox split across two transactions** ([Domain audit](./tasks-domain-lifecycle-audit-2026-11-12.md)) | Recurring task spawns and dependency cascade notifications will suffer the same split-brain risk — the task row is committed but the outbox event is not, silently dropping spawn/cascade events. |
| **Soft-delete does not cascade to `task_assignees`** ([DB audit](./tasks-schema-persistence-audit-2026-11-12.md)) | The same gap will apply to `task_dependencies` rows — soft-deleting a task will not clean up its dependency edges, leaving orphaned blocker relationships in the graph. |
| **Bulk status updates emit no outbox events** ([Domain audit](./tasks-domain-lifecycle-audit-2026-11-12.md)) | If a bulk-complete operation completes multiple blocking tasks simultaneously, the dependency cascade worker will never be triggered — blocked tasks will remain stuck. |
| **No self-parent constraint on `parent_task_id`** ([DB audit](./tasks-schema-persistence-audit-2026-11-12.md)) | The same constraint gap applies to `task_dependencies` — without a `CHECK (predecessor_id <> successor_id)` constraint, a task can be set as its own blocker. |

---

## Appendix: Files Examined

| File | Purpose |
|---|---|
| [`tasksTables.ts`](../apps/backend/src/db/schema/tasksTables.ts) | Full task schema — confirmed no recurrence, ordering, or dependency columns |
| [`taskSettingsTables.ts`](../apps/backend/src/db/schema/taskSettingsTables.ts) | Module preferences — confirmed no recurrence settings |
| [`backgroundJobTasksRunners.ts`](../apps/backend/src/services/backgroundJobTasksRunners.ts) | Background workers — only CSV import/export registered |
| [`tasksMetricsRepository.ts`](../apps/backend/src/db/repositories/tasksMetricsRepository.ts) | Only overdue metric count — no cascade triggers |
| [`tasksModuleManifest.ts`](../packages/shared/src/tasks/tasksModuleManifest.ts) | Shared types/enums — no recurrence, dependency, or Kanban types |
| [`taskMutationService.ts`](../apps/backend/src/services/taskMutationService.ts) | Task mutation service — no cascade or recurrence spawn logic |
| [`tasksRoutes.ts`](../apps/backend/src/routes/tenant/tasksRoutes.ts) | API routes — no reorder or dependency endpoints |
| `TasksListDesktopTable.tsx`, `TasksListCards.tsx` | Frontend views — table and cards only, no Kanban component |
| [`useTasksPageController.ts`](../apps/frontend/src/tenant/features/tasks/hooks/useTasksPageController.ts) | Frontend controller — offset pagination only, no drag-and-drop |
| Migrations `0121`, `0134`–`0137` | SQL migration history — no recurrence, Kanban, or dependency tables added |
