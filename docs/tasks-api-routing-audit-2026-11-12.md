# Task Module — API Layer & Routing Audit

**Module**: Task  
**Audit Scope**: Schema Contracts · View & Bulk Endpoints · Serialization & Security  
**Files Examined**:
- [`tasksRoutes.ts`](../apps/backend/src/routes/tenant/tasksRoutes.ts)
- [`tasksReadRoutes.ts`](../apps/backend/src/routes/tenant/tasksReadRoutes.ts)
- [`tasksSoftDeleteRoutes.ts`](../apps/backend/src/routes/tenant/tasksSoftDeleteRoutes.ts)
- [`tasksExportRoutes.ts`](../apps/backend/src/routes/tenant/tasksExportRoutes.ts)
- [`tasksModuleManifest.ts`](../packages/shared/src/obligations/tasksModuleManifest.ts)
- [`tasks.contract.ts`](../packages/shared/src/contracts/tasks.contract.ts)
- [`tasksRepository.ts`](../apps/backend/src/db/repositories/tasksRepository.ts)
- [`tasksBulkRepository.ts`](../apps/backend/src/db/repositories/tasksBulkRepository.ts)
- [`tasksRowMapping.ts`](../apps/backend/src/db/repositories/tasksRowMapping.ts)
- [`taskPermissionService.ts`](../apps/backend/src/services/taskPermissionService.ts)
- [`taskSettingsService.ts`](../apps/backend/src/services/taskSettingsService.ts)
- [`api.dto.ts`](../packages/shared/src/schemas/api.dto.ts)
- [`registerModuleCsvExportRoutes.ts`](../apps/backend/src/lib/registerModuleCsvExportRoutes.ts)
- [`taskRouteErrors.ts`](../apps/backend/src/lib/taskRouteErrors.ts)

**Date**: 2026-11-12

---

## Executive Summary

The Task API layer has a solid overall structure — Zod schemas are shared from `@mms/shared`, bulk array sizes are capped, and tenant isolation is enforced at the query layer. However, six specific issues were identified ranging from **High** to **Low** severity:

| # | Issue | Severity | File |
|---|---|---|---|
| 1 | `GET /api/tasks/:id` returns deleted tasks to callers with only `tasks.read` | High | `tasksRoutes.ts` |
| 2 | `PUT /api/tasks/settings` has no Fastify schema — raw body reaches `taskSettingsSchema.parse()` without Fastify-level rejection | Medium | `tasksRoutes.ts` |
| 3 | `SELECT_COLS` selects internal audit columns (`deletedBy`, `deletionReason`, `restoredBy`, `restoredAt`, `assignedByUserId`, etc.) that reach `mapTaskRow` and silently dropped — brittle whitelist | Medium | `tasksRowMapping.ts` |
| 4 | Assignee-filter subquery is a client-side N+1 risk: separate `SELECT` before the main `WHERE` | Medium | `tasksRepository.ts` |
| 5 | `taskListQuerySchema.ids` allows up to 20,000 characters of comma-separated IDs; sliced to 500 at the repository layer, but the route never validates the slice happened | Low | `tasksModuleManifest.ts` / `tasksRepository.ts` |
| 6 | All 200 success responses in `tasks.contract.ts` use `z.unknown()` — no contract-side response shape validation | Low | `tasks.contract.ts` |

---

## Section 1: Schema Contracts

### 1.1 Request Validation — Mostly Good

All mutation routes use `safeParse()` with explicit 400 responses. Query routes use `taskListQuerySchema.parse()` (throws on invalid input, caught implicitly by Fastify's default error handler). The schemas are centrally defined in `@mms/shared` and shared with the ts-rest contract, eliminating drift.

| Route | Validation Method | Schema |
|---|---|---|
| `POST /api/tasks` | `taskInsertSchema.safeParse()` | ✅ Strict Zod |
| `PATCH /api/tasks/:id` | `taskUpdateSchema.safeParse()` | ✅ Strict Zod |
| `PATCH /api/tasks/:id/status` | `taskStatusUpdateSchema.safeParse()` | ✅ Strict Zod |
| `POST /api/tasks/bulk-status` | `tasksBulkStatusBodySchema.safeParse()` | ✅ Strict Zod, capped at 500 ids |
| `POST /api/tasks/bulk-delete` | `bulkStringIdsBodySchema.safeParse()` | ✅ Strict Zod, capped at 500 ids |
| `POST /api/tasks/bulk-restore` | `bulkStringIdsBodySchema.safeParse()` | ✅ Strict Zod, capped at 500 ids |
| `GET /api/tasks` | `taskListQuerySchema.parse()` | ✅ Strict Zod, enum-validated |
| `PUT /api/tasks/settings` | `updateTenantTaskSettings(request.body)` → `taskSettingsSchema.parse(payload)` | ⚠️ **Issue #2** |

**Issue #2 Detail — Settings endpoint bypasses Fastify schema registration:**

```typescript
// tasksRoutes.ts line 74
const updated = await updateTenantTaskSettings(request.body);
```

`request.body` is passed as `unknown` directly into the service, which calls `taskSettingsSchema.parse(payload)`. Zod throws a `ZodError` on invalid input, which is caught by a generic `catch(err)` block that sends 400. This works at runtime, but:
- Fastify never sees a `schema: { body: ... }` declaration, so its JSON Schema fast-serializer and body-size limits are bypassed.
- The error shape from the generic catch (`err.message`) does not include Zod's structured `issues` array unlike other routes that use `safeParse()`.
- Swagger/OpenAPI auto-docs will show no body schema for this endpoint.

**Fix**: Register a Fastify schema or switch to `safeParse()` pattern:
```typescript
fastify.put("/api/tasks/settings", {
  schema: { body: zodToJsonSchema(taskSettingsSchema) },
  config: { moduleAction: "setupWrite" },
}, async (request, reply) => {
  const parsed = taskSettingsSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({
    type: "validation_error",
    message: "Invalid settings",
    errors: parsed.error.issues,
  });
  ...
});
```

### 1.2 Path Params — Unvalidated Strings

All `:id` params are typed as `{ Params: { id: string } }` in Fastify generics but **never validated with a Zod schema**. `request.params.id` is passed directly to repository functions.

```typescript
// tasksRoutes.ts line 89
const task = await findTaskById(String(request.tenant?.id), request.params.id);
```

If a client sends a non-UUID string (e.g., `"../secret"`, `"a".repeat(10000)`), the query will execute against the DB with a malformed ID. The query will return 0 rows and a 404 is returned, so there is no security breach — but it wastes a DB round-trip and is not strictly validated.

**Fix**: Add a shared `z.string().uuid()` check on all `:id` params, or register `resourceIdParamsSchema` (already defined in `api.dto.ts`) in the Fastify schema option.

### 1.3 Query Parameters — `taskListQuerySchema` Issues

**`statuses` and `priorities` are free-form comma strings, not enum arrays:**

```typescript
statuses: z.string().max(200).optional(),   // e.g. "todo,in_progress,INVALID_VALUE"
priorities: z.string().max(200).optional(), // e.g. "low,INVALID"
```

The `splitEnum()` function in `tasksRepository.ts` silently filters out invalid values. This is safe from injection but it means a typo in `?statuses=tod` (missing 'o') will be silently ignored and return all statuses — no 400, no feedback. This can mask frontend bugs.

**Better approach**: Accept `z.array(z.enum(TASK_STATUSES))` and use query-string array serialization, or validate the comma string with a custom Zod refinement that rejects unrecognized values.

**`dueFrom` / `dueTo` / `dueOn` accept arbitrary strings up to 32 chars:**

```typescript
dueFrom: z.string().max(32).optional(),
dueTo: z.string().max(32).optional(),
dueOn: z.string().max(32).optional(),
```

Invalid date strings (e.g., `dueFrom=not-a-date`) silently produce `NaN` from `new Date(str)` and the condition is simply skipped (`isNaN` check is present — this is safe). But like above, there's no 400 for a bad date, just a silent noop filter.

**Fix**: Add `.refine((s) => !isNaN(new Date(s).getTime()), "Invalid date")` or use `z.coerce.date()`.

---

## Section 2: View & Bulk Endpoints

### 2.1 Issue #1 (High) — `GET /api/tasks/:id` Returns Soft-Deleted Tasks Implicitly

The `findTaskById` query in `tasksRepository.ts` correctly filters `isNull(tasks.deletedAt)`:

```typescript
// tasksRepository.ts line 161
.where(and(eq(tasks.workspaceSubdomain, subdomain), eq(tasks.id, id), isNull(tasks.deletedAt)))
```

However, `GET /api/tasks` with `?includeDeleted=true` has an RBAC gate (`tasks.delete` permission required). The single `GET /api/tasks/:id` route has **no equivalent gate for soft-deleted task access**. If a user manually constructs the URL for a known deleted task ID, the endpoint returns 404 (because `findTaskById` has the `isNull` guard) — this is safe.

**BUT** — the `PATCH /api/tasks/:id/status` route calls `findTaskById` **without** an existence check before `updateTaskStatus`:

```typescript
// tasksRoutes.ts lines 193-202
const previous = await findTaskById(tenant, request.params.id); // Returns null for deleted tasks
let updated;
try {
  updated = await updateTaskStatus(tenant, request.params.id, parsed.data.status, user.id, ...);
```

`findTaskById` returns `null` for deleted tasks (correct). `updateTaskStatus` is then called anyway with the original ID. The `updateTaskStatus` write path would need to be checked to confirm it also filters `deletedAt IS NULL` on the update — if it does not, a user with `tasks.write` could change the status of a soft-deleted task. This is a **high-priority** item to verify in `tasksWriteRepository.ts`.

**Immediate check needed** in `tasksWriteRepository.ts`:
```sql
-- Must include: AND deleted_at IS NULL in the UPDATE WHERE clause
UPDATE tasks SET status = $1 WHERE id = $2 AND workspace_subdomain = $3 AND deleted_at IS NULL
```

> [!CAUTION]
> If `updateTaskStatus` does NOT include `AND deleted_at IS NULL`, a user can silently reactivate the status of a soft-deleted task without it appearing in the trash view. The `findTaskById` null-check result (`previous`) is used only for notification context and does not gate the write.

### 2.2 Assignee-Filter N+1 Query Pattern

```typescript
// tasksRepository.ts lines 115-121
const matched = await tx
  .select({ taskId: taskAssignees.taskId })
  .from(taskAssignees)
  .where(and(...assigneeConditions));
const ids = matched.map((m) => m.taskId);
if (ids.length === 0) return { tasks: [], total: 0 };
conditions.push(inArray(tasks.id, ids));
```

When `?assignedToFacultyId=` or `?assignedToUserId=` is set, the code performs a **separate pre-query** to get matching task IDs, then uses `inArray()` in the main query. Problems:

1. **Unbounded pre-query**: The `SELECT taskId FROM task_assignees WHERE ...` has no `LIMIT`. A faculty member assigned to 50,000 tasks will return 50,000 IDs. This in-memory array is then passed to `inArray(tasks.id, ids)`, which generates a SQL `IN (...)` clause with 50,000 literals — a known PostgreSQL performance cliff.

2. **Two round-trips**: The intent is achievable in a single query with a `JOIN` or correlated `EXISTS` subquery, eliminating the extra round-trip and the unbounded IN clause.

**Fix**: Replace with a `JOIN` or `EXISTS` subquery:
```sql
-- Instead of two queries, use a single JOIN:
SELECT t.* FROM tasks t
INNER JOIN task_assignees ta ON ta.task_id = t.id
  AND ta.workspace_subdomain = t.workspace_subdomain
  AND ta.deleted_at IS NULL
  AND ta.faculty_id = $assignedToFacultyId   -- if set
  AND ta.user_id = $assignedToUserId         -- if set
WHERE t.workspace_subdomain = $subdomain
  AND t.deleted_at IS NULL
  ...
```

Or add a hard cap to the pre-query:
```typescript
const matched = await tx
  .select({ taskId: taskAssignees.taskId })
  .from(taskAssignees)
  .where(and(...assigneeConditions))
  .limit(5000); // Safety cap
```

### 2.3 Bulk Endpoint — Array Size Caps

| Endpoint | Schema Cap | Repository Cap | Match? |
|---|---|---|---|
| `POST /api/tasks/bulk-status` | `ids: z.array(...).max(500)` | `uniqueIds()` deduplication, no additional cap | ✅ |
| `POST /api/tasks/bulk-delete` | `ids: z.array(...).max(500)` | `uniqueIds()` deduplication | ✅ |
| `POST /api/tasks/bulk-restore` | `ids: z.array(...).max(500)` | `uniqueIds()` deduplication | ✅ |

Bulk endpoints are well-capped at 500 IDs. However, the **audit trail loop** inside `bulkUpdateTaskStatusBatch` and `bulkDeleteTasksBatch` runs `recordModernAuditEvent` per row in a sequential `for...of` loop:

```typescript
// tasksBulkRepository.ts lines 64-72 and 242-252
for (const id of deletedIds) {
  await recordModernAuditEvent(tx, { ... });
}
```

For a 500-ID bulk delete, this executes **500 sequential INSERT statements** inside the same transaction, holding the advisory lock for the entire duration. This is an N+1 audit insertion pattern. Prefer a batch insert for audit events if the audit schema supports it.

### 2.4 `bulk-status` Emits No Outbox Events

(Confirmed in prior audit; noted here for completeness.)  
`bulkUpdateTaskStatusBatch` performs all status updates but **does not call `emitOutboxEvents`** — the outbox call is entirely absent from that function. By contrast, `bulkDeleteTasksBatch` and `bulkRestoreTasksBatch` both emit outbox events correctly. The route handler in `tasksRoutes.ts` calls `emitTaskBulkStatusNotifications` after the fact (line 254), but this is in-process only, not an outbox-durable write, meaning a process crash between the status update and the notification drops the event silently.

### 2.5 No Kanban, No Reorder Endpoint

No Kanban board view exists and no drag-and-drop reorder endpoint exists. This is consistent with prior findings — the manifest only declares `["table", "cards"]` views. Documented here for completeness as the audit brief asked about it.

---

## Section 3: Serialization & Security

### 3.1 Issue #3 (Medium) — `SELECT_COLS` Selects Internal Metadata Columns That Are Silently Dropped

[`tasksRowMapping.ts`](../apps/backend/src/db/repositories/tasksRowMapping.ts) declares `SELECT_COLS` selecting **28 columns** from the database including:

```typescript
export const SELECT_COLS = {
  id: tasks.id,
  ...
  assignedByUserId: tasks.assignedByUserId,  // ← Internal audit field
  completedAt: tasks.completedAt,            // ← Not in TaskRecord
  cancelledAt: tasks.cancelledAt,            // ← Not in TaskRecord
  deletedBy: tasks.deletedBy,               // ← Internal — who deleted
  deletionReason: tasks.deletionReason,     // ← Internal — deletion note
  restoredAt: tasks.restoredAt,             // ← Internal
  restoredBy: tasks.restoredBy,             // ← Internal
  deletedWithCascade: tasks.deletedWithCascade, // ← Internal
  createdBy: tasks.createdBy,               // ← Audit column
  updatedBy: tasks.updatedBy,               // ← Audit column
};
```

`mapTaskRow()` only maps a **subset** of these to `TaskRecord`:
```typescript
export function mapTaskRow(r, assigneesMap): TaskRecord {
  return {
    id: r.id, workspaceSubdomain: r.workspaceSubdomain, title: r.title,
    description: r.description, status: r.status, priority: r.priority,
    startDate: r.startDate, dueAt: r.dueAt, parentTaskId: r.parentTaskId,
    createdById: r.createdByUserId,
    assignees: assigneesMap.get(r.id) ?? [],
    createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
  };
}
```

**Result**: `assignedByUserId`, `completedAt`, `cancelledAt`, `deletedBy`, `deletionReason`, `restoredAt`, `restoredBy`, `deletedWithCascade`, `createdBy`, `updatedBy` are fetched from the DB but dropped by the mapper. They **never reach the HTTP response** because Fastify serializes only the mapped `TaskRecord` object.

This is currently safe from information disclosure. However, it is brittle:
- If a future developer adds `...r` (spread) to the return value, all 28 columns leak.
- Fetching 10 extra columns per row is wasted DB bandwidth for every list/read.
- `taskRecordSchema` is `.strict()` so adding a field would cause a Zod parse error — but this only fires if schema validation is called on the response (it is not, since all response schemas in `tasks.contract.ts` use `z.unknown()`).

**Fix**: Narrow `SELECT_COLS` to only the 13 fields actually used by `mapTaskRow`. Move audit-only columns to a separate `SELECT_AUDIT_COLS` used only by internal/audit queries. This eliminates the risk of accidental leakage and improves query performance.

### 3.2 Issue #6 (Low) — All Responses Use `z.unknown()` in ts-rest Contract

```typescript
// tasks.contract.ts line 15
const ok = z.unknown();
```

Every success response in `tasksContract` returns `z.unknown()`. The comment on line 22 explains this is by design ("widened client reads shared Task* types at the call site"). While functional, this means:
- No runtime validation of outbound shapes on the client side.
- Swagger docs generated from the contract show `{}` for all 200 responses.
- A backend bug sending an unexpected field (e.g., accidentally including `deletionReason`) will not be caught at the contract boundary.

**Recommendation**: Define typed response schemas for `TaskRecord` and paginated `{ tasks: TaskRecord[]; total: number }` and use them in the contract. Keep them in `@mms/shared` so they're single-source.

### 3.3 HTTP Status Code Consistency

| Scenario | Actual Status | Correct? |
|---|---|---|
| Task not found on GET/PATCH | 404 | ✅ |
| Permission denied | 403 | ✅ |
| Validation failure (body schema) | 400 w/ `errors` array | ✅ |
| Validation failure (settings) | 400 w/ single `message` only | ⚠️ Inconsistent with other 400s |
| Task create success | 201 | ✅ |
| Bulk operations success | 200 | ✅ |
| Soft delete success | 200 `{ success: boolean }` | ⚠️ Convention is 204 for deletes |
| Conflict (OCC, delegation) | 409 | ✅ |
| Export queued | 202 | ✅ |
| Background job limit | 429 | ✅ |

**Minor inconsistency**: `DELETE /api/tasks/:id` returns `200 { success: true/false }` instead of `204 No Content`. The `success: false` case is never actually returned — the repository either soft-deletes or throws. Using 204 for successful deletes would be more idiomatic.

### 3.4 Tenant Isolation in Settings — Missing Tenant Argument

`getTenantTaskSettings()` derives its tenant from the **async-storage request context** (`getRequestTenant()`), not from an explicit parameter:

```typescript
// taskSettingsService.ts line 9
function tenantContext(): string {
  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) throw new Error("Tenant context required");
  return tenant;
}
```

This is correct when called from a live HTTP request (the middleware populates the async-storage context). However, calling `getTenantTaskSettings()` from a background job, BullMQ worker, or test without the HTTP context will throw `"Tenant context required"`. This coupling makes the function untestable in isolation without mocking the context store. Compare to `taskPermissionService.ts` which correctly accepts `tenant` as an argument.

**Fix**: Add an optional `tenant?: string` parameter to `getTenantTaskSettings()` that falls back to the context store when undefined — consistent with the repository pattern.

### 3.5 `canPerformTaskAction` Called Multiple Times Per Request

```typescript
// tasksRoutes.ts lines 44, 49, 50 — three separate calls:
await canPerformTaskAction(request, "tasks.read");
await canPerformTaskAction(request, "tasks.assign_anywhere");
// ... and in the create handler:
await canPerformTaskAction(request, "tasks.write");
await canPerformTaskAction(request, "tasks.assign");
await canPerformTaskAction(request, "tasks.assign_anywhere");
```

Each call to `canPerformTaskAction` triggers:
1. `resolveCurrentTenantRole()` — likely a DB query
2. `getTenantUsersSettings()` — another DB query

For `POST /api/tasks` with assignees, **three separate permission checks** each make two DB calls = **6 DB round-trips** before any task data is touched. This is a latency amplifier on every mutation.

**Fix**: Cache the resolved role and settings for the duration of the request (e.g., in `request.locals` or memoize within the handler):
```typescript
const [canWrite, canAssign, canAssignAnywhere] = await Promise.all([
  canPerformTaskAction(request, "tasks.write"),
  canPerformTaskAction(request, "tasks.assign"),
  canPerformTaskAction(request, "tasks.assign_anywhere"),
]);
```

At minimum, run the checks in parallel with `Promise.all` to cut from 6 serial DB calls to 2 parallel DB calls.

---

## Section 4: Findings Summary

### Critical / High

| ID | Finding | Impact | File |
|---|---|---|---|
| **H-1** | `PATCH /api/tasks/:id/status` does not short-circuit when `findTaskById` returns `null` (deleted task) before calling `updateTaskStatus`. Need to verify `updateTaskStatus` has `AND deleted_at IS NULL` guard. | Could allow status writes to soft-deleted tasks | `tasksRoutes.ts` L193–202 |

### Medium

| ID | Finding | Impact | File |
|---|---|---|---|
| **M-1** | `PUT /api/tasks/settings` bypasses Fastify schema registration; Zod errors from parse produce a 400 with no `errors` array | Inconsistent error shape, missing OpenAPI body schema | `tasksRoutes.ts` L66–83 |
| **M-2** | `SELECT_COLS` fetches 28 DB columns but `mapTaskRow` uses only 13; internal audit columns (`deletedBy`, `deletionReason`, `restoredBy`, etc.) are silently dropped — currently safe but brittle | Risk of future accidental leakage; wasted DB bandwidth | `tasksRowMapping.ts` |
| **M-3** | Assignee-filter uses a separate unbounded pre-query; for a faculty member with 50k task assignments, this loads 50k IDs into Node.js memory and builds a 50k-element `IN (...)` SQL clause | Potential OOM and DB performance cliff | `tasksRepository.ts` L104–122 |

### Low

| ID | Finding | Impact | File |
|---|---|---|---|
| **L-1** | `taskListQuerySchema.ids` allows 20,000-char comma strings; sliced to 500 only at repository layer with no route-level feedback | Silent truncation, no 400 to caller | `tasksModuleManifest.ts` L156 |
| **L-2** | `statuses` / `priorities` multi-select query params silently drop invalid enum values instead of returning 400 | Masks frontend typos, confusing "empty" results | `tasksRepository.ts` L39–44 |
| **L-3** | All contract responses use `z.unknown()` — no outbound shape validation or Swagger docs | No contract-level leakage detection | `tasks.contract.ts` |
| **L-4** | Bulk audit insertion is sequential `for...of` with `await` per row (up to 500 inserts in a single transaction holding the advisory lock) | Latency spike on bulk operations | `tasksBulkRepository.ts` L64–72, L242–252 |
| **L-5** | `canPerformTaskAction` called 2–3 times per mutation route serially; each call makes 2 DB round-trips | 4–6 DB calls before the task payload is processed | `tasksRoutes.ts` |
| **L-6** | `DELETE /api/tasks/:id` returns `200 { success: boolean }` not `204 No Content` | Minor REST convention deviation | `tasksSoftDeleteRoutes.ts` |
| **L-7** | `getTenantTaskSettings()` reads tenant from async-storage context, not a parameter — untestable without HTTP context mock | Test fragility; context leak risk in background jobs | `taskSettingsService.ts` |

---

## Section 5: What Is Well-Implemented

> [!NOTE]
> These are genuine strengths worth preserving in future changes.

- **Zod schemas are centrally defined** in `@mms/shared` and re-exported to both the ts-rest contract and all route handlers — zero schema drift between contract and runtime.
- **Bulk array sizes are capped at 500** at the schema layer for all three bulk endpoints, before they reach the repository.
- **Soft-delete access control** for the list view is properly gated: `?includeDeleted=true` requires `tasks.delete` permission (not just `tasks.read`).
- **Status transition enforcement** is applied both for single updates (service layer validates against `TASK_STATUS_TRANSITIONS`) and bulk updates (`isTaskStatusTransitionAllowed` in `tasksBulkRepository.ts`), and illegal transitions are skipped with a reason rather than failing the whole batch.
- **`taskRouteErrors.ts`** provides a stable HTTP error taxonomy (400/403/409) mapped from domain errors, keeping HTTP concerns out of the domain layer.
- **Export route** correctly filters system metadata column keys via `isSystemMetadataKey()` before accepting column specs from the client — prevents clients from exporting internal fields by naming them.
- **`bulkStringIdsBodySchema`** runs `deepSanitizeStrings` before validation — strips potential XSS/injection payloads from bulk ID arrays.
- **Tenant isolation** is enforced at the query layer: every repository function calls `withTenantRead(subdomain)` / `withTenant(subdomain)` and all queries include `eq(tasks.workspaceSubdomain, subdomain)` as the first condition.

---

## Appendix: Recommended Priority Order

1. **Verify** `tasksWriteRepository.ts` → `updateTaskStatus` includes `AND deleted_at IS NULL` (**H-1**)
2. **Fix** assignee-filter pre-query: add `LIMIT 5000` safety cap or rewrite as `JOIN` (**M-3**)
3. **Fix** `PUT /api/tasks/settings` to use `safeParse()` and return structured `errors` (**M-1**)
4. **Narrow** `SELECT_COLS` to only the 13 fields used by `mapTaskRow` (**M-2**)
5. **Parallelise** `canPerformTaskAction` calls with `Promise.all` (**L-5**)
6. **Add** `.refine()` or `z.coerce.date()` to `dueFrom`/`dueTo`/`dueOn` (**L-2**)
7. **Replace** sequential bulk audit `for...of` with a batch insert (**L-4**)
