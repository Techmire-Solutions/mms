# Messaging UI/UX review — 2026-11-04

Interaction and information-design pass over the messaging module (Work directory, detail drawer,
composer, Setup/Preferences, gateway status, reports surfaces), following the backend
(`docs/messaging-backend-review-2026-11-04.md`) and frontend (`docs/messaging-frontend-review-2026-11-04.md`)
passes from the same day. The 2026-10-24 audit (`docs/messaging-ui-ux-audit-2026-10-24.md`) covered
SSOT/duplication and is not re-reported.

## 1. Method & limits

- Static review of every messaging component/hook plus the shared primitives they render
  (`ModuleScaffold`, `WorkBatchTable`, `ModuleDirectoryCards`, `BulkSelectionBar`, `DetailDrawerShell`,
  `FormModal`, `ReportChartCard`).
- `node .agent/skills/mms-ui-ux-design/scripts/check-bidi-classes.mjs` over the messaging feature and
  composer/shared messaging components: **pass** — no physical directional classes.
- Baseline suite: `pnpm --filter mms-frontend test messaging messageComposer` — **35 files / 124 tests**.
- **No live browser was run.** The local dev servers are down and starting a replacement server is out
  of scope, so this review makes no claim about rendered screenshots, real axe results or observed
  layout shift. Everything below is grounded in the rendered component tree, Tailwind classes, ARIA
  attributes and copy.

## 2. What already holds up

- Three-tier scaffold with `ModuleScaffold` header, KPI strip, `ResponsiveAccordionTabs`, tier-motion
  wrapper and per-tier error boundaries; Setup read-only message exists (see U1 for its wiring bug).
- Work directory reuses `WorkBatchTable`/`ModuleDirectoryCards` (virtualised above 30 items),
  server-side pagination with placeholder data, skeletons, `ErrorState` + retry, filter/empty/archived
  states, scope-keyed selection, j/k navigation and keyboard-visible focus.
- Composer uses `FormModal`, a per-submission idempotency key, server-gateway mutations with replay
  feedback, per-user/channel drafts, token validation and an SMS segment/encoding footer.
- Setup uses `DataTable` for presets, a save footer for preferences, and a read-only gateway overview.
- All colour/typography flows through semantic tokens and `SEMANTIC_*` classes; interactive controls
  are mostly ≥44 px; charts use the zero-CLS `ReportChartCard` + `SafeResponsiveContainer`.

## 3. Bugs fixed

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| U1 | High | **Setup was blank for view-only roles.** `canEditSetup=false` replaced the whole tier with a notice saying "you can view setup…", while the sub-tabs, template list and preferences lived in the editable branch. | The notice now sits **above** the content; subtabs, preset list (read-only) and preferences always render for view access. |
| U2 | High (a11y) | **Desktop table rows could not be opened by keyboard.** `WorkBatchTableRow` drops `role/tabIndex/Enter` when a row has selection or row actions (nested-interactive guard); messaging always has selection and only Resend — so keyboard/screen-reader users had no way into the drawer from the table. | Added an always-rendered **View details** icon action (permission-independent) next to Resend; the mouse row click is unchanged. |
| U3 | Medium | **Archived empty state was wrong.** It used the active-view "select recipients" description, offered the first-run "New campaign" CTA and had no way back to active logs (`onShowActive` unset). | New `resolveMessagingDirectoryCopy` picks archived copy, suppresses the campaign CTA; the empty state gets `onShowActive` + "Show active logs". |
| U4 | Medium | **Archived mode looked active.** Archived rows/cards were visually identical, the bulk bar hardcoded `viewingDeleted={false}` (offering "Archive all logs" instead of restore) and bulk restore was a no-op although the shared bar and `POST /logs/restore` support it. | Archived rows/cards are muted; a caption with "Show active logs" appears above the list; the bulk bar switches to **Restore selected** (permission-gated, confirm dialog) and hides the filter-scoped export. |
| U5 | Medium (i18n) | **Mixed-script content had no `dir="auto"`.** Message bodies/subjects (and template bodies) inherited the UI direction, mis-ordering punctuation/numbers in Urdu/Arabic content shown in an LTR UI (and vice versa). | `dir="auto"` on the card body/subject, table body cell, drawer body/subject, template list/cell and live-preview body/subject. |
| U6 | Medium (a11y) | **Drawer log-id copy was a 24 px target** (the gateway "configure" row also pinned a 28 px height over the shared 44 px floor). | Copy control is `min-h-11 min-w-11`; the gateway row drops the `h-7` override. |
| U7 | Medium | **Counts disagreed and understated the results.** Cards said "N recipients", the table said "N logs", and the toolbar's "N messages shown" was page-only. | Both views count `messaging.log/logs`; the toolbar reads **"{count} of {total} messages shown"** (`formatShownMessagesLabel`, total clamped to the visible page). |
| U8 | Medium | **The failure banner read as a global count** while it and its Resend act on the current page only. | Copy is now **"{count} failed on this page"**. |
| U9 | Low | **The dispatch-mode row repeated its own label** ("SMTP Gateway : [SMTP Gateway | Email App]") with a dangling, space-padded colon. | Single "Send via" label for every channel; the options keep their own names. |
| U10 | Low | **Card crash on a malformed `sentAt`**: `new Date(x).toISOString()` throws on legacy/invalid values. | `machineDate()` returns `undefined` for invalid dates; `formatDateTime` already degrades. |
| U11 | Low | **Dead-end contact link** for messaging-only roles ("View profile" → `/contacts` is gated on `contacts.read`). | Link renders only when `contacts.read` is granted. |
| U12 | Low | **Two primary Resend buttons** in the drawer for a failed log (footer + failure panel). | The panel keeps the reason; the footer Resend (and ⌘+Enter) is the only action. |
| U13 | Low | **Messaging report empty state used composer copy** ("select recipients to compose…") on a reports page. | New `messaging.reportEmptyDesc` ("Send a campaign to see delivery analytics here."). |
| U14 | Low (a11y) | **The volume chart had no text alternative** although `ReportChartCard` renders children `inert` and exposes `accessibleSummary` (Tasks charts pass one). | The chart passes a localized per-channel summary; chart data now carries the stable channel id. |

### Red evidence

Reverting the implementation files to `HEAD` and running the new/updated specs produced **23 failures /
9 passes**, including: archived caption + show-active, archived empty copy/CTA, page-scoped failure
copy, archived bulk-restore mode, view-details action, setup read-only content, `dir="auto"` on
card/table/drawer, 44 px copy target, single Resend, contact-link gating, mode-row label and the chart
summary. The run also flags the previous pass's drawer shortcut because those files were uncommitted
in the same working tree.

## 4. Improvement backlog (not implemented)

1. **Composer compose step repeats the picker.** The two-step flow renders the full 50-row picker
   above the confirm list in the compose step, so the message form competes with a second selection
   surface. Collapse it behind an "Add recipients" action.
2. **No sort affordance.** `/history` accepts `sortField/sortDir` and the entity descriptor marks
   channel/status/category/sentAt sortable, but the table has no sortable headers and no sort select.
3. **Global actions inside the selection bar.** "Archive all logs" is a global, destructive action and
   "Export matching logs" is filter-scoped, yet both live in a bar that only appears for a selection.
   Move them to the toolbar/menu; keep selection-scoped actions in the bar.
4. **Import placement.** The header Import button imports Setup templates but is visible on every tab.
5. **Undiscoverable shortcuts.** W/S/E, `/`, j/k, Space, Enter and Esc work but are not listed anywhere;
   add `kbd` hints in the New Campaign menu and/or a shortcuts help dialog.
6. **KPI cards do not filter.** `ModuleCommandMetricsGrid` supports `onClick/isActive`; clicking
   SMS/WhatsApp/Email should filter the directory to that channel.
7. **Metrics scope is unlabeled.** The strip is all-time while the list is filtered; label it or feed
   the active date range.
8. **Gateway cards deep-link only to Settings → Global**; link the channel's integration panel.
9. **`sending` is missing from the status filter/descriptor**, so in-flight rows cannot be filtered.
10. **No page-size selector** (fixed 50).
11. **Directory error-boundary fallback has no retry.**
12. **Headings/alerts lack `text-wrap: balance/pretty`** per the design checklist.
13. **`messaging.skippedNotice` grammar** ("contact(s)") for a single recipient.
14. **The dedicated Messaging report is only reachable from the global Reports module**; link or embed
    its channel breakdown from the module's Reports tier.
15. **Archived single restore lives only in the drawer** (bulk restore is now covered).

## 5. Verification

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend test messaging messageComposer` | **40 files / 143 tests pass** (baseline 35/124) |
| `pnpm --filter mms-frontend typecheck` | pass |
| ESLint on touched files | clean |
| `pnpm run check:i18n` | pass (9 new keys + `shownCount` total param × 4 locales) |
| `node scripts/i18n/check-unused-keys.mjs` | held |
| `pnpm exec prettier --check` on touched files | clean |
| `pnpm ci:local` | every gate passes except changed-file ESLint, which reports 3 errors in unrelated in-progress contacts/students files; the messaging files lint clean when run directly |
| `node scripts/check-code-norms.mjs` / `check-docs.mjs` | held / pass |
| Live browser + axe | **not run** (see §1) |

New specs: `MessagingWorkTierDirectory.test.tsx`, `MessageComposerDispatchControls.test.tsx`,
`MessagingReportsVolumeChart.test.tsx`, `messagingDirectoryCopy.test.ts`, `messagingCounts.test.ts`,
plus assertions in the setup-tier, table, card, detail and gateway specs.

## 6. Assumptions

- Archived restore reuses the existing endpoint/permission; no backend change.
- `dir="auto"` is safe for Latin content and correct for mixed runs in both directions.
- Moving global actions (items 3–4) and adding sorting (item 2) are information-architecture changes
  and stay in the backlog rather than being folded into this bug-fix pass.
- The page-size, `sending` filter and KPI-click items depend on shared component/manifest changes and
  are documented for a follow-up.
