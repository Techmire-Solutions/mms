# MMS Tasks Module — UI/UX Review — 2026-11-19

Read-only UI/UX review of the Tasks frontend surface at `HEAD e720b0dd9` against the MMS BiDi/design-token/scaffold contract (`mms-ui-ux-design` + `ui-ux-pro-max`). Browser/axe/CLS verification is out of scope (static scan only, stated explicitly).

**Scope.** `apps/frontend/src/tenant/features/tasks/**` + the notification surface that renders task kinds.

**Method.** `check-bidi-classes.mjs` + `check:code-norms` + targeted static walk of the checklist (BiDi, tokens, touch floor, text-wrap, `dir="auto"`, virtualization, chart sizing, status-badge semantics, emoji, primitives).

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `node .agent/skills/mms-ui-ux-design/scripts/check-bidi-classes.mjs` | ✅ 4,228 files scanned — zero physical directional classes |
| `pnpm run check:code-norms` | ✅ 0 raw hex / bracket colours in source (only test-fixture hex in `TasksReportsTab.test.tsx`) |
| `pnpm --filter mms-frontend typecheck` | ✅ |
| Frontend tasks/notifications/route-access suites | ✅ 117 passed |

## 2. Verdict

The Tasks UI is in strong contract compliance — **no Critical or Major findings**. BiDi logical classes, semantic tokens, the 44px touch floor on the main controls, status-badge colour+text pairing, chart theme tokens, and the three-tier scaffold are all correct. The findings are three Minor gaps around `dir="auto"` coverage and text-wrap consistency.

## 3. Findings

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| U1 | **Minor** | BiDi | Mixed-script user content is not wrapped in `dir="auto"`/`BiDiText` in the **card** description/assignee names and the **drawer** description/assignee names. The table title is covered (goes through `TableCellLink`, which sets `dir="auto"`), but the card (`TaskCardItem` via `DirectoryCardMetaTile`) and drawer (`TaskDetailDrawer` `DetailAttributeRow` values) render plain strings, so RTL titles/names inside the LTR chrome can reorder punctuation incorrectly. Contacts/Platform modules already use the shared `BiDiText` for this |
| U2 | **Minor** | Performance | The cards view (`TasksListCards`) renders the full page (up to 50) without `@tanstack/react-virtual`, while the table view virtualizes via the shared `WorkBatchTableVirtualizedRows`. Borderline at the 50-row page size, but above the ">30 items" guidance |
| U3 | **Minor** | Typography | `text-wrap: balance`/`pretty` is applied only in `TasksReportsTab` and `TaskDetailDrawer`; task titles in the table (`line-clamp`-free `truncate`) and card headers rely on truncation rather than balanced wrapping |

## 4. Verified-clean surfaces

- **BiDi**: zero `pl/pr/ml/mr/left/right/text-left/text-right/border-l/border-r` across the tasks surface.
- **Tokens**: no raw hex or arbitrary bracket colours; charts use `chartTooltipStyle()`/`chartAxisTick()` + `hsl(var(--destructive|--success))`.
- **Touch floor**: `TaskStatusMenu` 44px trigger + `aria-label`; `TableCellLink tap` (`min-h-11`); `CopyBtn` `h-11 w-11`; toolbar/filter controls are shared `Button`/`FormSelect`/`Input` primitives that enforce the floor.
- **Status semantics**: `TaskStatusConfig`/`TaskPriorityConfig` pair every badge with localized `t()` copy (no colour-only status).
- **Charts**: fixed-height `ReportChartCard` (`h-chart-md`) containers with `accessibleSummary` for screen readers; no emoji icons (Lucide only).
- **Scaffold**: three-tier Work/Reports/Setup; server-paginated directory (footer from `total`); selection scope clears on filter/page change.

## 5. Test gaps

- No visual/RTL smoke test pins the card/drawer `dir="auto"` behaviour (U1).
- No CLS test asserts the reports cards reserve chart dimensions (present via `h-chart-md`, but unpinned).

## 6. Resolution

| ID | Priority | Change |
| --- | --- | --- |
| U1 | Follow-up | wrap card/drawer user-content (description, assignee names) in the shared `BiDiText` (or `dir="auto"`), matching Contacts/Platform |
| U2 | Follow-up | virtualize `TasksListCards` with `@tanstack/react-virtual` (or confirm 50/page is an accepted ceiling) |
| U3 | Follow-up | apply `text-wrap: balance`/`pretty` to task-title headings consistently |
