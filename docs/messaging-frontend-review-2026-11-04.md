# Messaging frontend review — 2026-11-04

Independent frontend review of the messaging module, complementing the backend pass in
`docs/messaging-backend-review-2026-11-04.md`. Scope: `apps/frontend/src/tenant/features/messaging/**`,
`components/messageComposer/**`, `components/app/MessageComposer.tsx`,
`tenant/components/messaging/**`, the messaging hooks (`useMessaging*`, `useMessageComposerState`),
the messaging entity descriptor, the settings/gateway status surfaces and the module route registry.
Backend, shared contracts and the worker were read only where the client calls them.

Round 1/2 (`docs/messaging-module-review-2026-11-04.md`) and the 2026-10-24 UI/UX audit fixed the
selection scope, single-send audit, keyboard guards, date presets, page reset, composer prefill,
memoized options, 44 px targets and the composer i18n; those were re-verified and are not re-reported.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend test messaging messageComposer` (pre-change) | **31 files / 97 tests pass** |
| Same command, post-change | **35 files / 124 tests pass** |
| `pnpm --filter mms-frontend typecheck` | pass (after clearing a stale incremental cache) |
| `pnpm run check:i18n` | 4 locales complete before and after the 21 new keys |
| `node scripts/i18n/check-unused-keys.mjs` | held (no new unreferenced keys) |
| Route access | registry-driven (`moduleRegistry.ts:145-149`, `access: moduleAccess("messaging")`) |

## 2. Verdict

The page architecture is sound: three tiers behind `useModulePermissions(MESSAGING_MODULE_MANIFEST)`,
`DataTable`/`DirectoryEntityCard`/`BulkSelectionBar` reuse instead of hand-rolled UI, archive and
restore gated on `messaging.clearLogs`/`restoreLogs`, the composer drafts per user per channel, the
submission key retries safely, and the server gateway is the default. What was wrong was the
**contract between the UI and what the send actually does**, plus the visibility of the result:
the copy promised a device app while the server dispatched, and a failed delivery never showed its
reason anywhere in the client.

## 3. Findings

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| H1 | High | **Dispatch copy describes device mode while the composer defaults to the server gateway.** The primary button reads "Open Messages"/"Open WhatsApp"/"Open all in Mail ({count})" and the note says the device app will open and "you choose when to tap Send". `DEFAULT_MESSAGING_PREFERENCES.defaultSmsMode` is `"gateway"` and WhatsApp/email default to the gateway, so pressing the button dispatches immediately (or queues >50 recipients). | Fixed |
| H2 | High | **Gateway failure reasons are never shown.** `message_logs.errorMessage` was referenced nowhere in the frontend; the drawer's "Failure Reason" panel and the card banner rendered `messaging.loadFailedHint` (the list-load hint), and a unit test pinned that placeholder. | Fixed |
| M1 | Medium | **Duplicate recipients bypass the composer's dedupe.** The `recipients` prop/draft were accepted verbatim and `openComposer` only filtered invalid addresses, so resending several logs to one guardian, or "notify guardians" for siblings, messaged that guardian twice. | Fixed |
| M2 | Medium | **Picker select-all fired one success toast per recipient** (50 toasts per page) because bulk toggle looped `onAdd`/`onRemove`. | Fixed |
| M3 | Medium | **Cmd/Ctrl+Enter was wrong both ways.** The composer and template form fired the shortcut through their discard-confirmation dialog (accidental send/save); the drawer ignored every event inside `[role='dialog']` — i.e. itself — so its advertised `(⌘+Enter)` was dead. | Fixed |
| M4 | Medium | **Gateway health was hidden.** `lastError`/`lastTestOk` are fetched but never rendered, so a gateway whose last test failed still read "Connected". | Fixed |
| M5 | Medium | **Hover-only row controls were invisible to keyboard focus** (`opacity-0 group-hover:opacity-100`, no focus reveal), and the contact filter's title was `selectRecipientsDesc`. | Fixed |
| M6 | Medium | **Work filter chips rendered raw i18n keys.** The entity descriptor's `messaging.columns.*` labelKeys existed in no locale; `translateApp` returns the key when missing, so an active chip read `messaging.columns.channel: SMS`. The parity gate is green because it only compares defined keys. | Fixed |
| M7 | Medium | **No select-all-matching.** `/recipients/match` has a client loader (`loadMatchingRecipients`) with zero call sites; the picker's select-all is page-scoped (50), so large campaigns require page-walking. The 2026-10-24 audit claims compliance. | Open — needs decision |
| L1 | Low | Bulk export labelled "Export Logs ({selectedCount})" but exports the filtered query, not the selection. | Fixed |
| L2 | Low | Read-only viewers saw custom templates tagged "SYSTEM" (badge gated on `canWrite && custom_`). | Fixed |
| L3 | Low | Skipped notice hardcoded `count: 1` and the phone address type even for an email log. | Fixed |
| L4 | Low | `?tab=setup` (or a persisted Setup tab) rendered the Setup tier for a role whose tab list hides it. Write access was still gated server-side. | Fixed |
| L5 | Low | Filters are one-way synced (state → URL): Back does not restore them and the sync then rewrites the URL; `?tab=` is read only on mount (tab state is backend-persisted). | Open — reported |
| L6 | Low | A deep-linked `logId` outside the current page opens nothing (no fetch-by-id) while the URL keeps the id. | Open — reported |
| L7 | Low | Dead/duplicated surface: `MessagingTarget.templateId` never forwarded, `messagingLogsListQueryOptions`/`messagingCommandMetricsQueryOptions` unused (the metrics variant also drops `endDate`), descriptor `errorMessage`/sortable flags unused by the hand-built drawer/table, an IIFE in the composer form, and the picker re-rendered above the confirm list in the compose step. | Open — reported |
| L8 | Low | Status filter/descriptor omit `sending`, so in-flight rows cannot be filtered although badges and metrics know the status. | Open — reported |
| L9 | Low | Resend before the async contact resolve finishes builds `{phone:"", email:""}`, and `openComposer` refuses with "no eligible recipients" — confusing, not wrong. | Open — reported |
| L10 | Low | Template copy uses raw `navigator.clipboard` without error handling; the save-error fallback reuses `createPresetDesc` copy as an error message. | Open — reported |

## 4. Open items — recommended fixes

- **M7** wire `loadMatchingRecipients` behind a "Select all matching ({total})" action in the picker,
  show the server `truncated` flag at the 10k cap, and keep page-scoped select-all for the visible
  rows. This is the capability the audit already assumes.
- **L5** decide whether URL or component state owns filters; if URL-owned, derive filter state from
  `searchParams` (`useMessagingWorkTierUrlSync` becomes a one-way setter only) so Back restores.
- **L6** either fetch the log by id for a deep link or drop an unknown `logId` from the URL.
- **L7** delete the unused query factories/target field, move the drawer/table to descriptor-driven
  rendering, and collapse the picker behind "Add recipients" in the compose step.
- **L8** add `sending` to the status filter options (shared manifest) so in-flight rows are filterable.
- **L9** render resend as disabled until the recipient resolves, or resolve on demand before opening
  the composer.
- **L10** use the shared `CopyBtn`/clipboard helper and a dedicated save-error key.

## 5. Fixes in this change

### H1 — the copy follows the dispatch mode

`messageComposerText.ts` now takes `useServerGateway` for the note and the primary-action label and
exposes `getRecipientSendLabel`, all returning gateway wording when the server dispatches
(`messaging.gatewaySendSms/Whatsapp/Email`, `gatewaySendAll`, `gatewayNoteSms/Whatsapp/Email`) and the
existing device wording otherwise. `useMessageComposerModel` threads the mode into note/label;
`MessageComposer` → `MessageComposerRecipients` → `MessageComposerRecipientsList` use it for the
per-recipient action. Device mode is unchanged.

### H2 — the failure reason is visible

The drawer panel renders `log.errorMessage` (fallback `messaging.failureReasonUnavailable`), the
metadata card gains a "Failure reason" row for failed logs, the card banner shows the reason
(truncated, full text in `title`), and the table's failed icon carries it as a tooltip. The old test
that asserted the placeholder copy now asserts the gateway reason and its absence.

### M1 — recipients are deduped where they enter the composer

`dedupeRecipientsById` (new, id-string–keyed) runs in `resolveComposerInitialState` (props **and**
draft) and in `useMessageComposerState.openComposer` before validation, so bulk resend and
notify-guardians can no longer duplicate a contact.

### M2 — picker select-all is one batch action

`RecipientPickerSlotProps` gained `onAddMany`/`onRemoveMany`. The recipient state and its four actions
now live in `useComposerRecipients` (extracted from the model, which was at the 300-line ceiling);
the batch variants emit one summary toast (`messaging.recipientsAdded` / `recipientsRemoved`) and the
picker uses them for select-all. Row clicks keep the per-row toasts.

### M3 — one shortcut implementation, correct guards

`keyboardGuards.isConfirmDialogOpen()` (narrower than `isOverlayOpen`: `[role='alertdialog']` only)
and the new `useCmdEnterShortcut({ enabled, onTrigger, allowTyping })` replace all three local
handlers. The composer and template form pass `allowTyping: true` and now stop at an open
confirmation; the drawer passes `allowTyping: false` and no longer swallows its own event, so the
advertised shortcut works.

### M4 — gateway health is honest

The gateway card renders `lastError` (truncated, full text in `title`) under the provider/sender rows.

### M5 — hover-only controls are keyboard-visible and labelled

Both table controls gained `group-focus-within:opacity-100 focus-visible:opacity-100`; the contact
filter uses `messaging.filterByContact` for its `title`/`aria-label`, and the card action uses the
same key instead of `common.filters`.

### M6 — descriptor labels resolve

Added the seven `messaging.columns.*` keys to en/ar/ur/fa and pinned them with
`messagingDescriptors.test.ts` (every descriptor `labelKey` must exist in the English pack). Filter
chips now show "Channel: SMS" instead of raw keys.

### L1–L4 — copy and gate corrections

- L1: the bulk export action uses `messaging.exportLogsFiltered` ("Export matching logs") without a
  count, matching the filtered-query behaviour.
- L2: `isCustom` drives the SYSTEM tag; edit/delete render only for custom templates with write access.
- L3: the skipped notice uses the email address type for email logs.
- L4: `resolveActiveTab` clamps the active tier to `visibleTabs` (and strips the stale `tab` param),
  so a hidden Setup tier cannot be deep-linked into.

## 6. Red evidence

One `git stash` round-trip of the nine implementation files against the new tests produced **13
failures / 20 passes**, one per fix group:

```
× returns the note for the mode that will actually dispatch
× labels the primary action for the server gateway
× labels per-recipient send actions for the active mode
× dedupes repeated contacts before handing them to the composer
× adds a page of recipients with one summary toast
× collapses duplicate recipients passed in by bulk callers
× surfaces the last gateway error instead of implying the channel is healthy
× renders the gateway failure reason on a failed log
× displays the gateway failure reason for failed messages
× saves on Cmd/Ctrl+Enter but never through an open confirmation dialog
× resends on Cmd/Ctrl+Enter from inside the drawer
× does not resend through an open confirmation dialog
× keeps hover-only row controls keyboard-visible and correctly labelled
```

The descriptor-label test was red before the locale keys were added (`messaging.columns.body:
expected undefined to be defined`) and green after.

## 7. Re-verified as correct

- Three-tier page gated by `useModulePermissions(MESSAGING_MODULE_MANIFEST)`; Setup read-only without
  `configuration.view`; archive toggle and restore gated on `clearLogs`/`restoreLogs`; the CSV import
  dialog uses `messaging.write` like its endpoint.
- Work directory: `DataTable`/`WorkBatchTable` stack, server pagination with `placeholderData`,
  scope-keyed selection (filters/page/archived), shift-click ranges, j/k navigation through
  `keyboardGuards`, `/` and Escape wiring, filter chips from the entity descriptor.
- Composer: per-submission idempotency key (`resolveSubmissionKey`), retry/partial-audit handling,
  server-gateway mutations with `Idempotency-Key`, replay notice, per-user/channel `sessionStorage`
  draft with quota handling, token errors surfaced on blur, SMS segment/encoding footer, live preview.
- Templates: `DataTable` list, system/custom distinction server-enforced as well, discard guard for the
  sub-tab switch, copy/duplicate/edit/delete wiring, memoized option surfaces.
- Reports tier delegates to the shared `ModuleReportsTier`; metrics strip has an error/retry state.

## 8. Adversarial audit (`mms-completion-review.md` §4)

1. **Edge cases / payload integrity.** Duplicate ids collapse (numeric vs string), empty selection
   keeps the old bulk behaviour, the batch picker path dedupes against the already-selected set, and a
   hidden tab cannot render its tier.
2. **Failure modes.** Failure reasons now reach every surface that reports a failure; shortcut
   handlers stop at confirmation dialogs; the gateway card shows the last error; the send label
   matches what the click does.
3. **Security / multi-tenancy.** No client-side gate was weakened: backend remains the authority for
   messaging permissions and tenant scope; the changes are visibility/copy-only, plus the Setup-tier
   clamp which narrows what renders.
4. **Concurrency / UX state.** Dedupe happens at the composer boundary (not per keystroke); the
   shortcut hook re-registers on enable/allowTyping changes; tab clamping is a pure function of the
   visible tab list.

## 9. Verification evidence (post-fix)

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend test messaging messageComposer` | **35 files / 124 tests pass** |
| `pnpm --filter mms-frontend typecheck` | pass |
| ESLint (touched files, `--no-cache`) | clean (one pre-existing `useVirtualizer` compiler warning) |
| `pnpm run check:i18n` | pass (21 new keys × 4 locales) |
| `node scripts/i18n/check-unused-keys.mjs` | held (no new unreferenced keys) |
| `node scripts/check-docs.mjs` | pass |
| `pnpm ci:local` | all automated gates pass for this change (typecheck, ESLint, code norms, structure, i18n, docs); the repo-wide Prettier phase still flags unrelated in-progress faculty files, none of the files touched here |
| New specs | `messageComposerRecipientsUtils.test.ts`, `useComposerRecipients.test.tsx`, `useCmdEnterShortcut.test.tsx`, `resolveActiveTab.test.ts`, `messagingDescriptors.test.ts` + added cases |
| `node scripts/check-code-norms.mjs` | held (file-size ceiling, `any`, colour tokens) |
| Playwright `messaging-campaign` | not run (needs live servers) |

**Working-tree caveat.** Other work was landing in the same tree during this pass (dashboard/faculty/
contacts). One transient vitest run failed at import because the shared Vite dep cache was being
rewritten; the re-run is green. The two files ESLint warns about are untouched by this change.

## 10. Still open from the module review

Composer draft keys are per user and channel (good) but there is no cross-tab coordination; the
`module setup` sub-tab dirty guard covers templates only; the reports tier is shared and not
messaging-specific. No new debt beyond §3's open rows.
