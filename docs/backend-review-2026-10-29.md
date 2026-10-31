# MMS Backend Review — 2026-10-29

Focused, read-only review of `apps/backend` at `main` (`fa87ad713`). This is the backend deep-dive
companion to the whole-repo [project review](./project-review-2026-10-29.md): that document covers
gates, the frontend, dependencies and process; this one reads the server code paths end to end and
reports what the gates do **not** catch.

**Verdict: structurally strong, but the audit trail, parts of the finance/ledger path, and the
audit-governance permission model are not sound as written.** Tenant isolation primitives, session
auth, CSRF, RLS boot checks, money/FX arithmetic and the posting-idempotency layer are deliberate
and well tested. Against that: several defects can silently corrupt the books; the audit trail can
report a false "verified" and, under the RLS role the boot guard demands, does not persist at all;
and irreversible audit/privacy operations are gated on a permission every teacher holds. None of
this is visible to the current test suite, because it mocks the database boundary.

**If only five things are fixed:** F1/F2 (make the audit trail transactional and anchor its
verification), F3/F4/F5/F7 (ledger correctness on invoices/payments), F35/F36 (a real audit
permission, server-derived activity logs), F6 (tenant-scope erasure), F10 (make the documented
deploy boot). Finding IDs are stable labels from the audit; the summary table is ordered by
severity.

All findings below were verified by reading the cited code. Where a claim depends on concurrency or
live PostgreSQL behaviour it is labelled **Needs-runtime-check**. The review itself was read-only;
the fixes are recorded in [§10 Resolution](#10-resolution--implementation-status-same-day). No
database was available at review time, so the original claims are code-derived.

---

## 1. Scope and method

| Item | Value |
| --- | --- |
| Target | `apps/backend` — 1,598 `.ts` files · 196,817 LOC · ~500 HTTP routes |
| Stack | Fastify 5 · ts-rest + Zod · Drizzle ORM · PostgreSQL 16 · Redis 7 + BullMQ · Node 24 |
| Branch / HEAD | `main` · `fa87ad713` (clean tree at review start) |
| Method | Automated gates, then domain-by-domain read of route → use-case → repository → SQL, cross-checked against schema/migrations and tests |
| Domains read | auth/session/RBAC/module gates · HTTP surface/CSRF/uploads/WS · DB/transactions/soft-delete/migrations · worker & queues · finance/accounting · audit trail · config/observability/deploy |

### Evidence — commands run

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend typecheck` | **pass** (exit 0) |
| `pnpm --filter mms-backend lint` | **pass** (0 errors, `--quiet`) |
| `pnpm --filter mms-backend test` | **288/288 files · 2,098/2,098 tests pass** (38.6 s) |
| `check:backend-boundaries` | 0 offenders / baseline 0 |
| `check:backend-structure` | all ratchets held (66 services→db imports, 17 legacy aggregators) |
| `check:code-norms` | all held; backend has 0 files >300 LOC, 0 explicit `any`, 0 `@ts-ignore`, 0 TODO/FIXME |
| `check:migration-indexes` | no new write-blocking index builds |
| `check:db-projections` | 0 wildcard projections |
| `check:migration-hygiene` | lock_timeout ratchet held; 311 naive `timestamp` columns (baseline) |
| `check:migrations-forward-only` | 0 modified applied migrations |
| Migration journal | 197 entries ↔ 197 SQL files, no gaps |
| `moduleAccessCoverage.test.ts` | passes — enumerates >500 routes, every module route carries `moduleAccess`, every non-module path is explicitly listed |

These results match the project review's claims, so the findings below are not regressions of the
gates — they are behaviours the gates cannot see.

---

## 2. Findings — summary

| # | Severity | Finding | Primary evidence |
| --- | --- | --- | --- |
| F1 | **Critical** | Audit trail appends/reads run outside any tenant transaction. Under the RLS-subject role the boot guard requires, appends are rejected and reads return zero rows; the erasure endpoint 500s *after* shredding keys. | `services/auditTrailService.ts:145`; `audit/repository/auditQueryAdapter.ts:28` |
| F2 | **Critical** | Audit-chain verification is anchored at GENESIS, ignores Merkle checkpoints, and hard-codes `verification_status = VERIFIED`. Partition archival ⇒ permanent false `BROKEN_CHAIN`; tail truncation ⇒ undetectable. | `services/auditVerificationService.ts:89,189`; `scripts/detach-audit-partition.ts` |
| F3 | **Critical** | Batch invoice generation writes invoices directly to the repository and never posts the ledger entry. | `finance/use-cases/financeInvoiceGenerationUseCases.ts:52-69` |
| F4 | **High** | `POST /api/finance/invoices` is an upsert on a caller-supplied id and can reset `paidAmt`/`status`/`creditedAmt` on a posted, paid invoice — bypassing the PUT guard and the cancel/reversal rules. | `financeMutationOperations.ts:118-131`; `financeInvoicesPersist.ts:17-47` |
| F5 | **High** | Payments commit before allocations and journal posting; a failed posting returns 500 while the payment and reduced balance stay durable, and the retry creates a second payment. | `financeMutationOperations.ts:190-253` |
| F6 | **High** | Crypto-shredding destroys keys **globally by `subjectId`** (table has no workspace column), is authorised by `analytics.view` — which every default **teacher** holds — and protects nothing: no subject data is ever encrypted. | `services/cryptoShreddingService.ts:156-186`; `db/schema/auditTrail.ts:145-198` |
| F7 | **High** | Credit-note and cancel-invoice paths do unlocked read-modify-write on the invoice; concurrent credits both pass the balance check. | `finance/use-cases/financeCollectUseCases.ts:186-206` |
| F8 | **High** | `/api/db/backup` streams table rows with `LIMIT/OFFSET` and **no `ORDER BY`**, inside a READ COMMITTED transaction — rows can be skipped or duplicated and tables are not read at one point in time. | `db/streamingSnapshotProducer.ts:238`; `db/dbTransactions.ts` (`BEGIN`) |
| F9 | **High** | Messaging campaigns retry the whole recipient list after any failure; there is no per-recipient idempotency and logs are only written after the loop. | `services/messagingCampaignJobRunner.ts:45-140`; `worker/queues/queueConfig.ts:63-70` |
| F10 | **High** | The documented Docker Compose stack cannot boot: production mode + superuser DSN triggers the strict RLS boot guard. | `docker-compose.yml:94-96`; `db/rlsRoleGuard.ts:112-118` |
| F11 | **High** | Finance and accounting writes emit no audit events at all (invoices, payments, credit notes, journal entries, period close). Only setup config and five accounting FX/reversal use-cases audit. | `grep recordModernAuditEvent` over `finance/ accounting/ routes/tenant/{finance,accounting}` |
| F12 | **High** | Audit hash-chain order is decided by lock acquisition but *verified* by a timestamp captured before the lock — concurrent appends can permanently report `BROKEN_CHAIN`. | `services/auditTrailService.ts:150,158` |
| F35 | **High** | Audit governance is gated by `analytics.view` (a **dashboard read**): any teacher can run erasure/retention purge, read the full audit trail with actor IPs, and export it. | `routes/tenant/audit/auditPrivacyRoutes.ts:23`; `packages/shared/src/auth/permissionRules.ts:95`; `userRbacDefaultRoles.ts:97` |
| F36 | **High** | Any `analytics.view` holder can forge or overwrite staff activity logs: `PUT /api/users/activity/bulk` writes `userId`/`ts`/`ip`/`detail` from the body and upserts existing rows. | `lib/rbacPermissionMaps.ts:147`; `routes/tenant/users.ts:47-55`; `db/repositories/logsRepository.ts:163-172` |
| F13 | **Medium** | Fiscal-year close has no lock or posting barrier: an entry can land in the year being closed after the trial-balance read and be omitted from the closing entry. | `accounting/use-cases/accountingPeriodClose.ts:41-107` |
| F14 | **Medium** | Client-supplied idempotency keys become a **global** primary key and BullMQ `jobId` (no tenant namespace) → cross-tenant 500s or silently suppressed jobs. | `lib/csvExportEnqueue.ts:40`; `db/schema/system.ts:59`; `worker/queues/index.ts:160-163` |
| F15 | **Medium** | Background jobs never enter `running`: "clear finished" deletes queued work, startup cleanup fails jobs that are merely backlogged, and the running-heartbeat recovery can never match. | `services/backgroundJobWorkerService.ts:237-243`; `worker/workerOrphanCleanup.ts:23-58` |
| F16 | **Medium** | The 60 s sandbox timeout aborts only the `Promise.race`, not the runner (no export/PDF runner reads `ctx.signal`) — a zombie attempt keeps writing while the retry starts. | `worker/processors/sandboxedExportProcessor.ts:47-66` |
| F17 | **Medium** | Worker shutdown force-exits after 10 s while jobs may run 60 s+; in-flight work is killed and re-run (duplicate sends for campaigns). | `worker/index.ts:169-173`; `queueConfig.ts:33` |
| F18 | **Medium** | BullMQ connection options drop the Redis DB index and TLS from `REDIS_URL`; queues have no environment prefix. | `lib/redisBullMQ.ts:18-45`; `worker/queues/index.ts:36-42` |
| F19 | **Medium** | `dismissUserBackgroundJob` ignores the caller's user id — any tenant user can delete another user's job row (and orphan their artifact). | `services/backgroundJobService.ts:170-181` |
| F20 | **Medium** | The export-artifact registry is one global document rewritten read-modify-write; concurrent completions lose entries and blobs are never reclaimed. | `services/exportArtifactService.ts:72-92` |
| F21 | **Medium** | Leader-lease acquisition sits outside the scheduler's `try`; a DB error at that point rejects a floating promise and the worker's `unhandledRejection` handler kills the daemon. | `worker/retentionPurgeScheduler.ts:82-96`; `worker/index.ts:203-206` |
| F22 | **Medium** | `queue.add` timeout marks the DB row failed and returns 503, but the uncancelled `add` can still land and execute. | `worker/queues/index.ts:154-183` |
| F23 | **Medium** | Long-lived backup transactions inherit the 15 s `idle_in_transaction_session_timeout`; disk I/O or a slow client aborts the download with `57P05`. | `db/tenantTransactionGuards.ts:35-36`; `routes/common/db/dbSyncRoutes.ts:87,112` |
| F24 | **Medium** | Workspace reset (`POST /api/db/reset`) is non-atomic, has no step-up confirmation, and its audit event is fire-and-forget **after** the wipe (so it is lost under F1). | `db/dbPurge.ts:84-100`; `routes/common/db/dbSyncRoutes.ts:187` |
| F25 | **Medium** | The cursor-pagination contract is broken by construction: page 1 never returns `nextCursor`, so cursor-based infinite lists cannot fetch page 2. | `db/repositories/listPageHelper.ts:96`; `frontend/.../useContactsQueries.ts:90` |
| F26 | **Medium** | `GET /api/audit/merkle-roots` has no permission check and returns every workspace's checkpoints; `POST` lets a tenant user publish a **global** checkpoint. | `routes/tenant/audit/auditIntegrityRoutes.ts:34-48` |
| F27 | **Medium** | Contact search is an unindexable `LIKE '%…%'` over `concat_ws` of four correlated subqueries, with the same predicate counted again per page; no `pg_trgm` index exists. | `db/repositories/contactRepositoryListSql.ts:83-116` |
| F28 | **Medium** | Tenant fair-share inflight counter is decremented on every failed attempt but incremented once per job, inverting priority for retrying tenants. | `worker/index.ts:100-110`; `worker/queues/index.ts:105-108` |
| F29 | **Medium** | Unbounded memory/scan paths: XLSX/JSON export buffers the whole result set; messaging "restore all" updates a 365-day table in one statement. | `lib/createModuleExportService.ts:78-87`; `db/repositories/messagingLogsMutationRepository.ts:36-56` |
| F30 | **Medium** | PM2 cluster mode multiplies the DB pool by core count, but the documented budget assumes one backend process; `.env.example` and compose both say "2 × PG_POOL_MAX". | `ecosystem.config.cjs:40-45`; `apps/backend/.env.example:32-36` |
| F37 | **Medium** | Sign-out revocation is shorter than the token it revokes: the `jti` marker TTL is 15 min while access tokens are signed for `sessionTimeout` (60 min default, up to 24 h). | `services/authSessionService.ts:16`; `services/auth/authService.ts:90-95` |
| F38 | **Medium** | Self-service password change does not revoke other sessions or the 7-day refresh token (the admin reset path does). | `routes/common/auth/authProfileRoutes.ts:84-90`; `users/use-cases/userPasswordUseCases.ts:129` |
| F39 | **Medium** | Tenant attachments are served `Cache-Control: public, max-age=0`: the `/attachments/` branch returns before the `private, no-store` rule. Root-level attachments have no tenant segment (shared by all sessions) and `avatars` is public. | `plugins/staticAssets.ts:35-38,71-77,145-151` |
| F40 | **Medium** | Upload handlers echo raw 5xx messages (`ENOSPC … /srv/...`) instead of going through the prod error mask. | `routes/common/uploads.ts:40-43,115-118` |
| F31 | **Low** | `/health` is public, rate-limit-exempt, and returns pool/cache/Redis internals. | `routes/common/health.ts:20-40` |
| F32 | **Low** | GR-number generation scans the tenant's students with `COALESCE(...)::text LIKE` on every create. | `db/repositories/studentRepositoryWidgetsOps.ts:42-56` |
| F33 | **Low** | `pageTenantCollections` re-expands the whole JSONB array per OFFSET chunk (O(n²)). | `db/streamingSnapshotProducer.ts:58-74` |
| F34 | **Low** | Migrations `0193`–`0195` omit the `SET LOCAL lock_timeout` preamble; harmless today, but they are the only unguarded DDL left. | `db/migrations_drizzle/019*.sql` |
| F41 | **Low** | Dotfiles are served by both static registrations (`dotfiles` defaults to `allow`). | `plugins/staticAssets.ts:158-166`; `plugins/frontendSpa.ts:26-35` |
| F42 | **Low** | Multipart limits omit `files`, `parts` and `fieldSize`; `parts` defaults to 1000. | `routes/common/uploads.ts:19-21` |
| F43 | **Low** | WebSocket connections have no per-user/global cap, and the duplicate root `/ws` registration is rate-limit-exempt. | `routes/common/websocket.ts:94`; `lib/livePushConnections.ts:78-92` |
| F44 | **Low** | Tenant (and thus the rate-limit bucket) falls back to `X-Forwarded-Host` when `Host` is an IP/localhost — a throttle-rotation path if the Node port is reachable directly. | `lib/requestHost.ts:22-33`; `lib/rateLimitConfig.ts:34-38` |
| F45 | **Low** | The 2FA challenge is not bound to the request tenant; a challenge minted on workspace A can be completed from workspace B's host (token is still rejected there). | `services/auth/twoFactorService.ts:90-104` |
| F46 | **Low** | The OTP attempt counter only increments on `/forgot-password/verify`; `/forgot-password/reset` re-checks the code without counting, so the 5-attempt lockout is bypassable within the rate-limit ceiling. | `services/auth/tenantPasswordOtpService.ts:136-176` |

---

## 3. Critical and high findings

### F1 — The audit trail is not tenant-transaction-bound

**Where:** [`auditTrailService.ts:145`](../apps/backend/src/services/auditTrailService.ts#L145),
[`auditQueryAdapter.ts:28`](../apps/backend/src/audit/repository/auditQueryAdapter.ts#L28).

```ts
// services/auditTrailService.ts
} else {
  tx = activeDb();            // ← bare pool when no transaction is active
}
...
const timestamp = input.transactionTimestamp ?? new Date();
...
await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`audit:${subdomain}`}))`);
```

`activeDb()` returns the transaction bound by `withTenant`/`runInTransaction` **or the root pool**
when there is none ([`dbTransactions.ts:24-26`](../apps/backend/src/db/dbTransactions.ts#L24-L26)).
No request-level transaction exists — `requestHooks.ts` only binds an AsyncLocalStorage *value*.
So any audit call made directly from a route or use-case runs in autocommit with no
`app.current_tenant` GUC. `audit_trail_events` is `ENABLE` + **`FORCE ROW LEVEL SECURITY`** with

```sql
USING (current_setting('app.rls_bypass', true) = 'on'
       OR workspace_subdomain = current_setting('app.current_tenant', true))
```
([`0116_force_rls_missing_tenant_tables.sql:137`](../apps/backend/src/db/migrations_drizzle/0116_force_rls_missing_tenant_tables.sql#L137)).

Consequences under the RLS-subject role that `assertRlsRuntimeRole` **requires** in production:

1. **Appends are rejected** — the INSERT violates the policy. The 12 fire-and-forget call sites
   swallow it in `.catch(logger.error)`: `dbSyncRoutes.ts:153,194` (restore + reset),
   `auditEventRoutes.ts:53,99` (VIEW / export), messaging log edits (`messagingLogContractHandlers.ts:188,262`),
   CSV import/export audit (`registerModuleCsv*Routes.ts`), document templates — those events never exist.
2. **Reads return zero rows** — `listAuditEvents` and `verifyTenantAuditChain` use the same pool.
   `/api/audit/events` would show an empty trail and `/api/audit/verify` would return
   `VERIFIED` having checked nothing.
3. **`POST /api/audit/erasure` 500s after doing the damage** —
   [`cryptoShreddingService.ts:186`](../apps/backend/src/services/cryptoShreddingService.ts#L186)
   calls `recordModernAuditEvent(db, …)` on the pool *after* the key update and erasure row are
   committed; the audit insert throws, the route returns 500, and the client believes it failed
   while the key is shredded.

The 12 fire-and-forget sites are exactly the destructive/bulk operations where an audit record
matters most. The rule is explicit: audit events must be written **in the same transaction** as the
business mutation (`mms-audit-trail` §2). The inverse deployment — a superuser DSN, where these
statements succeed because RLS is inert — is not a fix: it is the state
`assertRlsRuntimeRole` exists to prevent (F10 shows compose attempting exactly that).

**Fix:** make the audit boundary a transaction. Either wrap every audit read/write in
`withTenant(tenant, …)`, or have `recordModernAuditEvent`/`listAuditEvents` open one when
`hasActiveTransaction()` is false; pass `tx` from callers that already own one. Then delete the
`.catch()` swallow so a failed append fails the request.

### F2 — Chain verification is a false green (and a false alarm after archival)

**Where:** [`auditVerificationService.ts:89`](../apps/backend/src/services/auditVerificationService.ts#L89),
[`:189`](../apps/backend/src/services/auditVerificationService.ts#L189),
[`auditTrailService.ts:241`](../apps/backend/src/services/auditTrailService.ts#L241).

```ts
let expectedPreviousHash = GENESIS_AUDIT_HASH;      // ← always starts at genesis
...
.orderBy(asc(auditTrailEvents.transactionTimestamp), asc(auditTrailEvents.id))
```

- The walk has no start cursor and never compares the recomputed head to `audit_merkle_roots`.
  **Tail truncation** (delete the newest N rows) leaves an internally consistent shorter chain and
  is reported `VERIFIED`.
- Detaching a month partition (`scripts/detach-audit-partition.ts`) removes rows whose hashes the
  first remaining row points back to. The very next verification starts at GENESIS, mismatches on
  row 1, and reports `BROKEN_CHAIN` forever; the 6-hourly scheduler repeats it for every tenant.
- `verification_status` is written as `"VERIFIED"` at insert and never updated by any verifier —
  the value the UI/export shows as integrity status is self-asserted.

**Fix:** anchor the walk at the last verified cursor/checkpoint (store `last_verified_id`/hash on
the verification run), start from the stored head after archival, and compare the computed head to
the latest published Merkle root. Only stamp `verification_status` from a verification run.

### F3 — Batch invoice generation skips the ledger

**Where:** [`financeInvoiceGenerationUseCases.ts:52-69`](../apps/backend/src/finance/use-cases/financeInvoiceGenerationUseCases.ts#L52-L69).

```ts
if (drafts.length === 1) {
  return [await financeUseCases.createInvoice({ ...drafts[0], invoiceNumber: undefined })];
}
...
await bulkSaveInvoices(tenant, invoices);   // ← no journal posting
return invoices;
```

`createInvoice` is the only path that calls `tryPostInvoiceJournal`
([`financeMutationOperations.ts:131`](../apps/backend/src/finance/use-cases/financeMutationOperations.ts#L131)).
The normal "generate term/monthly invoices" run creates hundreds of invoices through the batch
branch, so the ledger receives **zero** Dr AR / Cr Income for them. Each later payment still posts
Dr Cash / Cr AR, driving AR negative; revenue is never recognised; cancelling one of these invoices
silently no-ops because there is no source entry to reverse. Nothing marks them as unposted, so the
only symptom is a trial balance that does not reconcile with the invoice subledger.

**Fix:** post a journal entry per generated invoice (batch-aware, in the same transaction as the
bulk insert), or reuse `createInvoice` per row inside one transaction. Backfill existing generated
invoices from the subledger before enabling the feature in production.

### F4 — `POST /api/finance/invoices` can reset a settled invoice

**Where:** [`financeMutationOperations.ts:118-131`](../apps/backend/src/finance/use-cases/financeMutationOperations.ts#L118-L131),
[`financeInvoicesPersist.ts:17-47`](../apps/backend/src/db/repositories/financeInvoicesPersist.ts#L17-L47).

The PUT path is guarded by `assertInvoiceAmountsEditable` (posted invoices cannot change
`finalAmt`/`discountAmt`/`lateFeeAmt`/`paidAmt`). The POST path is not. `invoiceCrud.create()` is a
plain `repo.save()`; `saveInvoice` is `INSERT … ON CONFLICT DO UPDATE` that overwrites `status`,
`paidAmt`, `creditedAmt`, `paidDate` and `method`. A replay — or a deliberate request — with
`{ id: "INV-1", status: "pending", paidAmt: 0, creditedAmt: 0, … }` re-opens a paid invoice while
the payment row and the Dr Cash / Cr AR entry remain, so a second full payment now passes the
balance check. The same request with `status: "cancelled"` bypasses `canCancelInvoice` and posts no
reversal.

**Fix:** make `createInvoice` insert-only (reject an existing id, or route through
`updateInvoiceById` where the ledger guard applies), and refuse settlement fields on insert.

### F5 — Payment commits before allocations and journal

**Where:** [`financeMutationOperations.ts:190-253`](../apps/backend/src/finance/use-cases/financeMutationOperations.ts#L190-L253).

```ts
const savedPayment = await runInTransaction(async () => { … saveInvoice … savePayment … });
// transaction closed
await replacePaymentAllocations(...);
await tryPostPaymentJournal(tenant, savedPayment, settledInvoice ?? undefined);
```

The `FOR UPDATE` lock and balance check are correct, but they end at the commit. If
`tryPostPaymentJournal` throws (closed period, missing posting rules, statement timeout), the
payment is durable and the invoice balance already reduced, while the HTTP request fails. Because
the id is `pay-${Date.now()}` when the client omits one, the retry cannot match the existing
payment and creates a second one against the (now smaller) balance — cash booked twice, one payment
with no allocation and no ledger entry. The allocation write has the same exposure one step earlier.

**Fix:** perform allocation + journal posting inside the same transaction as the payment and
invoice update; keep the idempotency check under the lock.

### F6 — Crypto-shredding is global, under-authorised and inert

**Where:** [`cryptoShreddingService.ts:156-186`](../apps/backend/src/services/cryptoShreddingService.ts#L156-L186),
[`auditTrail.ts:145-198`](../apps/backend/src/db/schema/auditTrail.ts#L145-L198),
[`auditPrivacyRoutes.ts:27-30`](../apps/backend/src/routes/tenant/audit/auditPrivacyRoutes.ts#L27-L30).

`crypto_shredding_keys` and `audit_erasure_requests` have **no `workspace_subdomain` column**, and
the shred is `UPDATE … WHERE subject_id = $1` with no tenant predicate. `subjectId` is a
caller-supplied string, so tenant A can destroy tenant B's key for the same id (or for any guessed
id) and no row in B's erasure log records it. The route is gated on `analytics.view` — which the
default `teacher` role holds via `dashboard: ["read"]` (F35) — for both key destruction and
key-metadata purge (`auditPrivacyRoutes.ts:63-66`).

Separately, `encryptSubjectData`/`decryptSubjectData` have no call sites outside this file: no
subject data is envelope-encrypted, so `CRYPTO_SHRED` returns `COMPLETED` without shredding
anything real, and `REDACT_APPEND` appends a marker without redacting the historical
`old_state`/`new_state` text columns (which store full records, e.g. `studentAuditEvents` writes
the student including guardian name).

**Fix:** add the tenant column to both tables and scope every query; require a write permission
(`settings.global.write` or a dedicated `audit.privacy.manage`) plus step-up confirmation; either
implement envelope encryption on the documented paths or stop reporting the erasure as completed;
redact historical state for `REDACT_APPEND` (append-only copy, no hash rewrite).

### F7 — Credit-note/cancel invoice paths are not serialised

**Where:** [`financeCollectUseCases.ts:186-206`](../apps/backend/src/finance/use-cases/financeCollectUseCases.ts#L186-L206).

```ts
const invoice = await financeUseCases.getInvoiceById(parsed.invoiceId);   // no FOR UPDATE
if (!canCreditInvoice(invoice, parsed.amount)) throw …
const creditedAmt = (invoice.creditedAmt ?? 0) + parsed.amount;
await financeUseCases.updateInvoiceById(invoice.id, { ...invoice, creditedAmt, … });
await tryPostCreditNoteJournal(tenant, invoice, created.id, parsed.amount);
```

Two 60-unit credit notes against a 100-unit invoice both read `creditedAmt = 0`, both pass, both
write 60 and both post a reversal: the ledger carries 120 of credit while `credited_amt` says 60.
`cancelInvoice` has the same shape and can overwrite `paidAmt` with a stale value while a payment's
Dr Cash / Cr AR stays posted.

**Fix:** reuse the payment pattern — lock the invoice row (`findInvoiceById(..., { forUpdate: true })`),
re-check the balance under the lock, and post the journal in the same transaction.

### F8 — Backups are paged without an ORDER BY in READ COMMITTED

**Where:** [`streamingSnapshotProducer.ts:238`](../apps/backend/src/db/streamingSnapshotProducer.ts#L238),
[`dbTransactions.ts:139`](../apps/backend/src/db/dbTransactions.ts#L139).

```ts
const chunk = await listRows(tenant ?? "", { limit: CHUNK_SIZE, offset });
```

The snapshot helpers (`enrollmentRepositoryHydrate.ts:25-26`, `attendanceRepository.ts:49-50`, …)
apply `LIMIT/OFFSET` with no `ORDER BY`, and the long-lived transaction is opened with plain
`BEGIN` (READ COMMITTED), so consecutive chunks are separate snapshots. Postgres gives no stable
row order across two such statements; concurrent writes or a plan change can skip or duplicate
rows. The only guard detects a repeated *first* id, not a missing middle row. A restore from such a
backup silently drops or duplicates enrollment/attendance records.

**Fix:** order by `id` (or a stable key) in every snapshot loader and open the stream in a
`REPEATABLE READ` transaction (the codebase already has `runInReadSnapshotTransaction` for exactly
this reason). Add a checksum/row-count to the backup manifest.

### F9 — Messaging campaigns resend on retry

**Where:** [`messagingCampaignJobRunner.ts:45-140`](../apps/backend/src/services/messagingCampaignJobRunner.ts#L45-L140).

The runner loops recipients and sends through the carrier gateway. `attempts: 3` is the queue
default; any throw after the first batch — a progress patch failing because the row was cleared
(the common case, see F15) or a DB error — makes BullMQ retry the **whole runner from recipient 0**.
`sendTenantSms({ to, body })` has no idempotency key, and message logs are held in memory until the
loop ends, so duplicate sends are not even recorded. Up to 3× carrier cost per recipient.

**Fix:** process recipients in durable, checkpointed batches (persist the log row + cursor before
advancing), key sends by `(jobId, contactId, channel)`, and on abort/resume skip already-sent
recipients.

### F10 — The documented Docker Compose deployment cannot start

**Where:** [`docker-compose.yml:94-96`](../docker-compose.yml#L94-L96),
[`rlsRoleGuard.ts:112-118`](../apps/backend/src/db/rlsRoleGuard.ts#L112-L118).

Compose sets `NODE_ENV=production` and
`DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:…`, and `POSTGRES_USER` defaults to
`postgres` — a **superuser**, which the Postgres image always creates as such.
`resolveRlsEnforcementMode()` defaults to `strict` when `NODE_ENV=production`, and
`initDb()` calls `assertRlsRuntimeRole()` before anything else:

```ts
if (mode === "strict") {
  throw new Error(`[rls] refusing to start: the database role bypasses row-level security. …`);
}
```

The backend container therefore crash-loops on first boot with no override in the compose file.
Setting `POSTGRES_USER=mms_app` does not help: that role is created as the cluster superuser.

**Fix:** provision a `NOSUPERUSER NOBYPASSRLS` role in an init SQL script, point `DATABASE_URL` at
it, and add a compose healthcheck that asserts the guard's log line; or explicitly set
`MMS_DB_ROLE_ENFORCEMENT=off` in the compose profile and document that RLS is not protecting the
stack.

### F11 — Finance/accounting mutations are unaudited

**Where:** domain-wide; e.g. [`accountingEntryMutationUseCases.ts:73-81`](../apps/backend/src/accounting/use-cases/accountingEntryMutationUseCases.ts#L73-L81).

Grepping `recordModernAuditEvent` across `finance/`, `accounting/`, `obligations/` and their routes
returns only five accounting use-cases (exchange rates, FX revaluation, IAS 29, hedges, journal
reversal) plus finance **setup** config. There is no global audit hook, and
`createCollectionAuditHelper` is never used by the finance routes. Invoice create/update, payments,
credit notes, cancellations, late fees, journal create/update/bulk-upsert, and period close all
mutate the books with zero `audit_trail_events` rows. Archive/restore of invoices and payments
(`financeRecordLifecycle.ts:206-274`) reverses and re-posts ledger entries unaudited.

**Fix:** add an explicit `recordModernAuditEvent(tx, …)` to each ledger/finance write use-case
(the reversal path is the model), or a generic repository-level audit bridge that captures
old/new state inside the same transaction.

### F12 — Audit chain order is decided under the lock, verification order before it

**Where:** [`auditTrailService.ts:150` and `:158`](../apps/backend/src/services/auditTrailService.ts#L150-L158).

`transactionTimestamp` is captured **before** `pg_advisory_xact_lock`, and `getLatestShardHash`
selects the head by `(transaction_timestamp DESC, id DESC)` while verification walks ascending.
Writer A can stamp `T1` then block on the lock, writer B stamp `T2 > T1` and win the lock, insert
(`hash_previous = H0`); A then acquires the lock, sees B as head and links A→B while holding the
*older* timestamp. Verification sorts by timestamp, sees A first with `hash_previous = B.hash`, and
reports `BROKEN_CHAIN` permanently. The same inversion is guaranteed for callers that pass an
explicit older timestamp (`reverseJournalEntryUseCase.ts:179`).

**Fix:** assign the ordering key inside the lock (`clock_timestamp()` after acquisition, or a
monotonic per-shard sequence column) and make the head query and the verifier use the same key.

### F35 — Audit governance is a dashboard read permission

**Where:** [`auditPrivacyRoutes.ts:23`](../apps/backend/src/routes/tenant/audit/auditPrivacyRoutes.ts#L23),
[`permissionRules.ts:95-99`](../packages/shared/src/auth/permissionRules.ts#L95-L99),
[`userRbacDefaultRoles.ts:97`](../packages/shared/src/auth/userRbacDefaultRoles.ts#L97).

```ts
if (!roleHasPermission(user?.role ?? "", "analytics.view")) return sendForbidden(reply);
```

`analytics.view` resolves to `{ module: "dashboard", requiredActions: ["read"] }` and the default
`teacher` role already has `dashboard: ["read"]`. Every `/api/audit/*` route therefore treats a
dashboard read as sufficient for:

- irreversibly shredding subject keys and running the retention purge (F6),
- reading `/api/audit/events` — actor ids, IP addresses, user agents, session ids, endpoints,
- exporting up to 1,000 events with `oldState`/`newState` (`/api/audit/export`),
- publishing a global Merkle checkpoint and reading every workspace's roots (F26).

The module-coverage test lists `/api/audit/*` as "own permissions", so no module action gate
applies; the "own permission" is a dashboard read.

**Fix:** add a dedicated `audit.view` / `audit.manage` permission (admin/super-admin only), gate the
privacy and integrity endpoints on `audit.manage`, and regenerate the shared permission maps and
role defaults.

### F36 — Staff activity logs can be forged by any `analytics.view` holder

**Where:** [`rbacPermissionMaps.ts:147`](../apps/backend/src/lib/rbacPermissionMaps.ts#L147),
[`users.ts:47-55`](../apps/backend/src/routes/tenant/users.ts#L47-L55),
[`logsRepository.ts:163-172`](../apps/backend/src/db/repositories/logsRepository.ts#L163-L172).

`COLLECTION_WRITE_PERMISSION.user_activity_logs` is `analytics.view` — the same value as the read
map. `PUT /api/users/activity/bulk` (registered through `registerBulkRoutes`) is gated only by
`canWriteCollection`, and the module rule for `/users/activity` is deliberately reduced to
`availability`. The body schema accepts `userId`, `userName`, `action`, `module`, `detail`, `ts`
and `ip` from the client, and persistence is `INSERT … ON CONFLICT DO UPDATE` over the existing row
id. A teacher can therefore rewrite the actor, timestamp and source IP of existing activity rows and
inject fabricated ones — the screen used to review staff actions. (The immutable
`audit_trail_events` chain is separate, but see F1/F11 for its own gaps.)

**Fix:** map the write to a separate `audit.write`/admin permission, derive `userId`, `ts` and `ip`
server-side from the authenticated request, and make the endpoint append-only (reject an id that
already exists).

---

## 4. Medium findings

### F13 — Fiscal-year close races concurrent postings

`closeFiscalYearForTenant` reads the year, aggregates the trial balance, builds the closing entry
and saves `status: "closed"` with no row lock and no advisory lock
([`accountingPeriodClose.ts:41-107`](../apps/backend/src/accounting/use-cases/accountingPeriodClose.ts#L41-L107)).
The posting guard reads the year in a separate statement. A posting dated inside the year can commit
between the aggregate and the save: it is included in the year's reports but excluded from the
closing entry, so retained earnings and opening equity are understated. Fix: lock the fiscal-year
row (`FOR UPDATE`) and re-verify all postings for the date range before flipping status, or take a
per-tenant accounting advisory lock shared by posting.

### F14 — Idempotency keys are global

Export/import routes accept a client `idempotencyKey` and use it directly as
`background_jobs.id` (`text primary key`) and BullMQ `jobId`
([`csvExportEnqueue.ts:40`](../apps/backend/src/lib/csvExportEnqueue.ts#L40),
[`system.ts:59`](../apps/backend/src/db/schema/system.ts#L59)). `getUserBackgroundJob` is
user-scoped, so a second tenant with the same key reaches the insert and gets a 23505 → 500; if the
first row has been dismissed, the insert succeeds but `queue.add` is deduped by the surviving BullMQ
job, leaving a row that never runs. Fix: namespace the id (`${tenant}:${userId}:${key}`) or use a
composite unique index and a per-tenant queue key.

### F15 — Job status never becomes `running`

`enqueueBackgroundJob` forces `status: "pending"` and `executeJob` only patches progress/completed/
failed ([`backgroundJobWorkerService.ts:237-243`](../apps/backend/src/services/backgroundJobWorkerService.ts#L237-L243)).
So: "clear finished" (`ne(status, "running")`) deletes queued and in-flight rows; startup cleanup
fails every `pending` row older than 10 minutes by `createdAt`, i.e. legitimate backlog; and the
`running` heartbeat sweep in `workerOrphanCleanup.ts` can never match a row. A deleted row also makes
the next progress write throw → BullMQ retry (which for campaigns means duplicate sends, F9).
Fix: persist `running` with a heartbeat `updated_at` at job start and use `updatedAt` for both
sweeps.

### F16 — Sandbox timeout does not cancel the runner

[`sandboxedExportProcessor.ts:47-66`](../apps/backend/src/worker/processors/sandboxedExportProcessor.ts#L47-L66)
rejects a `Promise.race` and aborts an `AbortController` that no export/PDF runner reads (only the
messaging runner checks `ctx.signal`). The original `executeJob` continues in the forked child while
BullMQ starts the retry; both upload to distinct `Date.now()` keys and the retry can regress a
`completed` row back to progress 0. Fix: check `signal.aborted` between chunks in every runner, and
have the timeout path await/terminate the child rather than abandon it.

### F17 — Worker shutdown kills work it should drain

`forceExitTimer` is 10 s while `JOB_EXECUTION_TIMEOUT_MS` is 60 s and `lockDuration` is 60 s, and
`await worker.close()` waits for active jobs ([`worker/index.ts:169-189`](../apps/backend/src/worker/index.ts#L169-L189)).
Any deploy during an export or campaign kills it; BullMQ recovers it as stalled and re-runs it.
Fix: derive the force-exit budget from the largest job timeout + drain margin, and stop accepting
new jobs first (`worker.pause()`).

### F18 — BullMQ loses Redis URL semantics

`getBullMQConnectionOptions` parses `REDIS_URL` manually and returns only
`{ host, port, password, username, … }` ([`redisBullMQ.ts:18-45`](../apps/backend/src/lib/redisBullMQ.ts#L18-L45)):
the DB index (`/2`) is dropped and `rediss://` never gets `tls`, so jobs land in DB 0 next to any
other deployment sharing the instance (and a TLS-only Redis cannot be reached). Queue names are
hard-coded with no prefix. Fix: pass the parsed URL to ioredis/BullMQ (or forward `db` and `tls`
explicitly) and add `QUEUE_PREFIX` per environment.

### F19 — Any tenant user can dismiss another user's job

`dismissUserBackgroundJob(_userId, jobId)` filters only `tenantId` + `id`
([`backgroundJobService.ts:170-181`](../apps/backend/src/services/backgroundJobService.ts#L170-L181)).
The route then deletes the artifact under the *caller's* id, so the victim's artifact map entry is
unreachable and its blob is never pruned. Fix: include `userId` (or `effectiveUserId`) in the WHERE
and delete the artifact for the row's owner.

### F20 — Export-artifact registry is a global read-modify-write document

`saveExportArtifact` loads the whole per-tenant map, mutates it and writes it back with no CAS/lock
([`exportArtifactService.ts:72-92`](../apps/backend/src/services/exportArtifactService.ts#L72-L92)).
Two workers completing exports concurrently lose one entry (download 404s, blob orphaned); retries
write fresh `Date.now()`-suffixed keys, so the loser's blob is orphaned by design; clear-finished and
tenant purge never delete blobs. Fix: store artifacts as rows keyed `(tenant, user, jobId)` or use
an object-store listing/TTL sweeper; delete the blob when the job row is deleted.

### F21 — Scheduler leader lease can crash the worker

```ts
purgeSchedulerTimer = setTimeout(() => {
  void (async () => {
    const lease = await tryAcquireLeaderLease(LEADER_LOCK_RETENTION_PURGE);   // ← can throw
    …
  })().finally(() => scheduleNextDailyPurge(…));                              // ← no .catch
}, delayMs);
```
([`retentionPurgeScheduler.ts:82-96`](../apps/backend/src/worker/retentionPurgeScheduler.ts#L82-L96);
same shape in `sessionLifecycleScheduler.ts`.) `tryAcquireLeaderLease` rethrows query failures, and
`worker/index.ts` turns `unhandledRejection` into `process.exit(1)`, killing every in-flight job.
Fix: `.catch()` the acquisition (log and reschedule) — `fxRates/fxRateFeedScheduler.ts` already does
this correctly.

### F22 — `queue.add` timeout reports failure but can still enqueue

The 6 s race returns `false` on timeout while the `addPromise` is never cancelled; the caller marks
the row failed and returns 503, and Redis may still accept the job seconds later
([`worker/queues/index.ts:154-183`](../apps/backend/src/worker/queues/index.ts#L154-L183)). Fix:
retry the `add` with a bounded deadline and reconcile (check `queue.getJob`) before declaring
failure; or mark the row `unknown` rather than terminal.

### F23 — Backup streams inherit request-sized timeouts

`beginLongLivedTenantTransaction` applies the per-transaction guards with defaults
`statement_timeout = 30 s` and `idle_in_transaction_session_timeout = 15 s`
([`tenantTransactionGuards.ts:35-36`](../apps/backend/src/db/tenantTransactionGuards.ts#L35-L36)),
and the backup/sync routes pass no override ([`dbSyncRoutes.ts:87,112`](../apps/backend/src/routes/common/db/dbSyncRoutes.ts#L87)).
The asset loop does disk/S3 I/O between statements, so a slow asset read or slow client aborts the
session (`57P05`). Fix: pass an explicit larger `statementTimeoutMs`/idle budget for snapshot
transactions.

### F24 — Workspace reset is non-atomic and effectively unaudited

`POST /api/db/reset` (admin `settings.global.write`) calls `resetTenantData`, which purges every
tenant row across several transactions and then reseeds collection-by-collection
([`dbPurge.ts:84-100`](../apps/backend/src/db/dbPurge.ts#L84-L100)) — a crash mid-way leaves a
partially wiped workspace. The route records the audit event **after** the wipe with
`void recordModernAuditEvent(...)` ([`dbSyncRoutes.ts:187-210`](../apps/backend/src/routes/common/db/dbSyncRoutes.ts#L187)),
which under F1 never persists. There is no step-up authentication or typed confirmation. Fix:
single transaction for purge+seed, audit inside it, and require a short-lived confirmation token.

### F25 — Cursor pagination never starts

`nextCursor` is returned only when the request already carried `afterId`
([`listPageHelper.ts:96`](../apps/backend/src/db/repositories/listPageHelper.ts#L96)), so the first
page (no `afterId`) never returns one. The frontend's cursor-based infinite lists pass
`getNextPageParam: (lastPage) => lastPage.nextCursor`
([`useContactsQueries.ts:90`](../apps/frontend/src/tenant/features/contacts/hooks/useContactsQueries.ts#L90)),
so they can never fetch page 2. No UI consumes `useContactsInfiniteList` today, so it is latent, but
the contract is broken by construction. Fix: return `nextCursor` whenever there is a next page,
regardless of how this page was requested.

### F26 — Merkle-roots endpoints cross tenants

`GET /api/audit/merkle-roots` has no permission check and `listMerkleRoots` reads the global table
with no tenant predicate; `POST` (gated only by `analytics.view`) publishes a checkpoint covering
**all** tenants from a tenant-scoped route
([`auditIntegrityRoutes.ts:34-48`](../apps/backend/src/routes/tenant/audit/auditIntegrityRoutes.ts#L34-L48)).
Fix: gate both on a platform/audit-admin permission and scope the checkpoint to the shard, or move
the global operations to the platform console.

### F27 — Contact search cannot use an index

`buildSearchSql` builds `concat_ws(...)` over the contact row plus three correlated
`string_agg` subqueries (phones, emails, addresses) and matches `LIKE '%term%'`
([`contactRepositoryListSql.ts:83-116`](../apps/backend/src/db/repositories/contactRepositoryListSql.ts#L83-L116)).
No `pg_trgm`/GIN index exists in any migration, and `runListPage` executes the same predicate again
for `count(*)`. Every search page scans all tenant contacts with four subqueries per row. Fix: add a
`gin_trgm_ops` index on a maintained search column (or a materialized search vector) and use it for
both the page and the count.

### F28 — Fair-share priority is inverted for retrying tenants

`incrementTenantInflightJobs` runs once at dispatch; `worker.on("failed")` decrements on **every**
failed attempt ([`worker/index.ts:100-110`](../apps/backend/src/worker/index.ts#L100-L110)). A job
that fails twice and is still retrying has already decremented twice, so a loaded tenant is scored
as idle and gets the highest priority band. Fix: decrement only on the final failure/completion
(compare `attemptsMade` to `opts.attempts`), or track job ids in the counter.

### F29 — Unbounded export and restore paths

The JSON/XLSX export path loads every matching row then builds the grid and base64 string in memory
([`createModuleExportService.ts:78-87`](../apps/backend/src/lib/createModuleExportService.ts#L78-L87)),
while the CSV path is capped. "Restore all" messaging logs issues one `UPDATE` over a 365-day table
with no batching or limit ([`messagingLogsMutationRepository.ts:36-56`](../apps/backend/src/db/repositories/messagingLogsMutationRepository.ts#L36-L56)).
Fix: stream XLSX (ExcelJS streaming writer already exists) and batch the log restore with
`LIMIT`/`SKIP LOCKED` loops.

### F30 — PM2 cluster multiplies the DB pool

`ecosystem.config.cjs` starts the API with `instances: "max"` (`exec_mode: "cluster"`), and each
instance opens `PG_POOL_MAX` (≥20) connections; `.env.example` and `docker-compose.yml` document a
"2 × PG_POOL_MAX" budget that assumes one API process
([`ecosystem.config.cjs:40-45`](../ecosystem.config.cjs#L40-L45),
[`apps/backend/.env.example:32-40`](../apps/backend/.env.example#L32-L40)). On an 8-core host that is
~170 connections plus the worker's 10 against Postgres' default 100. Fix: set `PM2_INSTANCES`
explicitly and compute `PG_POOL_MAX = floor(budget / instances)`, or document the required
`max_connections`.

### F37 — Logout revokes a token for less time than it lives

`revokeToken(jti)` writes `session:revoked:<jti>` with a 15-minute TTL
([`authSessionService.ts:16,31-36`](../apps/backend/src/services/authSessionService.ts#L16-L36)), but
access tokens are signed with `expiresIn = sessionTimeout` minutes
([`authService.ts:90-95`](../apps/backend/src/services/auth/authService.ts#L90-L95)) — 60 minutes
by default, up to 1,440. Fifteen minutes after sign-out the marker expires and a stolen access token
is accepted again until its own `exp`. Logout also leaves the server-side idle clock fresh
(`sessionClockService`), so the session does not re-expire. Fix: derive the revocation TTL from the
token's remaining lifetime (`exp − now`), or revoke the user session (which the marker should mirror).

### F38 — Password change leaves other sessions alive

`POST /api/auth/change-password` hashes the new password and clears the caller's cookies
([`authProfileRoutes.ts:84-90`](../apps/backend/src/routes/common/auth/authProfileRoutes.ts#L84-L90));
unlike the admin reset path it never calls `revokeAllUserSessions`
([`userPasswordUseCases.ts:129`](../apps/backend/src/users/use-cases/userPasswordUseCases.ts#L129)).
A stolen refresh token (7-day artifact) or another device's access token keeps working after the
password change — precisely the action a user takes when they suspect compromise. Fix: revoke all
sessions and refresh artifacts after a successful self-service change (and require re-login, which
the response already signals with `requiresSignIn: true`).

### F39 — Tenant attachments lose their private cache header

`setStaticAssetHeaders` returns early for any path containing `/attachments/`, before the
`uploads/tenants/` rule that sets `Cache-Control: private, no-store` and
`Vary: Authorization` ([`staticAssets.ts:35-38,71-77`](../apps/backend/src/plugins/staticAssets.ts#L35-L77)).
`@fastify/static`/`send` then leave their default `Cache-Control: public, max-age=0`, so a shared
proxy may store pupil/finance documents. Revalidation still requires the session, but the module's
own contract says these must never be public. Two related gaps in the same file: files under the
uploads root without a `tenants/<t>/` prefix are served to **any** authenticated session
(`authorizeUpload` returns when `tenantSegmentOf()` is null), and `avatars/` is in
`PUBLIC_UPLOAD_CATEGORIES` even though it holds personal staff/student photos. Fix: apply the
tenant rule before the attachment branch (and set the headers explicitly), scope or remove
root-level uploads, and require a session for avatars.

### F40 — Upload errors bypass the production error mask

Both upload handlers return `err.message` for any status, including 500
([`uploads.ts:40-43,115-118`](../apps/backend/src/routes/common/uploads.ts#L40-L43)). Filesystem
failures surface as `ENOSPC: no space left on device, write /srv/mms/uploads/tenants/<tenant>/…`,
leaking internal paths and infrastructure state to any authenticated uploader — the one place in
the backend that bypasses `registerErrorHandlers`' prod masking. Fix: pass the error through the
shared handler (or log it and return the generic stage message + request id).

---

## 5. Low findings and hygiene

- **F31 `/health`** is public through Apache (the deploy workflow curls it), exempt from rate
  limiting, and returns pool counts, replica state, Redis connectivity and cache metrics
  ([`health.ts:20-40`](../apps/backend/src/routes/common/health.ts#L20-L40)). Return a bare status to
  unauthenticated callers (or require the metrics token) and keep the detail for loopback scrapes.
- **F32 GR numbers** are computed by `COALESCE(registered_date::text,'') LIKE 'YYYY%' OR
  COALESCE(gr_number,'') LIKE '%YYYY%'` on every student create — a full scan of live **and**
  archived rows ([`studentRepositoryWidgetsOps.ts:42-56`](../apps/backend/src/db/repositories/studentRepositoryWidgetsOps.ts#L42-L56)).
- **F33** `pageTenantCollections` applies `LIMIT/OFFSET` *above* `jsonb_array_elements`, so chunk
  *n* re-parses `n × 500` elements ([`streamingSnapshotProducer.ts:58-74`](../apps/backend/src/db/streamingSnapshotProducer.ts#L58-L74)).
- **F34** `0193`–`0195` lack `SET LOCAL lock_timeout` (the newest migration has it). They only touch
  freshly-created tables today; add the preamble so a future edit cannot take a blocking lock.
- **F41** Both static registrations omit `dotfiles`, and `@fastify/static` defaults to `allow`
  ([`staticAssets.ts:158-166`](../apps/backend/src/plugins/staticAssets.ts#L158-L166),
  [`frontendSpa.ts:26-35`](../apps/backend/src/plugins/frontendSpa.ts#L26-L35)). Traversal is
  rejected, so exposure depends on a dotfile landing in the uploads root or `dist/` (e.g. `.env`).
  Set `dotfiles: "deny"` (or `"ignore"`).
- **F42** Multipart accepts the library defaults for `parts` (1,000) and leaves `files`/`fieldSize`
  unset, so one authenticated request can stream up to ~1,000 × 10 MB parts while `request.file()`
  consumes only the first ([`uploads.ts:19-21`](../apps/backend/src/routes/common/uploads.ts#L19-L21)).
  Set `files: 1`, a small `parts`/`fieldSize`, and rely on the 10 MB `fileSize`.
- **F43** Live-push sockets have no per-user or global cap (a 30 s ping timer per socket) and the
  duplicate root `/ws` registration is outside `/api`, so it is exempt from the limiter
  ([`websocket.ts:94`](../apps/backend/src/routes/common/websocket.ts#L94),
  [`livePushConnections.ts:78-92`](../apps/backend/src/lib/livePushConnections.ts#L78-L92)). Socket
  auth itself is sound.
- **F44** `requestHostname` falls back to the client's `X-Forwarded-Host` whenever `Host` is an
  IP/localhost ([`requestHost.ts:22-33`](../apps/backend/src/lib/requestHost.ts#L22-L33)), and that
  tenant feeds the rate-limit key. An attacker who can reach the Node port directly can rotate
  buckets. Token↔tenant binding still prevents data access; only reachable behind a proxy that
  preserves `Host`.
- **F45** `verifyTwoFactorChallenge` never compares the challenge's `workspaceSubdomain` to the
  request tenant ([`twoFactorService.ts:90-104`](../apps/backend/src/services/auth/twoFactorService.ts#L90-L104)).
  The issued token is workspace-bound and rejected on the wrong host, so this is login-CSRF/forced
  logout, not impersonation.
- **F46** The OTP `attempts` counter increments only in `verifyTenantPasswordResetOtp`; the
  `resetTenantPassword` step re-verifies the same code without counting
  ([`tenantPasswordOtpService.ts:136-176`](../apps/backend/src/services/auth/tenantPasswordOtpService.ts#L136-L176)).
  The 5-attempt lockout can be skipped by calling the reset route repeatedly; only the 10/min rate
  limit bounds guesses.
- **Nested `withTenant` re-points RLS**: a nested call with a different tenant `set_config`s
  `app.current_tenant` inside the outer transaction and restores it afterwards
  ([`tenant-context.ts:66-108`](../apps/backend/src/db/tenant-context.ts#L66-L108)), whereas nested
  `runInTransaction` ignores its tenant. It is documented as intentional, but it is the one place
  where a mis-threaded tenant string can turn the fail-closed design into a cross-tenant window.
  Consider rejecting a mismatched nested tenant outright.

---

## 6. What is demonstrably strong

These are not consolation prizes; each is a control that would otherwise be a finding:

1. **Tenant isolation fails closed at the transaction boundary.** `resolveTenantScope` rejects
   empty, `"undefined"` and `"null"` tenants unless `allowGlobal` is explicit; all three transaction
   helpers share it ([`tenantScopeGuard.ts:56-81`](../apps/backend/src/db/tenantScopeGuard.ts#L56-L81)),
   and `tenantScopeGuards.test.ts` / `tenantContextGuards.test.ts` cover the failure paths.
2. **RLS is not assumed.** `assertRlsRuntimeRole` inspects `current_user` at boot and refuses to
   start under a superuser/BYPASSRLS role in production
   ([`rlsRoleGuard.ts:85-118`](../apps/backend/src/db/rlsRoleGuard.ts#L85-L118)) — the reason F10 is
   a deployment bug rather than a silent isolation gap.
3. **Module access is a three-layer gate with an exhaustive coverage test.**
   `registerModuleAccess` + `MODULE_ROUTE_ACTION_RULES` + the shared policy, verified by a test that
   enumerates every route (>500), requires `moduleAccess` on module routes, and requires exact
   listing (no stale exemptions) for non-module routes.
4. **Auth is server-authoritative per request.** Role is reloaded from the RBAC matrix (not trusted
   from the JWT), revocation and workspace-enabled checks are batched in one Redis round-trip,
   soft-deleted users/faculty are rejected, and a tenant mismatch between token and host is a 403
   ([`authenticate.ts:44-260`](../apps/backend/src/middleware/authenticate.ts#L44-L260)).
5. **CSRF is defence-in-depth, not a header check.** Origin/Referer + `Sec-Fetch-Site` + JSON
   media-type + double-submit token, failing closed for cookie-authenticated mutations with no
   origin signal ([`csrfOriginGuard.ts:89-232`](../apps/backend/src/plugins/csrfOriginGuard.ts#L89-L232)).
6. **Session cookies are HttpOnly, Secure in production, host-only, SameSite=Lax**, with a separate
   7-day CSRF cookie ([`authCookieService.ts:41-78`](../apps/backend/src/services/auth/authCookieService.ts#L41-L78)).
7. **Money and FX are exact.** BigInt minor units, explicit rounding, no float in the conversion
   path; posting invariants (single-sided lines, balanced totals) are enforced at persist
   (`accountingLedgerInvariants.ts`, `money.ts`).
8. **Posting is idempotent by `(source_type, source_id)`** with a partial unique index and a
   unique-violation-means-someone-else-won path (`ledgerPostingHelpers.ts:23-45`).
9. **Payment settlement takes `FOR UPDATE`** on the invoice and re-checks the balance inside the
   transaction — the correct pattern that F4/F7 are missing.
10. **Posted journal entries are immutable and reversible only**, including the bulk-delete SQL.
11. **CSV injection and SSRF are handled centrally** (`csvUtils` formula neutralisation,
    `outboundUrl` private-range + DNS-rebinding checks).
12. **Migrations are forward-only, journal-consistent (197/197), lock-timeout guarded for new DDL**,
    and the runtime never uses `SELECT *` (ratchet: 0).
13. **No `any`, no `@ts-ignore`, no TODO/FIXME, no file over 300 LOC** in backend source; all 2,098
    unit tests, typecheck and lint pass.
14. **No route is registered without authentication.** Every module plugin installs
    `authenticateTenant` + `registerModuleAccess` before its children; `/api/db/*` adds
    `authenticateTenant` and restricts the document store to `{currencies, backups}`; the WebSocket
    handshake checks origin, token type, tenant match, revocation, 2FA and workspace enablement
    before registering a connection.
15. **Platform-console privilege boundaries hold.** A platform admin cannot delete/disable a
    `super_user`, permission edits and admin creation are super-user-gated, self-edit is blocked,
    and platform sessions carry a `sessionVersion` that revokes on change.
16. **Refresh-token rotation is atomic and reuse-aware** — a reused refresh artifact revokes every
    session for the user.
17. **Public/apex surfaces are deliberately minimal** — `PublicWorkspaceSummary` only for the
    registry, `Workspace` identity fields for `/current`, `openapi.json` and `/metrics` 404 unless
    explicitly enabled, and pagination is bounded (`LIST_PAGE_MAX_LIMIT = 100`).
18. **The SPA fallback cannot mask API 404s** (`/api` and `/uploads` always return the JSON 404),
    and image uploads are magic-byte verified with orphan cleanup and traversal rejection.
19. **Logging and production errors are redacted by construction** — one redaction policy covers both
    pino instances at three depths (passwords, tokens, cookies, OTPs, auth headers), and 5xx responses
    return a stage label plus request id, never the error message (`lib/logRedaction.ts`,
    `lib/errorHandler.ts:43-58`).
20. **Operational surfaces are deliberate** — `/ready` flips to 503 before draining, `/metrics` is off
    by default and token-protected when on, W3C `traceparent` is propagated into audit correlation
    ids, and shutdown drains before closing the pool.

### Reviewed and found safe (do not re-investigate)

- `X-Tenant-Id` only salts the ETag; authorization and the rate-limit key use the AsyncLocalStorage
  tenant bound from the host.
- The contact self-service PUT (module action `availability`) still enforces `isOwnContact`.
- Non-admin `global_settings` writes cannot change `sessionTimeout`, 2FA policy, enabled modules or
  the password policy; the handler filters them.
- `inner.register(rateLimit, AUTH_RATE_LIMIT)` in the OTP routes is **not** a silent no-op: each
  registration creates its own `rateLimitRan` symbol, so the strict limiter runs alongside the
  global one.
- `/api/db/collections/:name` cannot reach typed tables (allowlist `{currencies, backups}`).
- Refresh on a disabled workspace mints a token that `authenticateTenant` then rejects — not a
  bypass.

---

## 7. Assurance gaps

- **The test suite mocks the database boundary.** 2,098 unit tests pass while F1 (audit RLS),
  F3/F5 (ledger posting) and F8 (backup paging) are present — because the mocked pool returns rows
  regardless of GUCs. The 48 real-Postgres suites under `db-integration/` are the right instrument;
  they run in the `test-backend-db` CI job on DB-path changes, but coverage of these behaviours
  (audit under a non-superuser role, posting after batch generation, backup under concurrent writes)
  is absent.
- **Backend coverage floors are 46 % lines / 33 % branches** (`apps/backend/vitest.config.ts:57`),
  measured on the mocked unit suite only. Branch coverage of error/rollback paths is the weakest
  area, which is exactly where F5/F16/F21/F22 live.
- **No route-level authentication coverage test** analogous to `moduleAccessCoverage`: non-module
  routes are asserted to be *listed*, not that they actually install `authenticateTenant` /
  `authenticatePlatform`. The current list is correct on inspection, but the invariant is manual.
- **No authorization-matrix test for non-module routes.** Nothing asserts that a destructive or
  privacy operation is gated on a *write* permission; F35/F36 both arise from a read permission
  (`analytics.view`) being reused for writes. A table-driven test over sensitive routes would catch
  the next one.
- **No load/concurrency test** exercises concurrent invoice posts, credit notes, audit appends or
  fiscal close — the class of defect F7/F12/F13 describes.

---

## 8. Recommended remediation order

1. **Audit integrity (F1, F2, F12) — one unit.** Bind audit reads/writes to a tenant transaction;
   anchor verification to a checkpoint; take the ordering timestamp under the shard lock. Until
   this lands, treat the audit trail as best-effort, not evidence.
2. **Audit governance (F35, F36).** Introduce dedicated `audit.view` / `audit.manage` permissions,
   stop gating destructive privacy operations on a dashboard read, and server-derive the actor,
   timestamp and IP for activity logs (append-only).
3. **Ledger correctness (F3, F4, F5, F7).** Post batch-generated invoices; make invoice create
   insert-only; put allocation+posting in the payment transaction; lock invoice rows for
   credit/cancel. Add a reconciliation report (subledger vs trial balance) as a regression guard.
4. **Privacy (F6).** Tenant-scope the shredding tables, require a write permission plus step-up,
   and stop reporting completed erasure while no data is encrypted.
5. **Session lifecycle (F37, F38, F45, F46).** Revocation TTL from the token's remaining life,
   revoke on password change, bind 2FA challenges to the tenant, count every OTP failure.
6. **Backup/restore (F8, F23, F24).** Ordered keyset paging in a REPEATABLE READ snapshot, explicit
   long-lived timeouts, and an atomic + audited reset.
7. **Jobs (F9, F14–F22).** Per-recipient idempotency for messaging; persist `running`; cancel
   runners on timeout; fix shutdown budget; namespace job ids; fix queue prefix/TLS; surface
   artifact lifecycle.
8. **Uploads/static (F39–F42).** Apply the private cache rule before the attachment branch, scope
   root-level files, require a session for avatars, mask upload errors, set multipart and dotfile
   limits.
9. **Deploy (F10, F30).** Provision the RLS role in compose, and derive the pool size from the PM2
   instance count.
10. **Performance (F25, F27, F29, F32, F33).** Cursor contract, trigram search index, streaming XLSX,
    GR counter, JSONB paging.

---

## 9. What this review could not verify

- **Live PostgreSQL behaviour** — no database was available. F1/F2/F8/F12/F13 are reasoned from the
  RLS policy, the transaction helpers and the SQL; they should be reproduced against a real
  Postgres with a `NOSUPERUSER NOBYPASSRLS` role before fixes are merged.
- **Runtime concurrency** — F7/F12/F13 are interleavings that need a concurrency harness.
- **Production deployment** — no access to the Hetzner host, Apache config or PM2 state. F10/F30 are
  read from the committed compose/ecosystem files.
- **E2E/browser flows** — not run; this review is backend-only.
- **Queue/Redis topology** — F18's impact depends on whether environments share a Redis instance.

---

## Appendix — commands run

```bash
pnpm --filter mms-backend typecheck
pnpm --filter mms-backend lint
pnpm --filter mms-backend test
node scripts/check-backend-boundaries.mjs
node scripts/check-backend-structure.mjs
node scripts/check-code-norms.mjs --json
node scripts/check-migration-indexes.mjs
node scripts/check-db-projections.mjs
node scripts/check-migration-hygiene.mjs
node scripts/check-migrations-forward-only.mjs
node -e '<journal vs SQL file count>'          # 197 / 197
```

---

## 10. Resolution — implementation status (same day)

All findings were implemented on `fix/backend-review-hardening`. Every backend unit suite
(306 files / 2,155 tests), shared suite (232 / 1,730) and frontend suite (1,015 / 3,639) passes;
typecheck, lint, code-norms, backend structure/boundaries, migration index/hygiene and docs
ratchets pass.

| Finding | Status | Implementation evidence |
| --- | --- | --- |
| F1 | Fixed | `recordModernAuditEvent` joins or opens a tenant transaction; audit reads run in `withTenantRead`; the 12 swallowed sites now await; restore/reset audit inside the transaction. |
| F2 | Fixed | Anchor columns on `audit_verification_runs`, resume-after-head, archived-anchor tolerance, per-shard `heads` and `CHECKPOINT_NOT_IN_CHAIN`; rows insert as `PENDING`. ADR-018. |
| F3 | Fixed | Batch generation is one transaction and calls `tryPostInvoiceJournals` (rules/years loaded once, bulk entry save). |
| F4 | Fixed | POST is insert-only: exact (or settled) replay returns the stored row, anything else is 409. |
| F5 | Fixed | Allocations + journal + audit moved inside the payment transaction. |
| F6 | Fixed | Both tables carry `workspace_subdomain` + FORCE RLS; erasure/purge are tenant-scoped; `audit.manage` + step-up header; no-key returns 409; subject-state encryption at capture for person modules. |
| F7 | Fixed | Credit-note and cancel use `getInvoiceByIdForUpdate`; reversals/audit in the same transaction. |
| F8 | Fixed (guard + ordering) | Backup runs REPEATABLE READ, high-volume loaders now `ORDER BY id`, and the stream aborts on a duplicate id instead of emitting a corrupt backup. Indexes are built out of band. |
| F9 | Fixed | Per-recipient message-log claim (`msg-<sha256(jobId|contactId|channel)>`), immediate status update, stale-claim reclaim, abort throws. |
| F10 | Fixed | Compose provisions `mms_app` (`NOSUPERUSER NOBYPASSRLS`), makes it the DB owner, uses it in `DATABASE_URL`, and sets strict enforcement; README/env updated. |
| F11 | Fixed | Awaited audit events inside invoice/payment/credit/journal/close transactions with minimized state. |
| F12 | Fixed | Ordering key captured after the shard lock and clamped above the previous head. |
| F13 | Fixed | Close takes a row lock + per-year advisory lock; posting paths take the same advisory lock. |
| F14 | Fixed | `buildBackgroundJobId(tenant,user,key)` namespaces client keys across routes. |
| F15 | Fixed | `running` persisted at start; pending sweep uses `updatedAt`; clear-finished only deletes completed/failed. |
| F16 | Fixed | Abort checks through export/import/PDF runners; processors settle the in-flight job before rejecting; uploads abort. |
| F17 | Fixed | Shutdown budget = job timeout + 10 s, workers paused first, PM2 `kill_timeout`. |
| F18 | Fixed | BullMQ forwards Redis DB/TLS; `QUEUE_PREFIX` applied to queues and workers. |
| F19 | Fixed | Dismiss filters the caller/effective user and deletes the owner artifact. |
| F20 | Fixed | Artifact registry row-locked inside one transaction; replaced/cleared/purged blobs deleted. |
| F21 | Fixed | Both schedulers catch lease acquisition and reschedule. |
| F22 | Fixed | `queue.add` timeout reconciles with `queue.getJob` before failing. |
| F23 | Fixed | Snapshot transactions take explicit 10-minute statement/idle budgets. |
| F24 | Fixed | Reset is one transaction (purge + reseed + audit) and requires `{ "confirm": "RESET" }`. |
| F25 | Fixed | Contacts/students infinite queries are page-based; page 2 works. |
| F26 | Fixed | Tenant GET returns only its own checkpoint head; global publish moved to `/api/platform/audit/merkle-roots` (`system`). |
| F27 | Fixed | Search is an OR of indexable predicates; trgm indexes ship out of band (`scripts/sql/0197_search_indexes_concurrent.sql`). |
| F28 | Fixed | Inflight decrement only on the final attempt. |
| F29 | Bounded | XLSX/JSON exports cap at 50k rows with a clear 413 instead of OOM; messaging restore-all is batched (500, SKIP LOCKED). Full streaming XLSX remains a follow-up. |
| F30 | Fixed | PM2 instances default to min(cores, 4) and `PG_POOL_MAX` is derived from `PG_MAX_CONNECTIONS`. |
| F31 | Fixed | `/health` returns bare status off-loopback; detail requires loopback or `METRICS_TOKEN`. |
| F32 | Fixed | GR counter uses `extract(year from registered_on)` + btree index; gr_number has a trgm index. |
| F33 | Fixed | Legacy JSONB collections are read once and chunked in memory. |
| F34 | Fixed | The migrator sets a session `lock_timeout` for every migration. |
| F35 | Fixed | Dedicated `audit` RBAC module: `audit.view` / `audit.manage`; teacher access removed, auditor gets read. |
| F36 | Fixed | Activity-log writes require `audit.manage` and derive actor/IP and a bounded timestamp server-side. |
| F37 | Fixed | Logout revocation TTL = remaining token life. |
| F38 | Fixed | Self-service password change revokes sessions and refresh artifacts. |
| F39 | Fixed | Attachments are `private, no-store`; no root-level attachment writes; avatars require a session. |
| F40 | Fixed | Upload 5xx returns a generic message + request id; cause logged. |
| F41 | Fixed | `dotfiles: "deny"` on both static registrations. |
| F42 | Fixed | Multipart limits: 10 MB file, 1 file, 4 parts, 1 MB field. |
| F43 | Fixed | 5/user + 500/tenant socket caps; `/ws` is rate-limited. |
| F44 | Fixed | Production ignores `X-Forwarded-Host` unless `MMS_TRUST_X_FORWARDED_HOST=true`. |
| F45 | Fixed | 2FA challenge verify/resend require the request tenant. |
| F46 | Fixed | Shared OTP attempt counter used by verify and reset. |

**Known deviations / follow-ups**

- The trgm indexes are created by an operator step after migration (ratchet policy forbids a
  plain index build on hot tables inside a Drizzle migration):
  `pnpm --filter mms-backend tsx src/scripts/create-index-concurrently.ts --file scripts/sql/0197_search_indexes_concurrent.sql`.
- Sixteen snapshot loaders got an explicit `ORDER BY id`; the rest are protected by the
  REPEATABLE READ snapshot plus the duplicate-id abort, not by per-loader ordering.
- XLSX/JSON exports are capped rather than fully streamed.
- Legacy crypto/erasure rows with a NULL workspace stay invisible until an operator cleanup.
- Historical audit state is not retro-encrypted; only new subject-scoped events are.
