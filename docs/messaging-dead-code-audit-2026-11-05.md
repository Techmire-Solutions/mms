# Messaging dead-code audit — 2026-11-05

Focused sweep for unused imports, dead functions, obsolete types, unused locals, and orphaned files
across the messaging module (frontend feature + composer, backend routes/use-cases/repositories/
services, shared messaging schemas). **No files were deleted.** Only zero-risk in-file cleanup was
applied; everything exported is listed below for confirmation first.

## Method & safeguards

| Check | How it was run |
| --- | --- |
| Unused imports / locals | `tsc -p apps/frontend/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters` (and the backend tsconfig), filtered to messaging paths |
| Cross-file references | Word-boundary scan of every `*.ts`/`*.tsx` in the repo, split into **production** vs **test** references; references from barrels/facades counted separately |
| Orphaned files | Import-specifier scan (`"./X"`, `"@/…/X"`, `"…/X.js"`) plus dynamic-import path strings over all messaging directories |
| Dynamic imports / entry points | Verified lazy composer imports (`React.lazy(() => import("…/TenantMessageComposer"))`), page entries (`MessagingPage` via route access config), backend route registration (`messagingContractRouter` imports every route module), shared package barrels (`entry/index*` re-export every messaging schema file) |
| Unused dependencies | Third-party imports in the module (`recharts`, `lucide-react`, `react-query`, `nodemailer` via services) all resolve to packages used by the importing code; no module-exclusive package is unimported |

**Orphaned files: none.** Every file under `apps/frontend/src/tenant/features/messaging`,
`apps/frontend/src/components/messageComposer`, `apps/frontend/src/tenant/components/messaging`,
`apps/backend/src/routes/tenant/messaging`, `apps/backend/src/messaging`, and
`packages/shared/src/messaging` is reachable from an import specifier or a lazy/route registration
(0 assets: the module has no CSS/SVG/JSON files of its own).

## Applied cleanup (verified zero references, including tests)

| Target File | Item / Import to Remove | Reason |
| --- | --- | --- |
| `apps/frontend/src/tenant/features/messaging/hooks/useMessagingWorkRecipients.ts` | `loadMatchingRecipients()` and its `MessagingRecipientsMatchResponseDto` import | **0 references anywhere**; the picker uses `useMessagingRecipients` for server pagination. Removing it also removed the only `matchRecipients` call in the composer path |
| `apps/backend/src/routes/tenant/messaging/messagingLogIdempotency.ts` | `replyIdempotencyBodyMismatch()` | **0 references anywhere**; handlers return the 409 body directly since the idempotency refactor |
| `apps/frontend/src/tenant/features/messaging/components/MessagingDetail.tsx` | `React` default import | TS6133 — automatic JSX runtime; only named `useCallback/useState/JSX` are used |
| `apps/frontend/src/tenant/features/messaging/components/MessagingWorkBulkActionBar.tsx` | `React` default import | TS6133 |
| `apps/frontend/src/tenant/features/messaging/components/useMessagingTableColumns.tsx` | `React` default import | TS6133 |
| 15 messaging/composer test files | `React` default import | TS6133 (same automatic-runtime reason); named imports retained |

```diff
--- a/apps/frontend/src/tenant/features/messaging/hooks/useMessagingWorkRecipients.ts
-import type {
-  MessagingRoleFilter,
-  MessagingGenderFilter,
-  MessagingRecipientsMatchResponseDto,
-  MessagingRecipientsPageResponse,
-  StandardMessagingRecipient,
-} from "@mms/shared";
+import type {
+  MessagingRoleFilter,
+  MessagingGenderFilter,
+  MessagingRecipientsPageResponse,
+  StandardMessagingRecipient,
+} from "@mms/shared";
@@
-/**
- * Loads matching lean recipients for “Select All With Phone/Email” via one server call.
- */
-export async function loadMatchingRecipients(params: { … }): Promise<…> {
-  const response = await apiContract.messaging.matchRecipients({ … });
-  …
-}
-
```

```diff
--- a/apps/backend/src/routes/tenant/messaging/messagingLogIdempotency.ts
-export function replyIdempotencyBodyMismatch(reply: {
-  status: (code: number) => { send: (body: unknown) => unknown };
-}) {
-  return reply.status(409).send(MISMATCH_BODY);
-}
-
 /** A claim is stale when its 24 h expiry minus the TTL puts the claim time more than … */
```

## Candidates — pending confirmation (exported surface, not removed)

### Backend: test-only use-cases and their barrel exports

`services/messagingService.ts` is imported in production only by `messagingExportService.ts`
(`loadFilteredMessageLogs`, `resolveMessagingRecipients`). The rest of its re-exports are referenced
only by tests, and their use-case methods have no production caller:

| Target File | Item / Import to Remove | Reason |
| --- | --- | --- |
| `apps/backend/src/messaging/use-cases/messagingUseCases.ts` | `loadMessageTemplateById` | production refs: 0 (tests only) |
| same | `loadMessageTemplatesByIds` | production refs: 0 (tests only) |
| same | `replaceMessageTemplates` | production refs: 0 (backup mapping calls `replaceMessageTemplatesForWorkspace` directly) |
| same | `loadMessageLogs` | production refs: 0 (tests only) |
| same | `loadMessageLogsByIds` | production refs: 0 (tests only) |
| same | `saveMessageLog` | production callers: 0 (writes go through claims/outcomes and `insertMessageLogs`) |
| `apps/backend/src/services/messagingService.ts` | re-exports on lines 11–13 and 17–19 | each points at a method above |
| `apps/backend/src/db/repositories/messagingTemplatesRepository.ts` | `findMessageTemplatesByIds` | only used by `loadMessageTemplatesByIds` |
| `apps/backend/src/db/repositories/messagingLogsRepository.ts` | `findMessageLogsByIds` | only used by `loadMessageLogsByIds` |
| `apps/backend/src/messaging/repository/messagingRepositoryAdapter.ts` | corresponding adapter wiring | keeps dead methods on the interface alive |

```diff
--- a/apps/backend/src/messaging/use-cases/messagingUseCases.ts
-    loadMessageTemplateById: async (id: string): Promise<MessageTemplate | null> => { … },
-    loadMessageTemplatesByIds: async (ids: string[]): Promise<MessageTemplate[]> => { … },
-    replaceMessageTemplates: templateBulkService.replace,
-    loadMessageLogs: async (): Promise<Message[]> => { … },
-    loadMessageLogsByIds: async (ids: string[], includeDeleted = false): Promise<Message[]> => { … },
-    saveMessageLog: async (record: Message): Promise<void> => { … },
```

Removing them also lets the adapter/interface methods used only by those use-cases drop away;
`bulkSaveMessageLogs` and `saveMessageLog` themselves stay because the legacy data migration
`035_migrate_messaging_to_tables.ts` and the upsert spec still call them directly.

### Shared: zero-reference exports (`@mms/shared` public surface)

These have **0 references anywhere** in the monorepo (production and tests). They are exported from
the package root, so treat as public-API cleanup and confirm external consumers before removal:

| Target File | Item / Import to Remove | Reason |
| --- | --- | --- |
| `packages/shared/src/schemas/messaging.dto.ts` | `messageInsertSchema`, `messageLogListSchema`, `MessageInsert`, `MessageUpdate`, `MessagingLogsQueryDto`, `MessagingMetricsQueryDto`, `MessagingCsvExportBodyDto` | 0 refs |
| `packages/shared/src/schemas/messagingTemplate.dto.ts` | `messageTemplateInsertSchema`, `messageTemplateUpdateSchema`, `MessageTemplateInsert`, `MessageTemplateInputDto` | 0 refs (the contract uses `messageTemplateSchema` + `messageTemplateInputSchema`) |
| `packages/shared/src/messaging/messagingDispatchSchemas.ts` | `MessagingSmsDispatchDto`, `MessagingEmailDispatchDto`, `MessagingWhatsAppDispatchDto`, `MessagingEmailDispatchResponseDto`, `MessagingWhatsAppDispatchResponseDto`, `messagingEmailDispatchResponseSchema`, `messagingWhatsAppDispatchResponseSchema` | 0 refs (only the SMS response schema is consumed) |
| `packages/shared/src/messaging/messagingModuleManifest.ts` | `MessagingModuleTier`, `MessagingRecipientDto`, `MessagingResolveResponseDto` | 0 refs |
| `packages/shared/src/messaging/messagingModuleManifest.ts` | `MESSAGING_ROLE_FILTERS`, `MESSAGING_GENDER_FILTERS`, `MESSAGING_STATUS_FILTERS` | exported but only used inside the manifest to derive its types/options (drop `export`) |

### Frontend: dead fields, props, and re-exports

| Target File | Item / Import to Remove | Reason |
| --- | --- | --- |
| `apps/frontend/src/tenant/features/messaging/components/MessagingListCardItem.tsx` | `isCopied`, `onCopyBody` props | declared but never read; the only "usage" is the component test passing them |
| `apps/frontend/src/tenant/features/messaging/hooks/useMessagingPageOptions.ts` | `roleOptions`, `genderOptions` | computed and returned; no messaging consumer destructures them |
| `apps/frontend/src/tenant/features/messaging/hooks/useMessagingGatewaysStatus.ts` | `hasAnyGateway`, `lastTestOk` | returned but never rendered; only test mocks reference them |
| `apps/frontend/src/hooks/useMessageComposerState.ts` | `templateId` on `MessagingTarget` / `OpenComposerOptions` | written by `openComposer`, never read (the composer's own state is independent) |
| `apps/frontend/src/tenant/features/messaging/hooks/useMessagingQueries.ts` + `tenant/hooks/collections/messaging.ts` | `messagingLogsListQueryOptions`, `messagingCommandMetricsQueryOptions` and their facade re-exports | only `queryFactories.test.ts` consumes them; no component/hook uses the factories |
| `apps/frontend/src/tenant/features/messaging/components/MessagingListCardItem.tsx` | `export { getMessagingChannelAccentBarClass }` | no importer outside the card/token module |

### Over-exported internals (drop the `export` keyword — no behaviour change)

| Target File | Item / Import to Remove | Reason |
| --- | --- | --- |
| 25 `*Props` interfaces across the messaging/composer files | `*Props` interfaces, e.g. `MessagingDetailProps`, `MessageComposerTextProps`, `RecipientRowProps`, `UseMessagingTableColumnsOptions` | used only inside their own module; exporting widens the surface for no consumer |
| `apps/backend/src/routes/tenant/messaging/messagingDirectDispatch.ts` | `DirectDispatchParams`, `DirectDispatchRecipient`, `DirectDispatchSummary` | own-file only |
| `apps/backend/src/routes/tenant/messaging/messagingLogIdempotency.ts` | `MESSAGING_IDEMPOTENCY_STALE_MS`, `MessagingIdempotencyPayload`, `MessagingIdempotencyOutcome`, `MessagingDispatchSummary`, `messagingIdempotencyLookupKey` | own-file only (`TTL` and `idempotencyBodyMatches` are imported by tests and stay) |
| `apps/backend/src/db/repositories/messagingLogsRepository.ts` | `messageLogWriteValues`, `ListMessageLogsOptions` | own-file only |
| `apps/backend/src/db/repositories/messagingTemplatesRepository.ts` | `messageTemplateWriteValues` | own-file only |
| `apps/backend/src/db/repositories/messagingLogsMapper.ts` | `MessageLogInsertValue` | own-file only |
| `apps/backend/src/services/messagingCampaignJobRunner.ts` | `MessagingDispatchJobPayload` | own-file only (`*_BATCH_SIZE`/`*_PROGRESS_INTERVAL` are test seams) |
| `apps/backend/src/services/messagingExportService.ts` | `MessagingCsvExportOptions`, `MessagingCsvExportResult` | own-file only (`MessagingCsvExportLimitError` is asserted by tests) |
| `apps/backend/src/routes/tenant/messaging/messagingLogRecordHandler.ts` | `findUnknownLogTokensError` | own-file only |
| `apps/backend/src/messaging/use-cases/messagingUseCases.ts` | `createMessagingUseCases` | own-file + test factory seam |

### Kept deliberately (test seams, documented)

`parseMessagingWorkFilters`, `notifyServerDispatchOutcome`, `idempotencyBodyMatches`,
`MESSAGING_IDEMPOTENCY_TTL_MS`, `MESSAGING_OUTCOME_BATCH_SIZE`, `MESSAGING_PROGRESS_INTERVAL`,
`MessagingCsvExportLimitError`, `DEFAULT_MESSAGE_TEMPLATES`, `appendVariableToken`,
`filterActiveMessageLogs`, `isMessageLogDeleted`, `MESSAGING_ROLE_OPTIONS`,
`MESSAGING_GENDER_OPTIONS`, `MESSAGING_STATUS_OPTIONS`, `ComposerRecipientsState` — exported and
imported only by tests; kept as intentional seams (removing them would inline constants into specs).

## Verification after cleanup

| Check | Result |
| --- | --- |
| `tsc --noUnusedLocals --noUnusedParameters` (messaging filter) | 0 findings (was 18 unused `React` imports) |
| Re-scan for zero-reference exports | only the candidates listed above remain; no new dead code introduced |
| `pnpm --filter mms-frontend test messaging messageComposer` | **41 files / 147 tests pass** |
| `pnpm --filter mms-backend test messaging` | **14 files / 128 tests pass** |
| Frontend/back-end typecheck | clean for messaging (unrelated in-progress files excluded) |
| ESLint (`--quiet`), Prettier, code-norms, docs | pass |

## Assumptions

- `@mms/shared` exports are a public package contract even when the monorepo has no consumer; the
  shared table is therefore list-only until external consumers are confirmed.
- Test-only exports are intentional seams, not dead code, unless the symbol has no other reader.
- "Orphaned" means no import specifier, dynamic import, route registration, or barrel re-export
  reaches the file; this audit found none.
