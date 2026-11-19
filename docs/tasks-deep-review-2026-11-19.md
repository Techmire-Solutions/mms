# MMS Tasks Module — Deep Re-Review — 2026-11-19

Fresh whole-module review at `HEAD a9ce9cb4a` (after all remediation + must-fix + minor fixes), focused on the surfaces the earlier reviews did not deeply cover: CSV transfer round-trip, RBAC matrix, realtime invalidation, dashboard integration, and concurrency/OCC coverage.

**Method.** Static read on the production path plus the gate/test baseline. Findings cite `file:line` at `a9ce9cb4a`.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend typecheck` / `mms-frontend typecheck` | Pass |
| `check:i18n` / `check:backend-structure` | Pass (all locales complete; 66/66, 51/51) |
| Backend task/notification/outbox/soft-delete suites | Pass (last full run 591 files / 4170 tests) |
| `pnpm ci:local` | Pass (prior round; unchanged paths since) |

## 2. Verdict

After the prior rounds the module is **clean — no Critical or Major findings remain**. This pass surfaces five **Minor** items, all in secondary surfaces (CSV transfer fidelity, realtime push, RBAC matrix hygiene, OCC coverage on the bulk-status path, and an unconditional timezone lookup). None block release.

## 3. Findings

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| D1 | **Minor** | CSV transfer | Export→import round-trip is lossy: (a) multi-assignee tasks export as `"A; B"` but the importer matches a single name → "Assignee not found"; (b) the exporter can emit `userEmail`/`userId` but the importer matches only `employeeId`/`name`/`userId` (not email); (c) `startDate` and `parentTaskId` are absent from the transfer schema/columns and always reset on import |
| D2 | **Minor** | Realtime | Task mutations do not push a `/api/ws` invalidation (`broadcastTenantUpdate`/`broadcastCollection`); other users see changes only after TanStack Query's `staleTime` (15s) or a manual refresh |
| D3 | **Minor** | RBAC | `tasks.assign` (`["create","update"]`) is byte-identical to `tasks.write` in `permissionRules.ts`, so the capability can never be granted independently and the `tasks.assign` route gate is redundant |
| D4 | **Minor** | Concurrency | `bulkUpdateTaskStatusBatch` has no OCC token (`expectedUpdatedAt`), unlike single `updateTask`/`updateTaskStatus` — a bulk status change can overwrite a concurrent single edit |
| D5 | **Minor** | Performance | `listTasks` and `getTaskMetrics` fetch `workspaces.timezone` unconditionally, even when no `dueFrom`/`dueTo`/`dueOn` filter is present (one extra query per list/metrics call, incl. the dashboard 10-way aggregation) |

## 4. Detail

### D1 — CSV transfer fidelity

`tasksExportService.taskToRow` renders assignees as `facultyName ?? userEmail ?? userId` joined with `"; "` (`tasksExportService.ts:106-109`), while `taskImportUseCases.buildAssigneeInputs` matches a **single** assignee against `employeeId`/`name`/`userId` only (`taskImportUseCases.ts:52-70`). Consequences:
- a task with two assignees exports `"Shaykh Ahmad; Ustadh Yusuf"` and cannot be re-imported;
- a task whose assignee has no faculty name exports an email that the importer cannot match;
- `startDate` and `parentTaskId` are not part of `tasksTransferSchema.fields` or `TASK_EXPORT_COLUMNS`, so they are silently dropped on a round-trip.

**Fix.** Either document CSV as lossy for these fields, or extend the transfer schema to a repeatable/denormalized assignee column (and add `startDate`), and have the importer match email and split `;`-joined names.

### D2 — no realtime push

No `broadcastTenantUpdate`/`broadcastCollection`/`livePush` call exists anywhere in the tasks write path (routes/use-cases/repositories). The notification path broadcasts the `notifications` collection, but the tasks **directory** does not, so collaborative edits are not live-pushed to other viewers.

**Fix.** Emit `broadcastTenantUpdate(tenant, "collection", "tasks")` (or a scoped invalidation) in the mutation use-cases, matching the notifications pattern.

### D3 — `tasks.assign` is a dead capability

`permissionRules.ts:102` (`tasks.write`) and `:104` (`tasks.assign`) both require `["create","update"]`. The RBAC matrix therefore exposes `tasks.assign` as a grantable row that grants nothing beyond `tasks.write`; the `POST/PATCH … assignees !== undefined` gate is redundant with write. (`tasks.complete` = `["update"]` is a genuine subset, and `tasks.assign_anywhere` uses a distinct module id.)

**Fix.** Either remove `tasks.assign` from the matrix (fold into write) or give it a distinct required-action set.

### D4 — bulk status lacks OCC

`bulkUpdateTaskStatusBatch` updates by `id` with no `expectedUpdatedAt` guard. A stale bulk-status write can overwrite a concurrent single status/edit that a user made in between.

**Fix.** Accept an optional OCC token (or skip rows whose `updated_at` changed since the client's snapshot) — or document bulk status as last-write-wins.

### D5 — unconditional timezone lookup

`listTasks` and `getTaskMetrics` both `SELECT timezone FROM workspaces` on every call (`tasksRepository.ts`, `tasksMetricsRepository.ts`) to feed `buildTaskFilterConditions`, even when no date filter is set. The dashboard summary's 10-way aggregation now includes this query once more.

**Fix.** Only load the timezone when `dueFrom`/`dueTo`/`dueOn` is present (pass an optional timezone into `buildTaskFilterConditions`).

## 5. Verified-clean

- Dashboard integration: `dashboardSummaryService` calls `getTaskMetrics(cleanTenant)` with no filters (workspace-wide command-centre KPI), correctly cached with 30s TTL + single-flight.
- Eligible-assignee endpoint: gated by `tasks.read` and scoped by delegation; returns only picker-relevant fields (`name`, `employeeId`, `departmentName`, `userId`, `isSelf`).
- `taskListQuerySchema`: bounded (`limit` 1–500, `offset` ≥0, `ids` ≤20k, enums validated, `overdue`/`includeDeleted` coerced).
- Recipient scope CTE: tenant-scoped, depth-capped, cross-tenant-safe (verified against Postgres in the prior round).

## 6. Resolution

| ID | Priority | Change |
| --- | --- | --- |
| D1 | Follow-up | extend transfer schema for multi-assignee + `startDate`; importer matches email + splits `;` |
| D2 | Follow-up | broadcast `tasks` collection invalidation on mutation |
| D3 | Follow-up | remove or differentiate the `tasks.assign` capability |
| D4 | Follow-up | OCC token or skip-on-stale in bulk status |
| D5 | Follow-up | lazy timezone lookup (only when a date filter is present) |

All are **Minor**; none require immediate action. They can be folded into a single follow-up change set.
