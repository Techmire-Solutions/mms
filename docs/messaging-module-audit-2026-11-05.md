# Messaging whole-module audit — 2026-11-05

End-to-end pass over the messaging module: backend routes/services/repositories, the composer
(model, dispatch, server gateway, draft), the module page/tiers/directory/drawer, and the shared
messaging schemas. Complements the three earlier passes (backend, frontend, UI/UX) — this one is
about runtime correctness under repeated/concurrent activation, metric semantics, and the code that
no longer has a consumer.

## Scope & method

- Traced the dispatch path end to end: composer → `useMessageComposerDispatch` →
  `dispatchViaServerGateway` → `POST /api/messaging/{sms,whatsapp,email}/dispatch` →
  `withMessagingIdempotency` claim → `directDispatch`/`messaging:dispatch` job →
  `claimMessageLogForDelivery` → provider adapter → `saveMessageLogDeliveryOutcomes`.
- Traced the read path: `queryFilteredMessageLogs` / `queryMessagingMetrics` → contract handlers →
  TanStack queries → directory/drawer/reports.
- Dead-code claims were verified with reference counts over `apps/backend/src` and
  `apps/frontend/src` **production code only** (tests excluded), then re-checked for facade exports.
- The local PostgreSQL instance was available, so the metrics change is proven by a real DB test;
  no database schema changed.

## Critical Fixes

### C1 — Single-recipient "Send" had no in-flight guard (duplicate dispatch)

**Where:** `apps/frontend/src/components/messageComposer/useMessageComposerDispatch.ts` (`sendOne`)
**Root cause:** the busy flags were only set by `sendAll`; `sendOne` checked `opening || saving` but
never set either, so `isBusy` stayed `false` for the whole gateway/device call and the recipient row
stayed enabled. Two activations (double-click, or click + keyboard) entered two dispatches. Device
mode opens a second `sms:`/WhatsApp composer; the audit write can run twice.
**Impact:** duplicate outbound messages from one click; the server claim only protects when both
requests carry the same submission key and arrive after the first claim.

```diff
+  const inFlightRef = useRef(false);
+
   const sendOne = async (recipient: MessagingRecipient): Promise<void> => {
-    if (opening || saving || !message.trim()) return;
+    if (opening || saving || inFlightRef.current || !message.trim()) return;
     ...
     if (useServerGateway) {
       const [validated] = validateMessagingRecipients([recipient], channel);
       if (!validated?.isValid) return;
-      await dispatchViaGateway([validated]);
+      inFlightRef.current = true;
+      setSaving(true);
+      try {
+        await dispatchViaGateway([validated]);
+      } finally {
+        inFlightRef.current = false;
+        setSaving(false);
+      }
       return;
     }
+    inFlightRef.current = true;
+    setSaving(true);
+    try { /* device send + audit */ } finally {
+      inFlightRef.current = false;
+      setSaving(false);
+    }
   };
```

`sendAll` (and the pending-audit branch) also take the same latch: the React-state guard depends on
the next render, the ref flips synchronously.

### C2 — Failed server dispatch escaped as an unhandled promise rejection

**Where:** same hook; callers are `useMessageComposerModel.handleSave` (`void dispatch.sendAll()`) and
`MessageComposer` (`void dispatch.sendOne(recipient)`).
**Root cause:** `dispatchViaGateway` awaits `mutateAsync`, which rejects on 403/409/429/5xx/network.
Both entry points only had `try/finally`, so the rejection propagated to the window; the mutation's
`onError` already toasted, so the user saw a toast but the console reported an unhandled rejection
(and Sentry noise) with no explicit recovery state.
**Impact:** error-report noise and no guarantee the composer resets to a retryable state; the retry
path (same submission key) was untested.

```diff
       if (useServerGateway) {
         setOpening(true);
-        await dispatchViaGateway(eligibleRecipients);
+        try {
+          await dispatchViaGateway(eligibleRecipients);
+        } catch (error) {
+          // Mutation `onError` already notified the user; keep the composer
+          // open so the retry reuses the same submission key.
+          reportClientError(error, { context: "messaging.composer.sendAll" });
+        }
         return;
       }
```

`senderOne` gets the same `try/catch` with `context: "messaging.composer.sendOne"`.

### C3 — `successRate` treated queued/sending/skipped rows as failures

**Where:** `apps/backend/src/db/repositories/messagingLogsQueryRepository.ts` (`queryMessagingMetrics`)
**Root cause:** `successfulTotal / total`, where `total` is every non-deleted log. A campaign that is
still `queued`/`sending` has zero successes yet, so a perfectly healthy campaign reported **0%**; a
`skipped` row (recipient has no address on file) lowered the rate although nothing was attempted.
**Impact:** the metrics response consumed by reports/API clients misreports campaign health at the
most common moment (right after dispatch).

```diff
-    const successfulTotal = sentCount + deliveredCount;
+    const failedCount = num("failed_count");
+    const successfulTotal = sentCount + deliveredCount;
+    // Attempted = rows that reached a delivery outcome (queued/sending/skipped
+    // are not attempts and must not dilute the rate).
+    const attemptedTotal = successfulTotal + failedCount;
...
-      successRate: total > 0 ? Math.round((successfulTotal / total) * 100) : 100,
+      successRate:
+        attemptedTotal > 0 ? Math.round((successfulTotal / attemptedTotal) * 100) : 100,
```

**Red → green evidence**

| Fix | Red (before) | Green (after) |
| --- | --- | --- |
| C1 | `expected "vi.fn()" to be called 1 times, but got 2 times` (batch and single send) | 4/4 `useMessageComposerDispatch` tests |
| C2 | `promise rejected "Error: dispatch failed" instead of resolving` (both entry points) | same suite resolves + `reportClientError` asserted |
| C3 | DB test: `expected +0 to be 100` (queued-only campaign) | DB test: 100 queued-only, 50 sent+failed, 33 with a skipped row |

## Recommended Refactors

### Implemented

1. **R1 — Memoize recipient validation.** `validateMessagingRecipients` + two `filter`s ran on every
   composer render (the composer re-renders per keystroke; up to 50 recipients). Extracted to
   `useComposerRecipientValidation` (`useMemo` on `[recipients, channel]`).
2. **R2 — Parse directory filters once.** `useMessagingWorkFilters` called
   `parseMessagingWorkFilters(searchParams)` on every render although the result only initialises
   state. Now parsed once into a `useState` snapshot that seeds the other initialisers.
3. **R3 — De-duplicate the server-gateway branches.**
   `messageComposerServerGateway.ts` repeated the queued → replayed → success/partial → close
   sequence for SMS, email and WhatsApp (~110 lines). The response handling is now one
   `applyServerDispatchResult` helper; each branch only builds its channel payload. Behaviour is
   pinned by the existing 6 gateway tests (queued, replayed, per-channel success, partial failure)
   plus the new dispatch tests.
4. **R4 — One page-count label.** `MessagingListDesktopTable` recomputed
   `formatDirectoryPageCountLabel` while the controller already produced `pageCountLabel` for the
   cards. The table now takes the controller label (fallback kept for standalone renders), so the
   table and cards cannot drift again.
5. **R5 — Keep the dispatch hook under the 300-line ceiling.** `useMessageComposerDispatch` grew past
   the hard ceiling while adding the latch, so the device batch loop, the gateway dispatcher factory,
   the single-recipient send flow and the validation hook now live in
   `messageComposerDeviceDispatch.ts`, `messageComposerGatewayDispatch.ts`,
   `messageComposerSingleSend.ts` and `useComposerRecipientValidation.ts` (hook is 297 lines).

### Proposed (not implemented — higher risk or needs a design call)

1. **SMTP transporter reuse.** `sendTenantEmail` creates a transporter per recipient; a 500-recipient
   campaign does 500 TLS handshakes. Reuse one transporter per dispatch batch (invalidate on
   credential change).
2. **Export page size mismatch.** The exporter requests `pageSize: 250`, but
   `MESSAGE_LOGS_MAX_PAGE_SIZE = 100` silently clamps it, so CSV export issues 2.5× more queries than
   intended. Align the constant or raise the clamp for internal exports.
3. **Sequential direct dispatch.** `directDispatch` awaits each recipient's provider call serially;
   a bounded concurrency (e.g. 5) would cut a 50-recipient sync dispatch from ~50× provider latency to
   ~10×, but changes the audit ordering guarantee — decide the ordering contract first.
4. **Per-page `count(*)` and `ILIKE` search.** `queryFilteredMessageLogs` runs a full `count(*)` on
   every page and a `LIKE` subquery over `contacts`; add a trigram index (or `count` reuse) when the
   directory grows.
5. **`toCompletedRecords` marks every eligible recipient `sent`** even on partial failure. Only the
   messaging page consumes `onSent` (invalidation), but a future caller displaying counts would be
   wrong; pass per-recipient results through the server response instead.
6. **Export button can no-op.** `MessagingPage.handleExport` silently returns when the Work tier has
   not registered its handler yet (first paint / after switching tabs). Disable the button until
   `exportLogsRef` is registered.

## Unused Code Candidates

**Nothing is deleted in this change.** Each item is listed with the reference count found in
production code; tests and facades were excluded from the count, so "0 immediate consumers" can still
mean "used by tests" or "exposed through a public facade". Confirm the reflection/dynamic-import
surface before deleting.

### Frontend

| Candidate | Location | Evidence |
| --- | --- | --- |
| `loadMatchingRecipients` | `hooks/useMessagingWorkRecipients.ts:43` | 0 callers (the picker uses `useMessagingRecipients`) |
| `messagingLogsListQueryOptions`, `messagingCommandMetricsQueryOptions` | `hooks/useMessagingQueries.ts:13,42` | referenced only by `tenant/hooks/collections/messaging.ts` and `queryFactories.test.ts`; no component uses the factories |
| `MessagingTarget.templateId` / `OpenComposerOptions.templateId` | `hooks/useMessageComposerState.ts:14,22` (written at 74/82) | never read; the composer's `templateId` state is independent |
| `isCopied`, `onCopyBody` props | `MessagingListCardItem.tsx:29,40` | declared, never destructured or passed |
| `roleOptions`, `genderOptions` | `hooks/useMessagingPageOptions.ts:46,55` | neither messaging consumer destructures them |
| `hasAnyGateway`, `lastTestOk` | `hooks/useMessagingGatewaysStatus.ts:21,11` | computed/returned, never rendered by either gateway surface |
| `getMessagingChannelAccentBarClass` re-export | `MessagingListCardItem.tsx:23` | no importer outside the card/token module |

### Backend

| Candidate | Location | Evidence |
| --- | --- | --- |
| `loadMessageTemplateById` | `messaging/use-cases/messagingUseCases.ts:43` | 0 production consumers (barrel re-export only) |
| `loadMessageTemplatesByIds` | `…:49` | 0 |
| `replaceMessageTemplates` | `…:56` | 0 (backup mapping calls `replaceMessageTemplatesForWorkspace` directly) |
| `loadMessageLogs` | `…:98` | 0 |
| `loadMessageLogsByIds` | `…:103` | 0 |
| `saveMessageLog` | `…:110` | 0 (writes go through claims/outcomes and `insertMessageLogs`) |
| matching re-exports | `services/messagingService.ts:11-13,17-19` | only the six above; the barrel itself stays for the export service |
| `findMessageTemplatesByIds`, `findMessageLogsByIds` | `db/repositories/messagingTemplatesRepository.ts:83`, `messagingLogsRepository.ts:100` | reachable only through the dead use-cases |
| `messageLogWriteValues`, `messageTemplateWriteValues` | `messagingLogsRepository.ts`, `messagingTemplatesRepository.ts` | exported but used only inside their own module |
| `createMessagingUseCases` | `messagingUseCases.ts` | exported; only used for the module singleton |

### Shared (`@mms/shared`)

`messageInsertSchema`, `messageUpdateSchema`, `messageLogListSchema`,
`messagingSmsDispatchResponseSchema` (and the email/WhatsApp response aliases),
`messagingCsvExportQuerySchema` — no production consumer found; most are still re-exported from the
package root, so external/fixture consumers must be confirmed before removal (list-only).

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend test messaging messageComposer` | **41 files / 147 tests pass** (baseline this morning 40/143) |
| `pnpm --filter mms-backend test messaging` | **14 files / 128 tests pass** |
| `pnpm --filter mms-backend test:db messagingLogsDb` | **4/4 pass** against real PostgreSQL |
| Red evidence | C1/C2: 4 failing hook tests; C3: DB test `expected +0 to be 100` (all captured before the fixes) |
| `pnpm --filter mms-frontend typecheck` | pass |
| `pnpm --filter mms-backend typecheck` | messaging files clean (repository has unrelated in-progress faculty errors) |
| ESLint + Prettier on touched files | 0 errors; Prettier clean; two advisory `react-hooks/refs` warnings on the intentional in-flight ref (CI lints with `--quiet`) |
| `check-code-norms`, `check-docs`, `check:i18n` | held (no keys changed) |
| `pnpm ci:local` | all gates for this change pass (typecheck, changed-file ESLint, code norms, docs, i18n); the run stops in the Prettier phase on 19 unrelated in-progress faculty/student/report files, which are left untouched |

New/changed specs: `useMessageComposerDispatch.test.tsx` (new), `messagingLogsDb.integration.test.ts`
(success-rate cases), plus the existing gateway/directory/table suites re-run after R3/R4.

## Assumptions

- Double activation is possible in practice (double-click, assistive technology, click + shortcut); a
  synchronous latch is the correct guard regardless of React event batching.
- The success rate is a *delivery* rate: queued/sending/skipped are excluded; no attempts → 100 (same
  convention the repository already used for empty workspaces).
- The gateway refactor is behaviour-preserving: same toasts, same ordering, same `onClose` timing.
- Dead-code candidates are recorded, not removed — deletion needs the explicit confirmation the
  request asked for.
