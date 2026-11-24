# MMS Tasks Module — Frontend Review — 2026-11-19

Read-only review of the Tasks **frontend** surface at `HEAD e720b0dd9` (post-remediation). It verifies the remediation's frontend changes and surfaces defects against the MMS frontend norms (form-contract lifecycle, i18n, a11y, BiDi, TanStack Query, DRY).

**Scope.** `apps/frontend/src/tenant/features/tasks/**`; `tenant/hooks/collections/tasks.ts`; `tenant/hooks/notifications/useStoredNotifications.ts` + `useOpenTenantNotification.ts`; `lib/buildDashboardNotifications.ts`; `lib/ui/dashboardNotificationIcons.ts`; `lib/config/routeAccess.ts`.

**Method.** Static read on the production path (page controller → query/mutation hooks → components → forms), plus the gate/test baseline. Findings cite `file:line` at `e720b0dd9`.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend typecheck` | Pass |
| Frontend tasks + notifications + route-access suites | **117 passed** (30 files) |
| `check:i18n` | Pass (10,142 keys, 4 locales) |
| `check:code-norms` | Pass |

## 2. Verdict

One **Critical** defect defeats a previously-closed security/correctness fix (M5): the edit form re-adds `assignees: []` after the intentional omission, so every edit either 403s a non-admin or silently unassigns everyone for an admin. The rest of the surface is clean; the remaining items are minor UX/i18n gaps.

## 3. Findings summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| F1 | **Critical** | Form lifecycle | `useTaskFormController.handleSubmit` re-parses the M5-built payload with `taskInsertSchema`, whose `assignees` `.default([])` re-adds `assignees: []` — defeating the "omit unchanged assignees" fix and causing a 403 for non-admins or a silent full-unassign for admins on any edit |
| F2 | **Minor** | Bulk UX | Bulk delete/restore/status surfaces only "skipped N", never the skip **reason** (incl. the new `forbidden` ownership skip) |
| F3 | **Minor** | Notifications | `task_status_changed` desc shows no new status (`contextLabel` is empty) |
| F4 | **Minor** | Notifications | the `tasks` notification type reuses the `admission` icon/tint (`ClipboardList` / `bg-primary/10`) |

## 4. Findings detail

### F1 — Critical — `taskInsertSchema.safeParse` defeats the M5 assignee omission

**Evidence.** `hooks/useTaskFormController.ts:146-167`:
```ts
const payload: TaskInsert = buildTaskFormPayload({ … assignees: selectedAssignees, initialData });
const parsed = taskInsertSchema.safeParse(payload);
…
await onSave(parsed.data);
```
`lib/taskFormPayload.ts:61-64` deliberately omits `assignees` when unchanged:
```ts
if (!assigneesChanged(input)) {
  return base as TaskInsert;   // no `assignees` key
}
```
but `taskInsertSchema` (`packages/contracts/src/tasks/tasksModuleManifest.ts`) declares
`assignees: z.array(…).max(100).optional().default([])`, so `safeParse` on the omitted payload
re-adds `assignees: []` (verified: `taskInsertSchema.safeParse({title,…})` → `{…, assignees: []}`).

**Path → consequence.** On a title-only edit the form now sends `{ title, …, assignees: [] }`. The backend
M2 strip guard (`taskMutationService`) then sees a removal of every current assignee:
- **non-admin** (creator/assignee without `assign_anywhere`) → 403 "Removing assignees requires
  assign-anywhere permission" — the exact M5 regression this fix was meant to prevent;
- **admin / assign_anywhere** → the guard is skipped and `syncTaskAssignees(…, [])` soft-deletes every
  assignee — a silent full unassign (data loss of assignee relationships).

The `taskFormPayload.test.ts` spec only unit-tests `buildTaskFormPayload` in isolation, so the
re-parse step is unpinned and the whole flow stays green.

**Fix.** Validate with `taskUpdateSchema` for edits (its `assignees` is `.optional()` without a
default), and/or send the original `payload` rather than `parsed.data` so the omission survives
normalization. Pin with a controller test asserting a title-only edit produces a body with **no**
`assignees` key.

### F2 — Minor — bulk skip reasons are never surfaced

`hooks/useTasksBulkActions.ts:30-34,50-54,73-77` render `t("tasks.bulkSkipped", { count, skipped })`
using only `skipped.length`. The backend now returns per-row reasons (`forbidden`,
`has_active_children`, `parent_archived`, `illegal_transition`, …) but the UI drops them, so a user
whose bulk archive was partially blocked by ownership has no idea why. **Fix:** surface the localized
reason (e.g. group skipped counts by `TaskBulkSkipReason`), at minimum the `forbidden` case.

### F3 — Minor — status-change notification omits the new status

`useStoredNotifications.ts` maps `task_status_changed` to `notifications.taskStatusChangedDesc`
("The status of {subject} changed") and `deliverTaskNotification` stores an empty `contextLabel`, so
the recipient cannot see *which* status the task moved to. **Fix:** populate `contextLabel` with the
localized status label (or a separate translated sentence).

### F4 — Minor — `tasks` notification reuses the `admission` icon/tint

`lib/ui/dashboardNotificationIcons.ts` maps `tasks` to `{ icon: ClipboardList, bg: "bg-primary/10",
text: "text-primary" }` — identical to `admission`. Cosmetic; give tasks its own glyph/tint for
disambiguation.

## 5. Test gaps

| ID | Gap |
| --- | --- |
| T1 | No controller spec covers the F1 re-parse step (title-only edit → body must omit `assignees`) |
| T2 | No spec asserts bulk skip reasons are rendered |
| T3 | No spec asserts `task_status_changed` shows the new status |

## 6. Verified-clean surfaces

- `TasksSetupTab` `notificationChannel` selector: dirty-gated, `canEditSetup`-disabled, 4-locale i18n.
- Notification-kind wiring: `task_assigned`/`task_status_changed` copy + `tasks` target deep-link to
  the Work tab (`useOpenTenantNotification`).
- OCC propagation: `useTasksApi` sends `x-expected-updated-at`; `handleUpdateStatus` carries the row token.
- Selection scope: `useTaskSelectionScope` clears on filter/page change; pagination from server `total`.
- `TaskStatusMenu` 44px trigger with `aria-label`; `CopyBtn` 44px; no raw hex/bracket expressions.

## 7. Resolution

| ID | Priority | Change |
| --- | --- | --- |
| F1 | **Fixed** (d0eab29e3) | use `taskUpdateSchema` for edits / send `payload` not `parsed.data`; add the omission spec |
| F2 | Follow-up | surface `TaskBulkSkipReason` (at least `forbidden`) |
| F3 | Follow-up | populate `contextLabel` with the localized status |
| F4 | Follow-up | distinct `tasks` notification icon/tint |
