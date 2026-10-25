# Messaging Module — UI/UX Audit & Consolidation Report

Date: 2026-10-24 · Scope: Messaging module (work / reports / setup tiers, MessageComposer, templates, logs, CSV import/export) plus cross-module messaging triggers. Rules: `mms-messaging`, `mms-ui-ux-design`, `mms-dry`, `mms-structure-naming`, `mms-settings-i18n`, `mms-hooks`, `mms-module-architecture` §7. Reference baseline: commit `83d24e524` (previous messaging consolidation) — the module already consumes most shared SSOT primitives; this audit covers what remains.

## Severity definitions

- **High** — user-visible data loss/correctness or rule-mandated behavior missing.
- **Medium** — degraded interaction, a11y or i18n gap.
- **Low** — dead/duplicated code (SSOT hygiene, `mms-dry` §1/§4).

---

## High

### H1. Duplicate-submission guard on campaign launch is ineffective
`apps/frontend/src/tenant/features/messaging/MessagingPage.tsx` — `startCampaign` wraps a **synchronous** `openComposer` call in an async try/finally: `startingCampaign` is set `true` and reset in the same tick, so rapid double-activation (double click, Cmd/Ctrl+N held) is never deduped. Risk: opening two composer instances / duplicated state writers. **Fix:** make the guard actually span the async handler or use an in-flight ref with early return.

### H2. Header Export silently drops work-tier filters
`apps/frontend/src/tenant/features/messaging/components/MessagingPageView.tsx` — `handleExport` hardcodes `category:"all"`, empty `debouncedSearch`, `status:"all"` and omits date bounds, while `useMessagingWorkTierBulkActions.handleExportLogs` passes the real active filters. Two parallel export paths exist for the same server export (`messagingReportsExport.ts`); the header button exports unfiltered data and mislabels it as the user's current view. **Fix:** single export path — header delegates to the work-tier controller's filtered export.

### H3. No restore path for archived message logs
Soft-archive ("Clear/Archive Logs") is implemented (`DELETE /logs` → `deletedAt` + audit `messaging.logs.clear`), and archived logs surface the archive banner in `MessagingDetail` via `DetailDrawerArchiveChrome` — but the bulk bar stubs `onRequestBulkRestore={() => undefined}` and no restore endpoint exists (unlike the contacts gold standard: `registerSingleRestoreRoute` + `restoreContactById` with `restoredAt/restoredBy`, outbox `entity.restored`, audit `RESTORE`). **Fix:** `POST /api/messaging/logs/restore` + drawer restore affordance + `canRestoreMessagingLogs` permission gate (module-access rule).

### H4. Dispatch POSTs carry no idempotency key
`/api/messaging/dispatch/{sms,email,whatsapp}` (`messagingSmsDispatchRoute.ts`, `messagingEmailDispatchRoute.ts`, `messagingWhatsAppDispatchRoute.ts`): the shared schemas already accept `idempotencyKey` (8–128 chars) but the handlers ignore it — `mms-messaging` checklist item "Send/export: idempotency key bound to body digest (409 on mismatch)" is unmet for the send path (log-record batches and background export/import jobs already comply via the `auth_artifacts` claim pattern). **Fix:** `withMessagingIdempotency` wrapper + FE sends body-digest-bound key with retry key reuse; 409 on mismatch; queued path dedupes via job id.

---

## Medium

### M1. Keyboard navigation has no visual focus
`hooks/useMessagingWorkTierKeyboardNav.ts` tracks `focusedIndex` but no row/card renders focus (ring/highlight) or scrolls it into view; Space/Enter operate on rows the user cannot see. State also persists stale indexes across pagination/filter changes. **Fix:** visible `focus`-style highlight on the focused row/card, `scrollIntoView`, reset on data-set change.

### M2. Runtime-composed Tailwind class never compiles
`components/MessagingDetailBodyCard.tsx` — `selection:${SEMANTIC_BG.primary}` is built at runtime; Tailwind's scanner cannot see it, so the text-selection style silently does not apply. **Fix:** static semantic token classes.

### M3. Hardcoded non-i18n strings
- `"seg" / "segs"` in `MessagingListCardItem.tsx` and `useMessagingTableColumns.tsx` (SMS segment counters).
- `` `${n} chars` `` in `MessagingDetailBodyCard.tsx`.
Not translatable for ar/ur/fa consumers; violates `mms-settings-i18n` key parity. **Fix:** new keys in en/ar/ur/fa.

### M4. Terminology mismatch (code vs copy)
Internal naming says "clear" (`clearLogs`, `messaging.clearLogs` permission, `MessagingGatewayStatusOverview` copy hooks) while the surfaced copy says "Archive Logs". Not user-visible, but audit-trail/UX readers must cross-check. **Fix:** align confirm/copy strings around "Archive"; keep audit action code stable.

### M5. Responsive transition coverage
Cards view and table view both use shared primitives with server pagination and skeletons (par with `mms-module-work`), but keyboard selection + column persistence interplay on the mobile card surface should be re-verified after M1's focus work (cards must inherit the same focus affordance).

---

## Low (SSOT hygiene — `mms-dry` §1/§4)

### L1. Dead files & aliases
- `messagingRecipientsShared.tsx` (`MissingFieldBadge`) — zero consumers.
- `useMessagingRecipientsColumnLayout` in `useMessagingColumnLayouts.ts` — zero callers.
- Deprecated shim `features/messaging/hooks/useMessaging.ts` — verbatim re-export of `@/hooks/useMessaging`; import-path footgun.
- `MessagingBulkActionBar` alias in `MessagingWorkBulkActionBar.tsx` — self-duplicate export of the same component.
- `FormTagsInput.tsx` exports `TagsInput` — zero importers.

### L2. Parallel query-factory layer
`hooks/useMessagingQueries.ts` `useMessagingContract*` hooks duplicate the live `@/hooks/useMessaging` mutators; consumed only through the `tenant/hooks/collections/messaging.ts` facade and its tests — a dead second data surface (`mms-dry` §1 dual-path ban).

### L3. Hand-rolled card
`GatewayChannelCard` in `MessagingGatewayStatusOverview.tsx` builds a div-grid card manually instead of the shared directory-card stack (`mms-module-work`: no hand-rolled cards).

### L4. Cross-module duplicate launcher
`OutstandingFeeMessagingActions` in `components/dashboard-widgets/OutstandingFeesTableParts.tsx` hand-rolls WhatsApp/SMS icon buttons with raw lucide icons + local tone/aria styling — parallel to shared `EntityMessagingIconActions` / `messagingActionStyles`. Used by `OutstandingFeesTableDesktopBody` + `OutstandingFeesTableMobileList`. (`OverdueObligationsWidget` calls `openComposer` directly — acceptable since `useMessageComposerState` is the sanctioned pivot; note only.)

### L5. Non-canonical component homes / naming gaps
Requested canonical names vs current homes (mapped during consolidation):
- `ModuleDirectoryCards` (⟷ `EntityCardsGrid`, 23 consumers) — one canonical name chosen.
- `DirectoryEntityCard` (⟷ `DirectoryCard`, 21 consumers); `EntityCard` shell becomes internal.
- `DirectoryCardHeader/Metadata/MetaGrid/MetaTile/InfoPills/Footer/FooterActions/ViewButton` (⟷ `EntityCard*` family).
- `DirectoryCardsSelectAllBar` (⟷ `EntityCardsSelectAllBar`).
- `BulkSelectionBar` (⟷ `ModuleUniversalBulkActionBar`, 16 feature consumers).
- `DetailDrawerShell` (⟷ `Drawer`, 19 consumers).
- `LoadingState` (⟷ `FeedbackStateLayout`, `@shared/ui`).
- `Alert` (missing — `Callout`/`WarningCallout` family; build tone-based `Alert` in `@shared/ui`).
- `ActionButton` (⟷ `QuickActionButton`, 1 consumer).
- `DetailSheet` (missing composition — build over `Drawer` + detail-section parts).
- `FormTagsInput` (⟷ `TagsInput`, unused).
- `DirectoryCardSubtitleStack` exported from `PersonIdentityMeta.tsx` — extract to canonical file.

`ChannelBadge`, `MessagingMessageBodyField`, `MessagingVariableTokensBar`, `MessageComposer`, `EntityMessagingQuickActions/IconActions/DropdownItems`, `ContactAction`, `MessageComposerLauncher` already canonical (all live in `src/components/app/`; `ui/` holds only raw shadcn primitives by design — `mms-shared-ui` facade rule).

### L6. Recipient & contact linking
Composer recipients go through `TenantMessageComposerRecipientPicker` + `useMessagingWorkRecipients` (server-paginated, `/recipients/match` for select-all — compliant); `ContactPicker*` primitives in `src/components/contactLink/` remain the contact-lookup SSOT. No duplicate pickers found.

---

## UX improvement recommendations (aligned with `mms-messaging` & `mms-ui-ux-design`)

1. **Restore UX**: when restoring an archived log from the drawer, optimistically update + toast "Log restored" and re-open the same `?logId=` view; surface restore only when `canRestoreMessagingLogs`.
2. **Keyboard nav affordance**: mirror the j/k selection pattern used elsewhere with an explicit focus ring + `aria-activedescendant` on the listbox/table container so screen readers announce the focused log.
3. **Export feedback**: the header Export button should reflect the active filters ("Export 24 filtered entries") so users understand the single filtered export path.
4. **Guardrails**: `startCampaign` should be a one-per-tick launch with a subtle pressed animation; Cmd/Ctrl+N stays available.
5. **Archive language**: unify drawer/bulk-bar copy on "Archive / Restore" with consistent iconography (archive box), and ensure RTL-correct icons (`ms-`/`me-` only — no physical directional classes; the module is already compliant).
6. **Segments copy**: localize `"seg/segs"` as compact units in ar/ur/fa (e.g. Arabic numeral-aware abbreviated copy).

## Verification

`pnpm typecheck` · `pnpm --filter mms-frontend lint` (incl. `no-cross-feature-imports` + `no-physical-directional-classes`) · FE/BE test suites · `node scripts/check-shared-ui.mjs` · `moduleAccessCoverage` + `routeAccess` tests — all green post-fix (see Phase 7 of the plan).

---

## Resolution (same-day fixes)

All High and Medium findings plus the Low SSOT items are resolved in this change set:

- **H1** — `startCampaign` uses a ref-based in-flight guard held across the activation macrotask; queued duplicate activations (double click / held shortcut) are deduped without blocking a deliberate channel switch.
- **H2** — single export path: the header Export registers the work tier's filtered handler (`onExportLogsRegister`), so every export honors active search/status/category/date filters; the button is enabled only on the work tab.
- **H3** — `POST /api/messaging/logs/restore` implemented (contract + handler + `restoreArchivedMessageLog` + `restoredAt/restoredBy` migration `0187_message_logs_restore_attribution.sql`, `messaging.restoreLogs` permission, `MODULE_ROUTE_ACTION_RULES` coverage, RBAC + coverage tests) with a Restore action in the log detail drawer for archived logs.
- **H4** — `/dispatch/{sms,email,whatsapp}` now carry an idempotency key bound to the payload digest (`computeDispatchIdempotencyKey`, FE) checked server-side via the shared `withMessagingIdempotency` claim-or-replay (409 on body-digest mismatch, replay without re-send, queued jobs dedupe by key); dispatcher tests cover replay + mismatch.
- **M1** — j/k keyboard navigation renders a visible focus ring on the focused table row/card, scrolls it into view, resets on page/filter change, and suspends while a dialog owns the keyboard.
- **M2/M3** — static Tailwind `selection:` classes; `{count} chars` and segment counts use i18n (`messaging.charCount`, `messaging.smsSegmentBadge`) with en/ar/ur/fa parity.
- **L1–L5** — deleted: `messagingRecipientsShared.tsx`, `useMessagingRecipientsColumnLayout`, the deprecated `hooks/useMessaging` feature shim (consumers redirected to `@/hooks/useMessaging`), the `MessagingBulkActionBar` alias, and the orphaned `FormTagsInput`. The `useMessagingContract*` hook duplicates were removed (query option factories retained per `mms-query-factories`). `GatewayChannelCard` rebuilt on `WidgetCard`; `OutstandingFeeMessagingActions` replaced by shared `EntityMessagingIconActions`.
- **Canonical renames (single name, all consumers updated)** — `EntityCardsGrid→ModuleDirectoryCards`, `DirectoryCard→DirectoryEntityCard`, `EntityCard*` family→`DirectoryCard*` (Header/Metadata/MetaGrid/MetaTile/InfoPills/Footer/FooterActions/ViewButton), `EntityCardsSelectAllBar→DirectoryCardsSelectAllBar`, `Drawer→DetailDrawerShell`, `ModuleUniversalBulkActionBar→BulkSelectionBar`, `QuickActionButton→ActionButton`, `FeedbackStateLayout→LoadingState` (`@shared/ui`), `Callout/WarningCallout→Alert` (`@shared/ui`, alias collapsed), `DirectoryCardSubtitleStack` extracted to its own file. **`DetailSheet` intentionally not created**: `DetailDrawerShell` + the detail-section slot parts already are that composition — a second wrapper would be a duplicate-by-name abstraction (mms-dry §1).
- Files re-split to stay under the 300-line ratchet: `useMessagingDispatch.ts` (extracted dispatch mutations) and `messagingLogsMutationRepository.ts` (extracted log soft-delete/restore).
- Gating: `pnpm ci:local` passes (gates: all ratchets, typecheck, ESLint, frontend/shared/backend vitest).
