# Messaging backend review — 2026-11-04 (round 3, backend-only)

Independent backend review of the messaging module (`apps/backend/src/routes/tenant/messaging/**`,
`apps/backend/src/messaging/**`, `apps/backend/src/db/repositories/messaging*`,
`apps/backend/src/db/schema/messaging.ts`, `apps/backend/src/services/messaging*.ts`, the messaging
backup mapping, and the messaging branch of `backgroundJobRunnerService.ts`). Frontend, shared
contracts and the worker were read only where the backend calls them.

This is the third pass over the module. Round 1/2 (`docs/messaging-module-review-2026-11-04.md`)
fixed the payload-derived idempotency key, direct-dispatch send-once, the archived-log view, gate
alignment, audit atomicity for clear/restore, and the streaming export cap; those fixes were
re-verified here and are **not** re-reported. Findings describe the code paths as reviewed; the
fixes in §5 changed them.

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend test messaging` (pre-change) | **12 files / 120 tests pass** |
| `pnpm --filter mms-backend test messaging relationalReplaceMapping` (post-change) | **15 files / 135 tests pass** |
| `pnpm --filter mms-backend typecheck` | pass |
| ESLint on every touched file | pass |
| Working tree | arrived with unrelated in-progress dashboard/faculty/contacts edits; none were touched here |

## 2. Verdict

The module's bones hold up: tenant RLS is enforced at the repository seam with every query wrapped
in `withTenant`, module-gate + per-handler RBAC agree on every route, mutating routes carry the
strict rate limit, tokens are allowlisted three times, email HTML is screened, the CSV export is a
real background job with row/byte caps, and the archived-log lifecycle is now atomic with its audit
row. Two real defects remained — one send-safety hole in the replay path and one data-loss hole in
backup/restore — plus audit/contract accuracy gaps. Six of them are fixed here; three need a product
or compliance decision and are named below with a recommended fix.

## 3. Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| H1 | High | Dispatch trusts client-supplied destinations: the server texts/emails whatever `phone`/`email` the body carries and records `contactId: recipient.id` without checking the contact exists, belongs to the tenant, or matches the number. A `messaging.write` holder can spend the tenant's gateway on arbitrary numbers (30 req/min × 50 direct = 1,500 sends/min) and produce history rows attributed to contacts that were never messaged. | **Open — needs decision** |
| H2 | High | Backup/restore destroyed the archived-log window: `message_logs.snapshotFnName` was `listMessageLogsByWorkspace` (active rows only) while restore hard-replaces the table under `app.allow_hard_purge`, so every full restore silently dropped logs the Reports tier offers to restore for 365 days. | Fixed |
| M1 | Medium | The idempotency key was not bound to the execution mode: `queued` was outside `bodyDigest`, and the direct path keyed recipient claims on the raw client key while the queued runner keys them on `tenant:user:key`; neither path consults the other's completion record. Same key + same body + a flipped `queued` flag re-messaged every recipient. | Fixed |
| M2 | Medium | Direct dispatch runs up to 50 sequential provider calls inside the request (email builds a fresh SMTP transport per recipient) against a 120 s Fastify `requestTimeout` and a typical 60 s proxy budget; a large synchronous email batch times out and strands an in-flight claim for the stale window. | **Open — needs decision** |
| M3 | Medium | GDPR erasure shreds contacts and child tables but never touches `message_logs`; message bodies that name the student/parent are retained indefinitely with no purge cascade. | **Open — needs decision** |
| M4 | Medium | Template save wrote no audit row (while delete and preferences did), and both template writes audited outside the write transaction — a committed template could lose its event. | Fixed |
| L1 | Low | `deleteMessageTemplateById` returned `true` even when no row matched. | Fixed |
| L2 | Low | Dead hard-delete surface: `messagingUseCases.replaceMessageLogs` (bulk `DELETE FROM message_logs`) was exported through the service barrel with no caller and was only stopped by the DB trigger; `handleRecordMessageLogs` was unused. | Fixed |
| L3 | Low | `POST /logs` reported the submitted length as `recorded` even when `ON CONFLICT DO NOTHING` skipped rows. | Fixed |
| L4 | Low | `/recipients/match` re-reads the contact field-config snapshot and re-runs `count(*)` once per 500-row page (≤20 rounds for a 10k select-all). | Open — reported |
| L5 | Low | Legacy `GET /api/messaging/logs` duplicates the contract route with a second schema path. | Open — reported |
| L6 | Low | Clear-logs archives in-flight `sending` claims; a stale reclaim (10 min) can then re-send a recipient whose row is archived. | Open — reported |
| L7 | Low | `collectUnknownPersonalizationTokens`'s `subject` parameter is unused at the dispatch call sites (the email route calls the helper twice and merges). | Open — reported |
| L8 | Low | `listTemplates` binds `withTenant(String(request.tenant?.id))` while the repository re-enters `withTenant(subdomain)` — redundant nesting, and a missing tenant yields 500 instead of the shared 400 path. | Open — reported |

## 4. Open items — recommended fixes

**H1 — resolve recipients server-side before sending.** Add a dispatch-only loader that reads the
named contacts for the tenant *without* the viewer sanitizer (the sender does not "view" the phone,
it transmits to it), and use its primary phone/email as the destination; reject ids that do not
resolve with `400`. Log rows then record the destination the server actually used. This removes the
arbitrary-number vector and the falsifiable `contactId` attribution. It changes send semantics (the
client's destination fields become advisory), so it needs an explicit decision. The composer only
ever sends picker-selected contacts, so no legitimate flow depends on client-supplied numbers.

**M2 — keep the synchronous path short.** Lower the synchronous threshold from 50 recipients to
~10, or always queue email (a per-recipient SMTP handshake is the slowest channel). The response
shape is already `202 queued` capable and the frontend handles it, so this is a threshold/test
change plus docs.

**M3 — decide the erasure contract for message bodies.** Either scrub `message_logs.body` and
`error_message` for the erased contact (keep the row for delivery accounting, write an audit event),
or record the retention decision in `docs/soft-delete.md` §13.4 and accept it. Erasure currently
leaves the body untouched, which contradicts a right-to-erasure reading.

**L4–L8** are performance/hygiene items: load the viewer snapshot once per `matchMessagingRecipients`
call; retire the legacy `/logs` alias once no raw API consumer remains; exclude `status='sending'`
from `softDeleteActiveMessageLogs` (or document the race); drop the unused `subject` parameter at
the dispatch call sites; and give `listTemplates` the same tenant guard as its siblings.

## 5. Fixes in this change

### M1 — the execution mode is part of the dispatch identity

`messagingSmsDispatchRoute.ts`, `messagingWhatsAppDispatchRoute.ts`,
`messagingEmailDispatchRoute.ts`:

- `isQueued` now reads the validated `parsed.data.queued` instead of casting the raw body.
- `bodyDigest` includes the derived `queued` flag, so a mode-flipped replay of a *queued* job
  mismatches instead of replaying.
- `dispatchId = buildBackgroundJobId(tenant, user, idempotencyKey)` is computed once and used for
  both the enqueued job id and `dispatchMessagingCampaignDirect`, so the direct path derives the same
  `buildMessageLogClaimId(dispatchId, contactId, channel)` the runner uses. A retry that switches
  paths now collides with the other path's per-recipient claim (counted as `skippedCount`) instead
  of re-messaging.

Red evidence (`git stash` of the SMS route, before/after):

```
× keys direct-dispatch claims in the queued job namespace
AssertionError: expected 'msg-35e60b8c…' to be 'msg-46b40176…'
  expected = buildMessageLogClaimId(buildBackgroundJobId("demo","u-admin","sms-claim-namespace-01"), …)
  received = buildMessageLogClaimId("sms-claim-namespace-01", …)
```

Pinned by `messagingSmsDispatch.integration.test.ts`, `messagingCampaignDispatch.integration.test.ts`
(direct-path claim id equals the queued namespace on all three channels).

**Rollout note.** For up to 24 h after deploy, idempotency artifacts written before the change fail
the new digest check and answer `409` (fails closed, no double send). An in-flight *direct* dispatch
retried across the deploy can re-send, because its claims live under the old id. Deploy with no
campaign in flight.

### H2 — archived logs are part of a backup

- New `listAllMessageLogsByWorkspace(tenant, { limit, offset })` in
  `db/repositories/messagingLogsRepository.ts`: same projection as the active loader, no
  `deleted_at IS NULL` filter, `ORDER BY id` for stable snapshot paging.
- `message_logs.snapshotFnName` → `listAllMessageLogsByWorkspace`. Restore already round-trips
  `deleted_at/deleted_by/deletion_reason/restored_at/restored_by` through `mapAuditToInsert`, so no
  writer change was needed.
- Tradeoff: a workspace backup now includes up to 365 days of archived logs (the same retention
  bound the purge worker enforces).

Pinned by `relationalReplaceMapping.test.ts` (red before: the mapping still named
`listMessageLogsByWorkspace`) and by the opt-in real-Postgres spec
`db-integration/messagingLogsDb.integration.test.ts` (archived rows appear in the snapshot with
attribution and id ordering).

### M4 — template writes and their audit commit together

`messagingTemplateContractHandlers.ts`: save and delete each run the write **and**
`recordModernAuditEvent` inside one `withTenant` transaction (the repository and audit helpers join
the active tx), matching the clear/restore pattern. Save now emits `messaging.templates.save`
(`CREATE`/`UPDATE` by whether the id existed); delete keeps `messaging.templates.delete`.

Pinned by `messaging.integration.test.ts` ("audits the saved template").

### L1 — truthful delete result

`deleteMessageTemplateById` uses `DELETE … RETURNING id` and returns whether a row was actually
removed, so a concurrent delete between the handler's existence check and the statement no longer
answers `200`. Pinned by the new `messagingTemplatesRepository.test.ts` (red before: it returned
`true` unconditionally).

### L3 — truthful recorded count

`insertMessageLogs` returns the persisted row count (`RETURNING id`); `recordMessageLogs` and
`processRecordMessageLogs` pass it through, so `POST /logs` and the idempotency replay body report
what was written. Pinned by the new `messagingLogsRepository.test.ts` (count, batch dedupe, empty
input), `messagingUseCases.test.ts` (red before: the array length was returned) and the existing
HTTP record/replay tests.

### L2 — remove the dead hard-delete surface

`messagingUseCases.replaceMessageLogs` (bulk replace over `message_logs`) and the unused
`handleRecordMessageLogs` are gone; `loadMessageLogs` reads directly from the repository. The
repository's `replaceMessageLogsForWorkspace` stays — backup restore needs it.

## 6. Re-verified as correct (checklist walk)

- `authenticateTenant` + `registerModuleAccess("messaging")` on the plugin root; handler-level
  `canRead/canWrite/canClear/canRestore` match the action each route performs; `MODULE_ROUTE_ACTION_RULES`
  maps `DELETE /logs` and `POST /logs/restore` to `availability` and excludes messaging from the
  `export` rule.
- FORCE RLS on `message_templates`/`message_logs`; every repository call wraps `withTenant`; the
  handler-level `withTenant` is redundant but never the sole boundary.
- Strict rate limit on all mutating contract routes and dispatch/export/import routes; the contract
  router exempts reads; 429 carries `retry-after`.
- Idempotency: RFC 8785 canonical digest, constant-time compare, `409` on mismatch/in-flight, replay
  header, 5-minute stale-claim reclaim, claim released on failure; export and record-logs use the
  same helper.
- Token allowlist enforced at schema, template save, dispatch and record-logs; email `html` rejects
  script/iframe/object/embed/`javascript:`/inline handlers; personalization is plain text.
- Soft-archive stamps `deleted_by`/`deletion_reason` and shares a transaction with its audit row;
  restore writes `restored_at/by`, emits `entity.restored` and audits in the same transaction;
  `saveMessageLog` cannot resurrect an archived row unattributed.
- CSV export streams with row and byte caps and resolves names through `sanitizeContactsForViewer`
  with the session role; recipient endpoints return lean `{id,name,phone,email}` DTOs only.
- No `messages_u:`/`message_*` document-store write path; the identity mask test still passes.

## 7. Still open from the module review (§7 residuals re-checked)

Retention anchored to `deleted_at` (active logs are never purged); `sent_at` as `varchar(35)` and
naive `timestamp` DDL; migration `0107`'s nested `BEGIN/COMMIT`; claim batching in the campaign
runner; trigram search index and per-page `count(*)`; CSV import replay without a digest comparison;
worker-side module/permission re-check for queued jobs; `getUserBackgroundJob` ignoring its `userId`;
template hard delete (no soft delete); `retentionDays: 365` unwired from the manifest.

## 8. Adversarial audit (`mms-completion-review.md` §4)

1. **Edge cases / payload integrity.** Mode flip across paths now collides on the claim (M1); digest
   covers recipients, message, category, subject/html and mode; restore preserves archive state (H2);
   `recorded` reflects the write (L3); blank ids resolve `not_found`/`false` (L1).
2. **Failure modes.** Save/delete audit failures roll the template write back with the event (M4);
   idempotency failures release the claim; a failed outcome write is logged and the stale reclaim
   keeps the retry send-once; the export fails closed past its caps.
3. **Security / multi-tenancy.** RLS remains repository-owned; no cross-tenant path was found in the
   changed code; destinations remain client-trusted until H1 is decided (documented, not silently
   changed).
4. **Concurrency.** The namespace change removes the last replay path that could double-message;
   template deletes no longer report success for a row another request already removed; the claim
   reclaim window is unchanged.

## 9. Verification evidence (post-fix)

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend test messaging relationalReplaceMapping` | **15 files / 135 tests pass** |
| `pnpm --filter mms-backend test:db messagingLogs` (real PostgreSQL) | **4 tests pass** — includes the archived-log snapshot case |
| `pnpm --filter mms-backend typecheck` | pass for every file touched here; the final repo-wide run fails only on an unrelated untracked `facultyCatalogErrorMapping.test.ts` that landed in the shared working tree mid-session |
| ESLint (touched files, `--no-cache`) | clean |
| ESLint / backend route→storage boundary inside `pnpm ci:local` | pass |
| `node scripts/check-docs.mjs` | pass (new doc indexed) |
| Red runs captured before the fixes | M1 claim id, H2 mapping name, L1 delete result, L3 recorded count (one `git stash` round-trip each) |
| New specs | `messagingTemplatesRepository.test.ts`, `messagingLogsRepository.test.ts`, plus the added cases in the dispatch/integration/mapping specs |
| Rules/skills corpus | untouched — no mirror regeneration needed |

**Working-tree caveat.** This review ran in a tree that other work was editing concurrently
(dashboard/faculty/contacts files, an untracked faculty test). `pnpm ci:local` reported three
failures, all attributable to those unrelated edits: the backend-structure ratchet moved 47 → 48
use-case files (unchanged with this change stashed), `check:code-norms` flagged
`contacts/use-cases/contactWriteUseCases.ts` at 310 lines, and typecheck failed in the new
`facultyCatalogErrorMapping.test.ts`. No messaging file is implicated in any of them.

Gate commands used: `pnpm --filter mms-backend test messaging relationalReplaceMapping`,
`pnpm --filter mms-backend test:db messagingLogs`, `pnpm --filter mms-backend typecheck`, and the
workspace ESLint invocation from `apps/backend/package.json` restricted to the touched paths.
