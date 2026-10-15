---
name: mms-messaging
description: SMS/WhatsApp campaigns, MessageComposer, templates, message logs, and /api/messaging REST. Use when modifying MessagingPage, MessageComposer, messaging templates/campaigns/logs, MessagingVariableTokensBar, or backend messaging routes/repositories. Do NOT use for transactional audit events (use mms-audit-trail) or email background queuing (use mms-background-jobs).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Messaging Workflow

**Rule (norms SSOT):** `mms-messaging.md`. Also `mms-module-architecture.md` §7, `mms-auth-security.md`, `mms-data-layer.md`, `mms-performance.md` §2 (Lean Payloads, Streaming / Background CSV Jobs).

## When to use

- Changing MessagingPage, MessageComposer, templates, campaigns, or logs
- Touching messaging backend routes/repositories or variable tokens

## Layout (entry points)

| Area | Path |
|------|------|
| Page | `apps/frontend/src/tenant/features/messaging/MessagingPage.tsx` |
| Composer | `components/app/MessageComposer.tsx` + tokens bar |
| Hooks | `useMessageTemplates`, `useMessageLogs`, `useMessagingMetrics`, `useMessagingMutations` |
| Shared | `MESSAGING_MODULE_MANIFEST`, `messagingSchemas`, `MessagingRecipient` |
| Backend | `routes/tenant/messaging.ts` (+ `messaging/**`), `messagingRepository.ts`, `services/messaging*.ts` |
| CSV job | `startServerMessagingCsvExport.ts` → `POST /api/messaging/export/csv` |

## Workflow

1. Recipients via `MessagingRecipient` / `toMessagingRecipient` — never contacts schemas in composer.
2. Query + `/api/messaging` only (`/recipients`, `/recipients/match`, `/contacts/resolve`, logs, metrics, templates, `/export/csv`).
3. Bulk template/log writes upsert; clear-logs soft-archive (intentional §7 variant). Note: `message_logs` follows the 4-Bucket taxonomy as **Bucket 3 (Sweeper-Driven TTL Purge)** with a 365-day retention window (`retentionDays: 365` in manifest) and tuned autovacuum (`autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_cost_limit = 1000`) purged via background worker (`docs/soft-delete.md` §10 & §13.4 · `mms-soft-delete`).
4. Allowlisted tokens; plain text; BE forces session `userId`, strips client `deletedAt`.
5. §7 UX: permissions, `ErrorState`, Cmd/Ctrl+N, `mutateAsync`, `t()`.
6. Campaign/send POSTs: idempotency key **bound to body digest** when the client may retry; reject mismatched replay with `409` — `mms-api-interface.md` §6. Surface `429` / `Retry-After` via `notify` — `mms-auth-security.md`.
7. Select-all via `/recipients/match`; CSV via background `messaging:export` — no FE page-walk. Never re-allowlist `messages_u:`.

## Checklist

```
- [ ] useModulePermissions(MESSAGING_MODULE_MANIFEST)
- [ ] No raw fetch('/api/...')
- [ ] Upsert saves; clear-logs soft-archive + audit `messaging.logs.clear`
- [ ] message_logs follows Bucket 3 TTL purge with 365-day retention window and tuned autovacuum (mms-soft-delete)
- [ ] Select-all uses /recipients/match (lean); CSV uses /export/csv job
- [ ] CSV export respects MESSAGING_CSV_EXPORT_MAX_ROWS / MAX_BYTES
- [ ] No messages_u: / message_* in ALLOWED_COLLECTIONS dual-write
- [ ] Send/export: idempotency key bound to body digest (409 on mismatch) + 429 backoff
- [ ] GET /logs?includeDeleted requires canClearMessagingLogs
- [ ] Token allowlist; no HTML injection
- [ ] ErrorState + Cmd/Ctrl+N when canWrite
- [ ] BE: authenticateTenant + RLS; no client authz userId
```

## Script

`.agent/skills/mms-messaging/scripts/verify-template-tokens.mjs` validates every `{token}` in a template against the canonical token set in `packages/shared/src/messaging/messagingSchemas.ts`:

```bash
node .agent/skills/mms-messaging/scripts/verify-template-tokens.mjs --text 'Salaam {student_name}, {bogus_token} due'
node .agent/skills/mms-messaging/scripts/verify-template-tokens.mjs --file path/to/template.txt
```

Unknown tokens exit non-zero — the backend rejects them at send time, so catch them at authoring time.

## Done

`pnpm typecheck` · FE lint · `apps/backend/src/__tests__/messaging.integration.test.ts` when the REST surface changed — `mms-completion-review.md`.

## Related skills

`mms-backend-api`, `mms-background-jobs`, `mms-form-architecture`, `mms-frontend`.
