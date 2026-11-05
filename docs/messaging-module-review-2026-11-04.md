# MMS Messaging Module Review — 2026-11-04

Independent, read-only-first review of the messaging module at `main` (`44871c86c`, working tree clean
at review time), followed by fixes for the Critical/Major findings in the same change set. Line numbers
below are from the tree **as reviewed**; the resolution log names the files that changed (their line
numbers moved).

Scope: `apps/frontend/src/tenant/features/messaging/**`,
`apps/frontend/src/components/messageComposer/**`, `components/app/MessageComposer.tsx`,
`apps/frontend/src/hooks/useMessaging*.ts`, `apps/backend/src/routes/tenant/messaging/**`,
`apps/backend/src/messaging/**`, `apps/backend/src/db/repositories/messaging*`,
`apps/backend/src/db/schema/messaging.ts`, `apps/backend/src/services/messaging*.ts`,
`apps/backend/src/services/backgroundJobRunnerService.ts` (messaging branch),
`packages/shared/src/messaging/**`, `packages/shared/src/schemas/messaging.dto.ts`,
`packages/shared/src/contracts/messaging.contract.ts`, the messaging module manifest, and the
module-access route table. Contacts, storage and the worker were read only where messaging calls them.

Method: three parallel layer surveys (HTTP surface, persistence/async, frontend) against the rule
bodies, then every finding was re-proven on the path production uses before it was accepted as
"broken" (`mms-completion-review.md` §4). Items that could not be proven on that path are labelled
**hypothesis** or **untested**, never "broken".

---

## 1. Baseline evidence (pre-fix)

| Check | Result |
| --- | --- |
| `bash .agent/skills/mms-code-review/scripts/pre-pr-review.sh` (rules/skills integrity, i18n, shared purity/structure, migration hygiene, projections, work-directory convergence, shared UI, docs, script tests, ratchets, backend boundaries, code norms, typecheck, ESLint) | **21/21 pass** |
| `moduleAccessCoverage.test.ts` | pass (no messaging action pinned) |
| i18n | 265 `messaging.*` keys × 4 locales, zero parity gaps |
| File size cap (300 LOC) | no messaging file over the cap (largest: `useMessageComposerModel.ts`, 284) |
| Prior messaging audit | `docs/messaging-ui-ux-audit-2026-10-24.md` (UI/UX + SSOT only; no delivery/idempotency semantics) |

Every automated gate was already green, so the findings below are the ones the ratchets cannot see:
send-once semantics, permission-gate alignment, the archived-log lifecycle, and audit atomicity.

## 2. Verdict

The module's bones are good: tenant RLS is enforced at the repository seam, server-owned audit fields
are stripped on write, the token allowlist is enforced three times, the queued campaign runner already
claims recipients before sending, and the export is a real background job with row/byte caps. What was
missing was **delivery correctness under retry** and **gate/lifecycle alignment**:

1. A repeat campaign with identical content was replayed as a successful no-op for 24 h.
2. The direct (≤50 recipient) dispatch path had no send-once claim, so a failed write after sending
   re-sent everyone on retry.
3. Archived logs could not be listed (`includeDeleted` was a no-op on the contract route), so the
   Restore action shipped in the October audit was unreachable.
4. Archive/restore audit trails were written in a second transaction and the archive never stamped
   `deleted_by`.
5. Bulk selection survived filter/page changes, so bulk resend could hit rows the user could not see.

## 3. Findings summary

### Critical / Major

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| C1 | **Critical** | Delivery / idempotency | The client derived the idempotency key from the payload digest, so a deliberate repeat campaign (or a log "resend") within the 24 h TTL replayed the stored response and **sent nothing** while reporting success |
| C2 | **Critical** | Audit / soft-delete | `DELETE /logs` archived in one transaction and wrote the audit in another, and never stamped `deleted_by` — attribution lost, archive committed even when the audit failed |
| M1 | **Major** | Delivery / retry | Direct dispatch sent from memory and persisted afterwards; a failure after the send released the claim, so the retry re-sent already-delivered recipients (the queued runner already did this right) |
| M2 | **Major** | Directory UX | Bulk selection had no scope key — it survived filter/search/page/archived changes and bulk resend acted on invisible rows |
| M3 | **Major** | Log lifecycle | `GET /api/messaging/history?includeDeleted=true` passed the permission check but returned active rows (`"true"` string vs `=== true`), so archived logs never listed and Restore was dead UI |
| M4 | **Major** | Module gate | `DELETE /api/messaging/logs` resolved to `write` while the handler requires `messaging.clearLogs`; a role holding clearLogs but not write was denied by the gate |
| M5 | **Major** | Module gate | CSV export declared the `export` action, which falls back to `messaging.read` (the manifest has no export permission) while the handler requires `messaging.write` |
| M6 | **Major** | Observability | All 13 ts-rest messaging handlers ended in `catch { → 500 }` with no log, no error span, and no exception cause |
| M7 | **Major** | Audit / CDC | Restore committed, then emitted the outbox event fire-and-forget and wrote the audit in a separate transaction — a restore could be published/attributed only partly or not at all |
| M8 | **Major** | Export safety | `MESSAGING_CSV_EXPORT_MAX_BYTES` was enforced only in the buffered builder; the worker streams, so the production export path had no byte cap (50k rows × 10k-char bodies ≈ 500 MB against a 25 MB cap) |
| M9 | **Major** | Composer / audit | The per-recipient "Send" in the composer called the device composer directly and never recorded a `message_logs` row |
| M10 | **Major** | A11y / keyboard | The log drawer registered a window-level `Cmd/Ctrl+Enter` handler with no field/dialog guard — pressing it while typing elsewhere resent the open log |
| M11 | **Major** | Dates | Date presets used `toISOString()` (UTC), so "Today" was yesterday for users east of UTC (Asia/Karachi is UTC+5) |
| M12 | **Major** | Directory UX | Filter changes did not reset the page index, leaving the directory on an empty page after narrowing filters |

### Minor

| ID | Finding |
| --- | --- |
| m1 | Idempotency digest was `sha256(JSON.stringify(...))` (not RFC 8785) and compared with `===`, not constant-time |
| m2 | Replays never emitted `Idempotency-Replay: true` (`mms-api-interface` §6) |
| m3 | Dispatch/export ignored the standard `Idempotency-Key` header (body field only) |
| m4 | A crashed in-flight claim blocked its key with `409 still in progress` for the full 24 h TTL |
| m5 | `sortField`/`sortDir` were accepted by the list contract and silently ignored by the repository |
| m6 | Preferences update emitted no audit event |
| m7 | Needless IIFE derivations in `MessagingPage` and the selection hook |
| m8 | Template delete returned success unconditionally and left no audit row |
| m9 | `restoredAt`/`restoredBy` were written to the row but omitted from every projection and from the shared DTO, so restore evidence could not surface |
| m10 | The email dispatch `html` field accepted `<script>`/`javascript:` payloads and forwarded them to SMTP |
| m11 | The mutating part of the ts-rest surface (clear/restore/record) had no strict rate limit |
| m12 | `POST /logs/restore` accepted an unbounded `ids` array |
| m13 | CSV export resolved recipient names with an empty viewer role instead of the session role |
| m14 | The campaign runner stamped every log row with the campaign start time, misdating the tail of a long campaign |
| m15 | Success toasts reused action labels ("Delete", "Clear Log History", "Save template") as success copy |

### Test gaps (not defects)

- **T1** No test touched `/api/messaging/history` at all — why M3 was green (only the legacy `/logs`
  alias was covered, with a mocked use case).
- **T2** `EXPECTED_MODULE_ROUTE_ACTIONS` pinned only students routes, so a wrong messaging action could
  not fail CI.
- **T3** No test covered the dispatch idempotency **semantics** (distinct submissions vs retries), only
  replay/mismatch on one key.
- **T4** No test asserted the direct dispatch is send-once when a recipient was already claimed.
- **T5** No frontend test covered selection scope, filter→page reset, or the archived view flag.

## 4. Findings detail

### C1 — Critical — a repeat campaign silently sent nothing

`apps/frontend/src/hooks/useMessagingDispatch.ts:14-18` computed
`idempotencyKey = SHA-256(normalized payload)` and reused it at lines 53/87/119. The server replays any
completed artifact whose key matches (`apps/backend/src/routes/tenant/messaging/messagingLogIdempotency.ts:138-146`,
TTL 24 h at line 12), and the replay was consumed as a fresh success
(`messageComposerServerGateway.ts`: `sentCount > 0 → onSent + success toast`). Consequence: sending the
same message to the same recipients twice in a day — including the log "resend" path
(`MessagingPage.tsx:190`) — returned the first run's `{sentCount}` and delivered **zero** messages. The
rule requires the key to be *bound* to a body digest; it never required the key to *be* the digest.

### C2 — Critical — clear-logs lost its actor and split its audit

`softDeleteActiveMessageLogs()` (`messagingLogsMutationRepository.ts:8-20`) set `deleted_at`/`updated_at`
only, although `deleted_by`/`deletion_reason` exist (`schema/messaging.ts:53-54`), and the handler ran
the archive (`messagingLogContractHandlers.ts:187`) and `recordModernAuditEvent` (line 191) as two
separate transactions. A failure between them returned 500 with the archive already committed and no
attributable event — breaking the §4 soft-archive contract and `mms-data-layer` §5.4/§5.9.

### M1 — Major — direct dispatch was not send-once

`messagingSmsDispatchRoute.ts:112-172` (mirrored for email/WhatsApp) collected logs in memory and called
`recordMessageLogs` after the loop. When that write threw, `withMessagingIdempotency` deleted the claim
(`messagingLogIdempotency.ts:164-167`), the request returned 500, and the documented retry re-ran the
loop from recipient 0 — re-sending everyone. The queued runner already solved this with
claim-before-send (`services/messagingCampaignJobRunner.ts:57-76`).

### M2 — Major — selection outlived its view

`useMessagingWorkTierSelection.ts:10` held `selectedById` in plain state with no scope key; the
controller (`useMessagingWorkTierController.ts:93`) fed it straight into bulk resend/export. After
changing channel/status/search/page, "resend selected" hit rows no longer displayed.

### M3 — Major — archived logs were unreachable

The contract used `baseListQuerySchema` (`packages/shared/src/contracts/messaging.contract.ts:50`),
whose `includeDeleted` is `z.union([z.boolean(), z.enum(["true","false"])])` **without** a transform
(`core/apiSchemas.ts:13`). The handler checked the flag with `isQueryFlagTrue` but forwarded the raw
query (`messagingLogContractHandlers.ts:49-59`), and the repository compared `=== true`
(`messagingLogsQueryRepository.ts:58`). Result: the admin passed the gate and still saw only active
logs; nothing ever lists archived rows, so `MessagingDetail.tsx:117` (restore) and `canRestoreLogs`
were dead code. The legacy `/logs` alias parsed the transforming `messagingLogsQuerySchema`, so the two
paths disagreed about the same operation.

### M4 — Major — clear-logs gate did not match the handler

`resolveModuleRouteAction` defaults mutating methods to `write` (`lib/moduleRouteActions.ts:118-139`)
and the messaging manifest has no `delete`/clear action, so `DELETE /api/messaging/logs` required
`messaging.write` while the handler required `messaging.clearLogs` (line 170) and the UI showed the
button on `canClearLogs` alone (`MessagingWorkBulkActionBar.tsx:42`).

### M5 — Major — export gate was weaker than the handler

The shared export rule declares `action: "export"`; `getModuleActionPermission` resolves `export` to
`p.export ?? p.read` (`moduleAccessPolicy.ts:128-129`) and messaging defines no export permission, so a
read-only role cleared the gate and was then 403'd in-handler (fails closed, but the gate lied).

### M6 — Major — handler failures were swallowed

`messagingLogContractHandlers.ts` (63, 106, 200, 271), `messagingTemplateContractHandlers.ts`,
`messagingRecipientContractHandlers.ts`, `messagingPreferencesContractHandlers.ts` and
`messagingLogRecordHandler.ts:92` all ended in `catch { → 500 }`. Only the status line was logged
(`plugins/requestHooks.ts`), because ts-rest never throws into the Fastify error pipeline and the
telemetry `onError` hook never fires.

### M7 — Major — restore published and audited outside its transaction

`messagingLogContractHandlers.ts:237-268`: restore committed, then `void emitOutboxEvent(...)` (not
awaited) and a separate-transaction audit. A restore could therefore be visible with no CDC event and
no audit row.

### M8 — Major — the streaming export had no byte cap

`MESSAGING_CSV_EXPORT_MAX_BYTES` appeared only in `buildMessagingCsvExport` (line 143), which the
worker does not use — the runner prefers `generateMessagingCsvStreamChunks`
(`registerModuleCsvExportJobRunner.ts:128-130`), which streamed unbounded chunks to storage.

### M9–M12 (frontend)

- **M9** `MessageComposer.tsx:157` passed `dispatch.executeSend` as `onSendOne`; that path only opens
  `sms:`/`wa.me`/`mailto:` and never calls `recordDispatches`, so single-recipient sends left no audit
  row and bypassed the server gateway even in server mode.
- **M10** `MessagingDetail.tsx:65-75` added a `window` keydown listener with no `e.target`/dialog guard.
- **M11** `MessagingListFilters.tsx:77` built presets from `toISOString()` (UTC), off by one day
  everywhere east of UTC.
- **M12** `useMessagingWorkFilters.ts:61` kept `logsPage` across filter changes.

## 5. Test gaps closed

| Gap | Spec |
| --- | --- |
| T1 | `GET /api/messaging/history` now covered: archived-view permission (403 for a teacher), `includeDeleted` forwarded as a **boolean**, default `false`, page-size rejection, sort pass-through, unknown sort rejection |
| T2 | `moduleAccessCoverage.test.ts` pins `DELETE /api/messaging/logs → availability`, `POST /api/messaging/logs/restore → availability`, `POST /api/messaging/export/csv → write` |
| T3 | `messageComposerSubmissionKey.test.ts` pins retry-reuse vs changed/completed-new key; `messageComposerServerGateway.test.ts` pins the replayed-response notice |
| T4 | `messagingSmsDispatch.integration.test.ts` pins send-once when a recipient was already claimed, plus claim/outcome assertions and the `Idempotency-Replay` header |
| T5 | `useMessagingWorkTierSelection.test.tsx` pins scope reset and archived gating; `useMessagingWorkFilters.test.tsx` pins the `archived` URL flag |
| — | `messagingIdempotency.test.ts` pins canonical digests, constant-time compare, stale-claim reclaim, in-flight 409, mismatch 409 and claim release on failure |
| — | `messagingExportService.test.ts` pins the streaming byte cap and the session-role name resolution |

## 6. Resolution log

Status legend: **Fixed** = code + pinning test on production's path · **Partial** = narrowed but a named
residual remains · **Deferred** = reported, not changed here.

| ID | Status | Change | Evidence |
| --- | --- | --- | --- |
| C1 | Fixed | Composer owns a per-submission key (`messageComposerSubmissionKey.ts`): retries reuse it, a changed or completed submission mints a new one; dispatch mutations send it as body field **and** `Idempotency-Key` header; the server keeps the canonical-digest binding (409 mismatch) and marks replays (`replayed` + `Idempotency-Replay: true`), and the UI reports a replay as "already sent" instead of success | `messageComposerSubmissionKey.test.ts`, `messageComposerServerGateway.test.ts`, `messagingIdempotency.test.ts` |
| C2 | Fixed | `softDeleteActiveMessageLogs(tenant, userId, reason)` stamps `deleted_by` + `deletion_reason`; clear now archives **and** audits inside one `withTenant` transaction (the audit joins the active tx) | `messaging.integration.test.ts` (clear asserts `clearAllMessageLogs("demo", "u-admin")` inside the handler transaction), repo assertions |
| M1 | Fixed | New `messagingDirectDispatch.ts` claims each recipient (`buildMessageLogClaimId` → `claimMessageLogForDelivery`) before the provider call and records the outcome per recipient; unclaimed recipients are counted as `skippedCount` instead of re-sent. The three channel routes delegate to it (≈90 duplicated lines removed) | `messagingSmsDispatch.integration.test.ts` ("stays send-once…"), `messagingCampaignDispatch.integration.test.ts` |
| M2 | Fixed | `useMessagingWorkTierSelection` carries a `scopeKey` (channel/category/status/search/dates/page/archived) with the selection — a mismatch reads as empty and the next toggle rewrites it (no setState-in-effect) | `useMessagingWorkTierSelection.test.tsx` |
| M3 | Fixed | `listLogs` now validates with `messagingLogsQuerySchema` (boolean `includeDeleted`, `sortField`/`sortDir`, page-size cap); the handler's gate uses the parsed boolean; the Work tier gained an **Archived** toggle gated by `messaging.clearLogs`, an archived empty state and `viewingDeleted` wiring, so Restore is reachable | `messaging.integration.test.ts` (4 history tests), `useMessagingWorkTierSelection.test.tsx` (archived gating) |
| M4 | Fixed | `MODULE_ROUTE_ACTION_RULES` maps `DELETE /api/messaging/logs` to `availability` (grant + enablement only) so `messaging.clearLogs` decides; pinned in the coverage test | `moduleAccessCoverage.test.ts` |
| M5 | Fixed | The shared export rule now has `exceptModules: ["messaging"]`, so `POST /api/messaging/export/csv` resolves to `write`, matching `canWriteMessaging` | `moduleAccessCoverage.test.ts` |
| M6 | Fixed | Every messaging contract handler logs the failure (`operation` + message) before returning 500; template delete also verifies existence and writes a `messaging.templates.delete` audit row | `messaging.integration.test.ts` (template delete audits) |
| M7 | Fixed | Restore, its outbox `entity.restored` event and its audit row now share one `withTenant` transaction (both helpers resolve the active tx) | `messaging.integration.test.ts` (restore paths with the outbox seam) |
| M8 | Fixed | `generateMessagingCsvStreamChunks` counts UTF-8 bytes per chunk and throws `MessagingCsvExportLimitError` past `MESSAGING_CSV_EXPORT_MAX_BYTES` | `messagingExportService.test.ts` (streaming cap) |
| M9 | Fixed | `sendOne` sends the recipient and persists its history row (its own submission counters); in server mode it goes through the same gateway as the batch | `useMessageComposerDispatch` (composer suite green) |
| M10 | Fixed | The drawer's `Cmd/Ctrl+Enter` handler ignores events from inputs/textareas/selects/contenteditable and from inside a dialog | `MessagingDetail.test.tsx` suite green |
| M11 | Fixed | Presets use `formatDateToIso` (local calendar) from `@mms/shared` | `MessagingListFilters` (filters suite green) |
| M12 | Fixed | All filter setters (and the archived toggle, and `clearFilters`) reset `logsPage` to 1 | `useMessagingWorkTierSelection.test.tsx` |
| m1 | Fixed | `messagingDispatchBodyDigest` uses `canonicalizeJson` (RFC 8785); comparison is `crypto.timingSafeEqual` | `messagingIdempotency.test.ts` |
| m2 | Fixed | Direct dispatch and export set `Idempotency-Replay: true` on replay; replay bodies carry `replayed` | `messagingSmsDispatch.integration.test.ts`, `messagingCampaignDispatch.integration.test.ts` |
| m3 | Fixed | `resolveIdempotencyKey` now receives the `Idempotency-Key` header on all dispatch routes and the export route | `messaging.integration.test.ts` (header export test) |
| m4 | Fixed | Pending claims older than `MESSAGING_IDEMPOTENCY_STALE_MS` (5 min, derived from the artifact expiry) are reclaimed instead of returning 409 for 24 h | `messagingIdempotency.test.ts` (stale reclaim) |
| m5 | Fixed | The history repository honours `sortField` from a fixed allowlist (`MESSAGING_LOG_SORT_FIELDS`) with `sortDir`; the shared query schema validates both | `messaging.integration.test.ts` (sort pass-through/rejection) |
| m6 | Fixed | Preferences update writes a best-effort `messaging.preferences.update` audit row after a successful save | handler change + preferences suite green |
| m7 | Fixed | IIFEs replaced with direct derivations in `MessagingPage` and the selection hook | lint/typecheck |
| m8 | Fixed | Template delete returns `not_found` when the id is absent and audits the removal | `messaging.integration.test.ts` |
| m9 | Fixed | `restoredAt`/`restoredBy` added to `messageRecordSchema` and to every log projection/mapper | typecheck + history contract test |
| m10 | Fixed | Email dispatch rejects executable markup in `html` (`containsExecutableHtml`: script/iframe/object/embed, `javascript:`, inline handlers) with 400 | `messagingPersonalizationGuard` + email suite green |
| m11 | Fixed | The contract router applies the strict `MESSAGING_LOG_RATE_LIMIT` guard to non-GET contract routes (clear/restore/record); reads keep the global limiter | `messagingContractRouter.ts` |
| m12 | Fixed | `messagingRestoreLogsBodySchema.ids` capped at 500 | `messaging.integration.test.ts` (501 ids → 400) |
| m13 | Fixed | Export job payload carries `viewerRole`; the runner threads it into the generator and `resolveMessagingRecipients` | `messagingExportService.test.ts`, `messaging.integration.test.ts` |
| m14 | Fixed | The campaign runner stamps `sentAt` per recipient | `messagingCampaignRunnerRetry.test.ts` green |
| m15 | Fixed | Dedicated success keys (`messaging.templateDeleted`, `messaging.templateSaved`, `messaging.logsArchived`, `messaging.dispatchAlreadySent`, `messaging.singleSendAuditFailed`) in en/ar/ur/fa | `check:i18n` |

## 7. Deferred & accepted (named residuals)

| Item | Why deferred | Residual |
| --- | --- | --- |
| Retention starts at `deleted_at`, so an **active** log is never purged (`schema/messaging.ts:59-61` + `purgeArchivedRecordsJob.ts:109-115`) | Product/data-retention decision (TTL from `sent_at` vs from archive) plus DDL + backfill | Active logs grow until cleared; documented, not silently changed |
| `sent_at` is `varchar(35)` and `created_at`/`updated_at` are naive `timestamp` in DDL while Drizzle declares timestamptz (`schema/messaging.ts:47,62`; migrations 0053/0000) | Forward-only DDL + backfill of historical rows | Lexical range filters are correct only while every writer emits `toISOString()` |
| Campaign runner does two tenant transactions per recipient (claim + outcome) and a progress patch every 5 | Needs a batched claim/outcome repo API; correctness is fine today (recipients capped at 500) | 500 recipients ≈ 1,000 short transactions |
| Aborted/timed-out campaign attempt leaves a `sending` claim, and a BullMQ retry within the 10-minute stale window counts it as skipped | Releasing the claim biases toward duplicate sends; reclaim policy is a product decision, and a crash cannot run cleanup code anyway | Possible silent non-delivery for the interrupted recipient; needs a claim sweeper or attempt-aware reclaim |
| Migration `0107` wraps `BEGIN; … COMMIT;` inside Drizzle's single migration transaction (0108–0203 then run in autocommit) | Shared migration history; editing applied migrations violates forward-only | Per-file atomicity lost for later migrations; needs a follow-up migration/repair decision |
| Purge worker emits one outbox row per purged id (sequential) | Shared worker, not messaging-owned | §5.10 batching opportunity |
| CSV import replay has no body-digest comparison (`registerModuleCsvImportRoutes`) | Shared helper used by every module | Key reuse with a different body returns the old job |
| Queued jobs do not re-check module availability/permission at execution | Worker-level, cross-module policy | Disabling messaging mid-queue does not stop a queued campaign |
| `getUserBackgroundJob` ignores its `userId` argument | Shared background-job service | Same-tenant user with a leaked job id gets a 409 instead of a miss |
| `message_templates` has no soft delete (hard delete + audit only) | Table classification decision (`docs/soft-delete.md` §10) | Template deletion is irreversible except by re-creating |
| `'sending'` status is outside the shared enum and is cast; metrics count it in `total` with no bucket | Enum + metrics contract change ripples into filters/reports | Diluted success rate during in-flight campaigns |
| `retentionDays: 365` in the manifest has no consumer (hardcoded in DDL) | Wiring it needs a migration-capable consumer | Manifest/DDL can drift |
| Search uses `ILIKE '%…%'` on body/subject with no trigram index; `count(*)` re-runs per export page | Index/extension decision + per-page count is a broader export refactor | Slow search at scale |
| FE: "Clear Log History" sits in a **selection** bar but archives all logs; subtitle copy is concatenated translated fragments; ~19 hygiene IIFEs/24px icon targets/dead props/dead manifest column-pref keys | Copy/UX decisions and hygiene, not correctness | Documented as follow-up debt |
| Hypotheses (unproven, need runtime): 500-recipient campaign may exhaust its 3 attempts; naive timestamps may shift on a non-UTC API host; S3 multipart orphans; module-availability cache lag; `/recipients/match` sequential page loads | Require production data/load tests | None changed |

## 8. Adversarial audit (`mms-completion-review.md` §4)

1. **Edge cases & payload integrity.** Empty/oversized `ids` (now capped), unknown sort field (400),
   `pageSize` over the cap (400), empty personalization tokens (400), executable HTML in email `html`
   (400), missing tenant context (400). Canonical digests make key-order retries stable.
2. **Failure modes & silent failures.** Every messaging contract handler now logs its failure before
   500; the streaming export fails closed at the byte cap; a replayed dispatch is reported as "already
   sent" rather than a fake success; a failed claim/outcome write is logged per recipient.
3. **Security, authorization & multi-tenancy.** RLS remains repository-owned; the clear/restore gate
   now matches the handler capability; export matches its writer requirement; archived logs stay behind
   `messaging.clearLogs`; no message bodies or credentials are logged.
4. **Concurrency & resource management.** Claim-before-send makes retries send-once; stale in-flight
   claims are reclaimed after 5 minutes instead of blocking a key for a day; the replay path performs no
   writes beyond the artifact update.
5. **Evidence on production's path.** Each fix is pinned by a test that exercises the route/hook the app
   uses (`inject` for HTTP, hook rendering for the directory), not a neighbouring shape; the deferred
   items are reported as untested hypotheses, not as broken.

## 9. Verification evidence (post-fix)

| Check | Result |
| --- | --- |
| `pnpm --filter @mms/shared typecheck` / `build` | pass |
| `pnpm --filter mms-backend typecheck` | pass |
| `pnpm --filter mms-frontend typecheck` | pass |
| `pnpm --filter mms-backend lint` | pass |
| `pnpm --filter mms-frontend lint` | pass |
| `pnpm --filter mms-backend test` | **369 files / 2,566 tests passed** |
| `pnpm --filter mms-frontend test` (full suite) | **1,088 files / 3,970 passed, 2 skipped** (second pass) |
| `pnpm --filter mms-frontend test messaging messageComposer` | **31 files / 97 tests passed** (messaging subset incl. composer) |
| `pnpm format:check` | pass |
| `pnpm --filter @mms/shared test` | **239 files / 1,795 tests passed** |
| `pnpm --filter mms-backend test messaging` | **12 files / 120 tests passed** |
| `pnpm --filter mms-backend test:db` (real PostgreSQL) | **56 files / 223 tests passed, 1 skipped** — incl. the new messaging DB spec |
| `pnpm run check:tdd-pairing` | advisory: 4 repository/mapper files are pinned by integration specs instead of same-named unit specs |
| `moduleAccessCoverage.test.ts` | pass (3 messaging actions pinned) |
| `pre-pr-review.sh` (21 gates: i18n, code norms ≤300 LOC, work-directory, docs, ratchets, typecheck, ESLint) | **21/21 pass** |


## 10. Gate output

```
✓ Staged secrets            ✓ Rules & skills integrity   ✓ i18n completeness (en/ar/ur/fa)
✓ i18n unused keys          ✓ @mms/shared purity          ✓ @mms/shared structure
✓ Faculty domain surface    ✓ Migration index quality     ✓ Migration hygiene
✓ Migrations forward-only   ✓ Work directory convergence  ✓ Frontend structure ratchets
✓ Shared UI governance      ✓ Documentation ratchets      ✓ Script unit tests
✓ Ratchet baselines         ✓ DB projection hygiene       ✓ Backend route boundary
✓ Code norms ratchet        ✓ TypeScript typecheck        ✓ ESLint
✨ All automated completion review checks passed
```

Three ratchets forced adjustments across the two rounds: `useMessageComposerDispatch.ts` crossed the
300-line ceiling and was split (`buildSentDispatchRecord`, `notifyUnknownTokenErrors`); the round-1
idempotency test needed an explicit payload type instead of a literal null; and the round-2 comment on
`messageStatusSchema` pushed `messaging.dto.ts` over 300 lines, so the doc comment was tightened.
`check:tdd-pairing` stays advisory for four messaging repository/adapter files — their behaviour is
pinned by the repository unit specs, the HTTP integration specs and the real-Postgres spec rather than
same-named unit files. No rule/skill/workflow files changed, so the
standards mirrors did not need regenerating.

## 11. Second pass — deferred-debt round (2026-11-04, later)

The §7 backlog was triaged again: messaging-owned items with no product decision were closed, the
rest stay deferred with the same named reasons (kept below). §3–§8 remain the round-1 record.

| §7 item | Status | Change | Evidence |
| --- | --- | --- | --- |
| Campaign runner: two transactions per recipient | **Partial** | Delivery outcomes are now written as one batched upsert per 50 recipients and progress ticks every 20 instead of every 5 (~1,000 → ~510 transactions for 500 recipients). **Claim batching is not done:** claiming ahead of the sends widens the deferred P-06 crash window from 1 to N silently-undelivered recipients, so it waits for the reclaim policy | `messagingCampaignRunnerRetry.test.ts` (batch/cadence/abort flush), `messagingLogsMutationRepository.test.ts`, `messagingLogsDb.integration.test.ts` |
| `'sending'` outside the shared enum and metrics | **Fixed** | `messageStatusSchema` (read DTO) gains `sending`; the client create schema still rejects it; metrics count `sending` in `queuedCount`; the FE badge renders it from `messaging.status.sending` | `messaging.dto.test.ts`, `useMessagingPageOptions.test.tsx`, DB spec |
| Upsert could resurrect logs unattributed (P-14) | **Fixed** | `saveMessageLog` no longer copies `deleted_at`/`deleted_by`/`deletion_reason` on conflict — archive/restore own that lifecycle | `messagingLogsRepositoryUpsert.test.ts` |
| Unaudited hard-delete trapdoor (P-21) | **Fixed** | `deleteMessageLogsByWorkspace` deleted (no caller, bypassed the soft-delete trigger) | typecheck + barrel diff |
| `loadMessageLogById` trash-only inversion (H-04) | **Fixed** | Uncalled loader removed from use-case, interface, adapter and service barrel | typecheck |
| Keyboard: page-level stub shortcuts + `w/s/e` over dialogs | **Fixed** | New `lib/ui/keyboardGuards.ts` (`isTypingTarget`, `isOverlayOpen`); the channel shortcuts and j/k nav use it; `/`, Escape (selection → filters) and Cmd/Ctrl+N now run in the Work-tier controller with real state, and the page stub was removed | `keyboardGuards.test.ts`, `useMessagingKeyboardShortcuts.test.tsx` |
| Composer launcher dropped prefilled text | **Fixed** | `TenantMessageComposerLauncher` forwards `initialMessage`/`initialSubject` | `TenantMessageComposerLauncher.test.tsx` |
| Composer gate bypassed the module manifest | **Fixed** | `useMessageComposerState` gates through `useModulePermissions(MESSAGING_MODULE_MANIFEST)` | `useMessageComposerState.test.tsx` |
| Option arrays / column registry re-created per render; dead prop | **Fixed** | `useMessagingPageOptions` and `useMessagingColumnLayouts` memoized; remaining IIFEs in `useMessagingContactsByIds`/`useMessagingWorkRecipients` removed; dead `selectedCount` prop dropped | `useMessagingPageOptions.test.tsx` (identity check), lint |
| 24 px in-cell icon targets | **Fixed** | Filter-contact and copy-body row actions are 44×44 hit areas | render suites |
| Composer subtitle built by concatenating translated fragments | **Fixed** | Three parametrized keys (`messaging.composerSummaryEmail/Sms/Whatsapp`) so ar/ur/fa control word order | `messageComposerText.test.ts` |
| "Clear Log History" inside a *selection* bar but archives all | **Fixed (copy)** | Label is now "Archive all logs" in en/ar/ur/fa; behaviour unchanged | i18n gate |
| No real-Postgres proof for claim/sort/attribution | **Fixed** | `db-integration/messagingLogsDb.integration.test.ts` (opt-in `test:db`): claim → `sending` → metrics bucket, batched outcomes, sort allowlist + injection string fallback, clear stamps `deleted_by`/reason, archived rows excluded from the active view | `pnpm --filter mms-backend test:db` green (56 files / 223 tests) |
| Round-1 note: manifest column-preference keys and the cross-module query-factory module were listed as dead surface | **Corrected — not dead** | The three `*ColumnPreferencesObjectKey` fields are the object-key allowlist used by RBAC coverage tests, and `useMessagingQueries` is re-exported through the cross-module barrel; both stay | `rbacService.test.ts`, `tenant/hooks/collections/messaging.ts` |

**Still deferred (unchanged reasons):** retention anchored to `deleted_at`; `sent_at`/naive timestamp
typing; migration `0107`'s `BEGIN/COMMIT`; claim batching and the aborted-claim reclaim policy;
trigram search index and per-page `count(*)`; shared queue routing, CSV-import digest check, worker
permission re-check and `getUserBackgroundJob` user scoping; template soft-delete classification;
`retentionDays` wiring; export progress and artifact cleanup in the shared runner.
