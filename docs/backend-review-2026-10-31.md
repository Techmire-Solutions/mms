# MMS Backend Review — 2026-10-31

Independent review of `apps/backend` at commit `cf69f9d17` (`main`, "fix: resolve 2026-10-30 project-review findings P-01–P-06"). The backend, shared-package and docs trees are byte-identical to `1a9b1d942` (`git diff` for those paths is empty), so every finding applies to both commits. The working tree carried five pre-existing modified frontend/script files at review time; this review did not touch them.

**Method.** Baseline gates were run locally. Read-only lane audits covered auth/platform, finance/accounting, worker/queue/realtime, audit/privacy and API/perimeter/tests; the reviewer completed the tenancy/RLS analysis directly (static RLS policy coverage, `withTenant` fail-closed paths, document store, cross-tenant suites). Every P0/P1 below was reproduced against primary source by the reviewer. Prior-review claims (`F1`–`F46`, 2026-10-29; the seven pillars, 2026-10-30) were treated as unproven and re-checked.

**Verdict.** The structural ratchets and unit suites are genuinely green, but the backend is **not** clean. Two P0 ledger-integrity defects re-open the same class that F4/F5 closed, on the sibling `PUT` endpoints. Four P1 controls fail open or go stale (password reset, Redis outage, cross-node RBAC invalidation, unbounded messaging jobs), and three further P1 defects sit in finance arithmetic and the audit trail (payment archive/restore, workspace-restore auditing, batch-billing auditing). The ratchets cannot see any of this because the coverage gate measures a mocked unit suite at ~44% of logic statements.

---

## 1. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend typecheck` | **Pass** (0 errors) |
| `pnpm --filter mms-backend lint` | **Pass** (`--quiet`, 0 errors) |
| `pnpm --filter mms-backend test:coverage` | **320 files / 2,237 tests passed**, 60.18 s |
| Coverage (whole tree, mocked unit suite) | **Stmts 43.06 % · Branch 33.96 % · Funcs 41.41 % · Lines 45.19 %** (floors 42/32/40/44) |
| Coverage, logic only (excl. schema, migrations, `scripts/`) | **44.0 % statements** (13,960 / 31,711) |
| `pnpm --filter mms-backend test:db` (real Postgres) | **46 files / 181 passed, 1 skipped** (14.4 s) |
| `pnpm --filter mms-backend test:rls` | **Not runnable locally** — local role is `postgres` (superuser + BYPASSRLS); CI provisions `mms_app` |
| `check:backend-boundaries` | 0 offenders |
| `check:backend-structure` | 48 / 66 / 17 storage imports and aggregators (at baseline); **use-cases without tests 54 vs baseline 55** |
| `check:db-projections` | 0 bare `.select()` |
| `check:code-norms` | 0 explicit `any`; 0 backend files over 300 LOC |
| `check:migration-indexes` / `migration-hygiene` / `docs` | pass |

Test-depth caveat: the coverage gate runs only the mocked unit suite (`apps/backend/vitest.config.ts`). The 46 real-Postgres suites (181 tests) and the single RLS suite execute in CI but do **not** contribute to the coverage number, so the reported 43 % both overstates mocked-path confidence and understates the DB layer.

---

## 2. Findings summary

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| B-01 | **P0** | Finance | `PUT /api/finance/invoices/:id` can cancel/zero an invoice past the ledger guard (no reversal) |
| B-02 | **P0** | Finance | `PUT /api/finance/payments/:id` rewrites money fields with no journal, `paidAmt`, audit or lock |
| B-03 | **P1** | Auth | Forgot-password reset sets a password but never revokes existing sessions/refresh tokens |
| B-04 | **P1** | Auth | Redis outage makes revocation, suspension and the idle clock fail open per process |
| B-05 | **P1** | Auth/cache | Cross-node cache-invalidation subscriber is never started → stale RBAC for up to 1 h on other PM2 instances |
| B-06 | **P1** | Worker | Messaging-broadcast jobs have no timeout/abort; shutdown budget equals PM2 `kill_timeout` |
| B-07 | **P1** | Finance | Payment archive/restore un-collects by cash amount, not `invoiceAmount`, and without a row lock |
| B-08 | **P1** | Audit | Workspace restore (`POST /api/db/sync`) is audited after commit, best-effort |
| B-09 | **P1** | Audit | Batch invoice generation posts journals but emits zero audit events |
| B-10 | P2 | Auth | Rate-limit bucket keyed on a client-chosen `Host` subdomain → rotation mints fresh buckets |
| B-11 | P2 | Auth | Tenant 2FA challenge is consumed non-atomically and has no attempt counter |
| B-12 | P2 | Platform | `admins` grant can disable/delete peer admins; create/edit require super-user |
| B-13 | P2 | Audit | Audit `REVOKE` hardening is gated on `mms_app_user`; the app role is `mms_app` |
| B-14 | P2 | HTTP | `/uploads/*` outside `tenants/` is `public, max-age=86400` although session-gated |
| B-15 | P2 | Ops | `/ready` is unauthenticated, rate-limit-exempt and pings the DB per request |
| B-16 | P2 | Ops | `/metrics` is open when enabled without a token (no loopback rule, unlike `/health`) |
| B-17 | P2 | CI | `backend_db` path filter omits `src/lib/**` and `middleware/**` → PRs skip DB + RLS |
| B-18 | P2 | Finance | Credit notes have no idempotency key; a retried POST double-credits |
| B-19 | P2 | Accounting | Bank reconciliation stores unchecked ids: no amount comparison, ownership, FK on line, unmatch or audit |
| B-20 | P2 | Finance | Invoice numbering is a racy max-scan; the unique index converts the race into a 500 + rolled-back batch |
| B-21 | P2 | Privacy | Crypto-shredding audit event stores the subject id in cleartext, outside subject-state encryption |
| B-22 | P2 | Assurance | 44 % logic coverage, 54 untested use-cases, DB/RLS paths invisible to the gate |
| B-23 | P3 | Audit | Verification can return `VERIFIED` with `anchored: false` for a detached partition |
| B-24 | P3 | Jobs | Any tenant user can read another user's job status by id (`_userId` ignored) |
| B-25 | P3 | Jobs | `DELETE /api/background-jobs/:id` never cancels/removes the BullMQ job |
| B-26 | P3 | Jobs | `task.assigned` / `task.status_changed` outbox events are discarded by the CDC processor |
| B-27 | P3 | Jobs | Boot-only stale-`pending` reaper marks queued jobs failed without checking queue state |
| B-28 | P3 | Auth | `isTimestampRevoked` mis-detects millisecond precision on second-aligned `iat_ms` |
| B-29 | P3 | Audit | Forgot-password activity log hardcodes `ip: "127.0.0.1"` (F36 gap) |
| B-30 | P3 | Auth | Login-email confirm issues a session from a challenge not bound to caller/tenant |
| B-31 | P3 | HTTP | Client `x-request-id` / `traceparent` trusted verbatim as log ids and audit correlation |
| B-32 | P3 | API | Raw Zod issue JSON returned as `message`; three different 400 shapes |
| B-33 | P3 | Debt | 10-30 roadmap P1 not applied: baseline 55 while 54 measured |
| B-34 | P3 | Docs | `open-items.md` coverage thresholds contradict `vitest.config.ts` |
| B-35 | P3 | Tests | No route-level authentication matrix; module ratchet proves only that a guard is attached |
| B-36 | P3 | Storage | Aborted local exports leave partial blobs (no unlink, no orphan reconciler) |

---

## 3. Critical findings (P0)

### B-01 — `PUT /api/finance/invoices/:id` writes `status` and `creditedAmt` past every ledger guard

**Evidence.** The ledger guard covers only four amount fields:

```ts
// apps/backend/src/finance/financeInvoiceMutationOperations.ts:20-25
const LEDGER_SENSITIVE_INVOICE_AMOUNTS = ["finalAmt","discountAmt","lateFeeAmt","paidAmt"] as const;
```

and `updateInvoiceById` merges the whole parsed body after that check:

```ts
// financeInvoiceMutationOperations.ts:191-198
await assertInvoiceAmountsEditable(tenant, id, rest);
const before = await repo.findInvoiceById(tenant, id, { forUpdate: true });
const updated = await invoiceCrud.updateById(id, { ...rest, ... });
```

`invoiceRecordUpdateSchema` is `invoiceRecordInsertSchema.partial().strict()`, which includes `status` (enum) and `creditedAmt` ([financeInvoiceTypes.ts:80](../packages/shared/src/finance/financeInvoiceTypes.ts#L80)). The route calls this use-case directly after a `canWriteCollection(user, FINANCE_COLLECTION)` check ([financeContractRouter.ts:121-151](../apps/backend/src/routes/tenant/finance/financeContractRouter.ts#L121-L151)), and the generic service persists both fields ([financeInvoicesPersist.ts:29](../apps/backend/src/db/repositories/financeInvoicesPersist.ts#L29), [:40](../apps/backend/src/db/repositories/financeInvoicesPersist.ts#L40)).

The sibling bulk writer deliberately refuses exactly these writes:

```ts
// finance/use-cases/financeMutationOperations.ts:57-66
if (LEDGER_AFFECTING_INVOICE_STATUSES.has(status)) {
  throw ... "Cancel invoices through the cancel-invoice action so the ledger reversal is posted"
}
```

**Impact.** With finance write permission, `PUT {"status":"cancelled"}` marks a posted invoice cancelled with no `tryPostInvoiceReversalJournal` and no late-fee reversal — the receivable and income stay on the ledger while `getOutstandingAmountForInvoice` returns 0 for cancelled/paid ([financeInvoiceAmounts.ts:28-36](../packages/shared/src/finance/financeInvoiceAmounts.ts#L28-L36)), so the subledger and UI stop counting it. `PUT {"status":"paid"}` clears the outstanding balance the same way with no cash posting. `PUT {"creditedAmt":500}` reduces AR with no credit note and no journal. F4 fixed `POST` insert-only; this is the same defect through the sibling verb.

**Fix.** Treat `status` transitions to `cancelled`/`paid` and any `creditedAmt` change as ledger-sensitive: reject them when a `("invoice", id)` posting exists and route callers to the cancel / payment / credit-note actions. Keep an internal-only escape hatch for `cancelInvoice` and `createCreditNote`, which already pass `{ audit: false }`, so the guard must key on the caller path (or move the guard to the route) rather than blocking all updates.

**Regression test.** Extend `financeLedgerSyncGuards.test.ts`: on a posted invoice, `updateInvoiceById(id, { status: "cancelled" })` rejects with the cancel-action message and `saveInvoice` is not called; same for `{ creditedAmt: n }`. Internal cancel/credit flows still succeed.

---

### B-02 — `PUT /api/finance/payments/:id` rewrites money fields without journal, `paidAmt`, audit or lock

**Evidence.**

```ts
// finance/use-cases/financeUseCases.ts:149-163
updatePaymentById: async (id, record) => {
  const { allocations: rawAllocations, ...rest } = record;
  return paymentCrud.updateById(id, { ...rest, ...(allocations ? { allocations } : {}) });
},
```

`paymentRecordUpdateSchema = paymentRecordInsertSchema.partial().strict()` accepts `amount`, `invoiceId`, `date`, `currency`, `exchangeRate` and `allocations` ([financePaymentTypes.ts:54](../packages/shared/src/finance/financePaymentTypes.ts#L54)). The route ([financePaymentHandlers.ts:120-136](../apps/backend/src/routes/tenant/finance/financePaymentHandlers.ts#L120-L136)) gates only on `canWriteCollection(user, PAYMENT_COLLECTION)` and calls this use-case. The create path, by contrast, locks the invoice, updates `paidAmt`, posts the journal and writes the audit row in one transaction ([financeMutationOperations.ts:103-148](../apps/backend/src/finance/use-cases/financeMutationOperations.ts#L103-L148)). `updatePaymentById` has no unit test (only `vi.fn()` stubs elsewhere).

**Impact.** A posted payment can be changed from 100 to 1000 with the journal and `invoice.paidAmt` still on 100; a later archive subtracts the *new* amount and clamps at zero, silently losing collection state. Changing `invoiceId` moves cash between invoices with no reversal. Concurrent edits race `createPayment` because the update path takes no `FOR UPDATE` lock.

**Fix.** Once a `("payment", id)` posting exists, reject edits to `amount`, `invoiceId`, `date`, `currency`, `exchangeRate` and `allocations`; channel corrections through archive + re-enter, or a reversal + repost under the invoice row lock. Emit `recordPaymentAudit("UPDATE", …, oldState)` in every case.

**Regression test.** New `financePaymentUpdateGuards.test.ts`: posted payment + `PUT { amount: 999 }` → 422 and `savePayment` untouched; replay of the same body → no second audit row.

---

## 4. High findings (P1)

### B-03 — Forgot-password reset sets the password but keeps every existing session alive

**Evidence.** `resetTenantPassword` validates the OTP, sets the hash and signs the caller in, with no revocation call anywhere in the file:

```ts
// services/auth/tenantPasswordOtpService.ts:213-216
await recordPasswordSetActivity(entry.payload.workspaceSubdomain, entry.payload.userId);
await broadcastCollection("users");
return establishSession(user, input.jwtSigner, input.reply, true);
```

The self-service change path does revoke ([authProfileRoutes.ts:94-96](../apps/backend/src/routes/common/auth/authProfileRoutes.ts#L94-L96)), as do the admin reset and the platform reset. F38 was applied to three of the four password-write paths.

**Impact.** The recovery path for a compromised account does not evict the attacker: pre-reset access JWTs stay valid to `exp`, and stolen refresh artifacts keep rotating for up to 7 days. This is the single most important session-security gap in the backend.

**Fix.** After `activated`, call `deleteRefreshTokensForUser(userId)` and `revokeAllUserSessions(userId)` before `establishSession` (mirror the profile route), and assert `user.workspaceSubdomain === entry.payload.workspaceSubdomain` as `twoFactorService.ts` does.

**Regression test.** In `tenantPasswordOtp.integration.test.ts`: sign in twice, reset via OTP, assert the pre-reset refresh cookie gets 401 at `/api/auth/refresh` and the pre-reset access JWT 401 at `/api/auth/me`.

---

### B-04 — Redis outage makes revocation, suspension and the session clock fail open, per process

**Evidence.** Every auth-critical Redis read/write silently degrades to a per-process map:

```ts
// lib/redisCacheOperations.ts:4-5
const inMemoryStore = new Map<string, { value: string; expiresAt?: number }>();
// :213-237 — redisBatch falls back to inMemoryBatchOp when Redis is down or a pipeline errors
```

`checkIsRedisConnected()` goes false on every `close`/`error` event, so a reconnect blip is enough. `revokeToken`, `revokeAllUserSessions` and `blockTenant` write through `redisSet`/`redisDel`; `checkTenantAuthPipelineBatch` ([services/authSessionService.ts:173-215](../apps/backend/src/services/authSessionService.ts#L173-L215)) reads tenant-blocked, jti-revoked and user-revoked through `redisBatch`; the idle clock reads/writes the same store. `isSessionIdleExpired` returns `false` when no record exists.

**Impact.** Production runs PM2 cluster mode with up to four instances (`instances: apiInstances`, `exec_mode: "cluster"`, [ecosystem.config.cjs:38-54](../ecosystem.config.cjs#L38-L54)). A logout/disable/password-change written by instance A is invisible to B–D while Redis is down; after a restart the fallback is empty. Revoked tokens therefore keep working to `exp`, a suspended workspace can stay usable, and idle/absolute expiry silently stops. The refresh-artifact deletion is the only DB-backed backstop.

**Fix.** Add strict variants (`redisGetStrict`/`redisExistsStrict`) that throw instead of falling back, use them for `authSessionService` and `sessionClockService`, and map a strict-call failure to 401/503 in `authenticateTenant`/`authenticatePlatform` (the deny-on-error pattern already exists at `authenticate.ts:147-155`). Keep the in-memory fallback only for non-security caches.

**Regression test.** `sessionRevocation.test.ts`: stub `checkIsRedisConnected() → false`; after `revokeAllUserSessions`, either the request is denied or the revocation is honoured — never a silent pass.

---

### B-05 — Cross-node cache invalidation is never started, so RBAC/role changes go stale for up to an hour

**Evidence.** The subscriber is initialized as an import side effect in `lib/cacheManager.ts:145-147` — a module imported only by `src/__tests__/cacheManager.test.ts` (`grep -rn cacheManager apps/backend/src` excluding tests: no hits). Production code imports the barrel `lib/cache/index.ts`, which re-exports the functions but never calls `initCacheInvalidationSubscriber()`:

```ts
// lib/cacheManager.ts:145-147 (dead in production)
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  initCacheInvalidationSubscriber();
}
```

`invalidateMultiTierCache` evicts local L1, deletes L2 and publishes to `mms:cache-invalidation` — a channel with no subscriber ([cacheInvalidation.ts:62-95](../apps/backend/src/lib/cache/cacheInvalidation.ts#L62-L95)). The RBAC matrix is cached for 3600 s ([rbacService.ts:15-32](../apps/backend/src/services/rbacService.ts#L15-L32)), and `authenticateTenant` overwrites the JWT role from it on every request ([authenticate.ts:124-137](../apps/backend/src/middleware/authenticate.ts#L124-L137)).

**Impact.** On a four-instance deployment, a role change or user soft-delete performed through instance A updates A's L1 immediately; B–D keep the stale matrix for up to 60 minutes. A demoted admin retains admin on the other instances, and a deleted user keeps a valid session there until the matrix entry expires. The file's own comment — "Guarantees zero stale cache entries across multi-instance deployments" — is false.

**Fix.** Initialize the subscriber from a module that is actually imported (`lib/cache/index.ts` or `lib/redis.ts`) and assert the subscription at boot (fail startup if Redis is configured but the subscription cannot be established). Optionally shorten the RBAC L1 TTL or revalidate L1 against L2 every 30–60 s.

**Regression test.** Two processes on one Redis: warm B's L1, invalidate on A, assert B re-reads. Plus a wiring test that importing the production cache entry initializes the subscriber.

---

### B-06 — Messaging-broadcast jobs are unbounded, and the shutdown budget equals PM2's kill timeout

**Evidence.** Only the PDF and bulk-export queues get sandboxed processors with an abort controller and `JOB_EXECUTION_TIMEOUT_MS`. `messaging-broadcast` takes the generic branch ([worker/index.ts:82-95](../apps/backend/src/worker/index.ts#L82-L95)), which calls `executeJob(...)` without its optional 7th `signal` argument ([worker/processors/jobProcessor.ts:59](../apps/backend/src/worker/processors/jobProcessor.ts#L59)). The runner's `ctx.signal?.aborted` checks in `messagingCampaignJobRunner.ts` are therefore unreachable. Shutdown computes:

```ts
// worker/index.ts:181-186
const shutdownBudgetMs = JOB_EXECUTION_TIMEOUT_MS + 10_000;   // 70_000
```

while `worker.pause()` with no argument awaits `whenCurrentJobsFinished()` (BullMQ 6.3.16 `worker.js:691-695`), and PM2's `kill_timeout` is also `70000` ([ecosystem.config.cjs:58](../ecosystem.config.cjs#L58)).

**Impact.** A campaign is `recipients × (gateway latency + 50 ms throttle)`; 5,000 recipients can take ~15 minutes. Every deploy's 70 s budget truncates it mid-send, leaves a `running` row that only BullMQ's stall recovery may reclaim, and the PM2 SIGKILL can race the app's own `process.exit(1)` with zero margin — skipping `closeAllQueues()`/`disconnectRedis()`/`closeDatabase()`. No operator can cancel a campaign.

**Fix.** Pass an `AbortController` into the generic worker path and install a per-kind wall clock in `executeJob` when no signal is supplied (especially `messaging:dispatch`), or route messaging through a sandboxed processor. Raise the shutdown budget to cover the largest job class plus a margin, and set PM2 `kill_timeout` above the app budget.

**Regression test.** Force shutdown during a 200-recipient fake-channel campaign: no sends after `pause()`, the row settles exactly once, and the process exits 0 within the budget.

---

### B-07 — Payment archive/restore un-collects by cash amount, not the invoice-currency amount

**Evidence.**

```ts
// finance/use-cases/financeRecordLifecycle.ts:71
(deltaByInvoice.get(payment.invoiceId) ?? 0) + payment.amount * direction,
```

`createPayment` applies `invoiceAmount ?? amount` to `paidAmt` ([financeMutationOperations.ts:129](../apps/backend/src/finance/use-cases/financeMutationOperations.ts#L129)) and `resolvePaymentFx` always sets `invoiceAmount` for cross-currency settlement. Archive/restore then loads invoices via `findInvoicesByIds` with no `forUpdate` option ([financeRepository.ts:38-42](../apps/backend/src/finance/repository/financeRepository.ts#L38-L42)).

**Impact.** Invoice 1,000 USD settled by 280,000 PKR stores `paidAmt = 1000`. Archiving subtracts 280,000, `applyCollectedDelta` clamps to 0 and flips the invoice to `pending`; restoring adds 280,000, flips it to `paid` and zeroes the outstanding balance — on an unsettled invoice. The unlocked read-modify-write can also lose a concurrent payment.

**Fix.** Use `payment.invoiceAmount ?? payment.amount`; add `{ forUpdate: true }` to `findInvoicesByIds` and take it inside the archive/restore transaction before computing deltas.

**Regression test.** `financeRecordLifecycle.test.ts` with `{ amount: 280000, invoiceAmount: 1000 }`: archive leaves `paidAmt` 0, restore returns it to exactly 1000; plus a real-DB concurrent-archive test.

---

### B-08 — Workspace restore is audited after commit, best-effort

**Evidence.**

```ts
// routes/common/db/dbSyncRoutes.ts:158-172
await withSyncTimeout((signal) => synchronizeData(payload, signal, true));
await recordAuditEventSafely({
  workspaceSubdomain: getRequestTenant() ?? "unknown",
  tableName: "sync", actionType: "RESTORE", ...
});
```

`recordAuditEventSafely` catches and only logs ([auditTrailService.ts:289-296](../apps/backend/src/services/auditTrailService.ts#L289-L296)). The restore has already committed by then.

**Impact.** F1 claimed audit writes share the mutation transaction. At the most destructive tenant operation — a whole-workspace restore — an audit failure or process death leaves no audit row, and the restore cannot be rolled back by the audit. `"unknown"` as a fallback tenant is itself wrong: a lost tenant context should fail the operation, not label the event.

**Fix.** Wrap sync and `recordModernAuditEvent(tx, …)` in one `withTenant`; use the throwing variant and drop the `?? "unknown"` fallback.

**Regression test.** Force the audit append to fail and assert the restore rolls back (no snapshot applied).

---

### B-09 — Batch invoice generation posts journals but emits no audit events

**Evidence.**

```ts
// finance/use-cases/financeInvoiceGenerationUseCases.ts:57-77
if (drafts.length === 1) return [await financeUseCases.createInvoice(...)]; // audits at :161
...
await bulkSaveInvoices(tenant, invoices);
await tryPostInvoiceJournals(tenant, invoices);
```

`bulkSaveInvoices` is an insert/upsert only ([financeInvoicesPersist.ts:60](../apps/backend/src/db/repositories/financeInvoicesPersist.ts#L60)); `recordInvoiceAudit` is called only by `createInvoice`, `updateInvoiceById`, `cancelInvoice` and credit notes.

**Impact.** Generating a term's invoices (`POST /api/finance/invoices/generate`, ≥2 drafts) puts N invoices and N journal entries on the books with zero audit rows, while the single-invoice path audits. F11 ("finance/accounting mutations are audited") is only partly true. Late-fee application and bulk status changes are similarly silent.

**Fix.** Map `recordInvoiceAudit(tenant, "CREATE", invoice)` over the batch inside the existing `withTenant` in `persistGeneratedInvoices`; add the same for late fees and `bulkUpdateInvoicesStatus`.

**Regression test.** `financeInvoiceGenerationUseCases.test.ts`: 3 drafts → 3 CREATE audit events; bulk status → one event per invoice.

---

## 5. Medium findings (P2)

### B-10 — Rate-limit buckets key on a client-chosen `Host` subdomain

`generateCompositeRateLimitKey` uses the ALS tenant, bound from `Host` in `requestHooks.ts:11-16`, and any `*.MMS_APP_DOMAIN` host parses as a tenant with no workspace-existence check (`tenantSubdomainUtils.ts:81-88`). `Host: t9999.<appDomain>` therefore mints a fresh bucket per request, contradicting the comment that the tenant "can no longer be fabricated" ([rateLimitConfig.ts:27-38](../apps/backend/src/lib/rateLimitConfig.ts#L27-L38)). This defeats the 10/min auth ceiling and the 5/10 min public-registration ceiling. It is amplified because `validateCredentials` falls back to a tenant-agnostic `findActivePlatformSuperUser()` ([userServiceAuth.ts:136-153](../apps/backend/src/services/auth/userServiceAuth.ts#L136-L153)), so the platform super-user password can be probed across every publicly listed workspace with a fresh bucket each time.
**Fix:** IP-only key for unauthenticated buckets, or resolve the workspace and 404 unknown subdomains before the limiter; keep the tenant dimension only for authenticated requests. **Test:** 11 logins on `Host: a` then 11 on `Host: b` → second batch 429.

### B-11 — Tenant 2FA challenge is consumed non-atomically and has no attempt counter

`takeAuthArtifact` does SELECT then unconditional DELETE rather than `DELETE … RETURNING` ([authArtifactService.ts:111-135](../apps/backend/src/services/auth/authArtifactService.ts#L111-L135)), and `TwoFactorChallengePayload` has no `attempts` field ([twoFactorService.ts:107-113](../apps/backend/src/services/auth/twoFactorService.ts#L107-L113)) — unlike the platform 2FA and tenant-password OTP payloads. Concurrent verifies all read the same challenge before any delete lands, so a 6-digit code can be attacked with parallel guesses inside one challenge, bounded only by the 10/min bucket. **Fix:** claim the artifact atomically (`DELETE … RETURNING payload`), re-insert with `attempts + 1` below a max, mirroring the platform flow. **Test:** 10 concurrent wrong codes against one challenge → ≤1 accepted and the artifact is gone.

### B-12 — Platform `admins` grant can disable or delete peer admins

`createAdmin` and `updateAdminPermissions` require `requirePlatformSuperUser()`; `setAdminDisabled` and `deleteAdmin` carry only `requirePlatformPermission("admins")` ([platformUsers.ts:29-66](../apps/backend/src/routes/platform/platformUsers.ts#L29-L66)). Handlers check only self-targeting plus password re-auth; services protect `super_user` but nothing protects an admin holding `system` ([platformUserServiceAdmin.ts:100-125](../apps/backend/src/services/platform/platformUserServiceAdmin.ts#L100-L125)). A delegated `admins` grant can therefore disable/delete the only operator with DB-reset or migrate-and-restart rights — exactly what `requirePlatformSuperUser`'s comment says must not happen. **Fix:** add the super-user check to both routes, or compare actor permissions against the target's. **Test:** admin with `{ admins: true }` → `PATCH /api/platform/users/<system-admin>/disabled` is 403.

### B-13 — Audit immutability hardening never runs: role name mismatch

`0102_modern_audit_trail.sql` REVOKEs `UPDATE/DELETE/TRUNCATE` on the audit tables only `IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mms_app_user')` ([0102_modern_audit_trail.sql:95-99](../apps/backend/src/db/migrations_drizzle/0102_modern_audit_trail.sql#L95-L99)). The documented and provisioned role is `mms_app` (`provisionRlsRole.ts:25`, `docs/rls-operations.md`), so the block is inert on every real deployment. The verification anchor and the Merkle root are stored in the same database ([auditVerificationService.ts:66-76](../apps/backend/src/services/auditVerificationService.ts#L66-L76), `lib/auditCheckpoint.ts:92-100`), so an actor with application DB credentials can rewrite events, insert a matching verification run and republish the root, and the next verification returns VERIFIED. **Fix:** align the role name (or drop the role check for a table-level `REVOKE` in provisioning), and sign checkpoints with a key outside the database, rejecting unsigned anchors. **Test:** as `mms_app`, `UPDATE audit_trail_events` must fail; a forged anchor must not verify.

### B-14 — Session-gated uploads are served with a public cache header

`setStaticAssetHeaders` applies `private, no-store` only to `/uploads/tenants/…`; the default for other uploads is `public, max-age=86400` ([staticAssets.ts:78-88](../apps/backend/src/plugins/staticAssets.ts#L78-L88)). `authorizeUpload` requires a session for everything except `branding` ([staticAssets.ts:141-159](../apps/backend/src/plugins/staticAssets.ts#L141-L159)), so the auth gate and the cache policy disagree. The permissive policy is pinned by `serverConfig.test.ts:266` (`/uploads/avatars/…` → public), contradicting `uploadsAuth.test.ts:47-54` (avatars require a session). Legacy root-level avatars are the realistic exposure: a shared Apache/CDN cache can re-serve them to unauthenticated callers for 24 h. **Fix:** default `/uploads/**` to `private, no-store` + `Vary: Authorization`; keep `public` only for `branding` and hashed assets. **Test:** table-driven assertion that every non-`branding` upload path is private.

### B-15 — `/ready` is an unauthenticated DB amplifier

`GET /ready` performs `await pingDatabase()` per request ([health.ts:104](../apps/backend/src/routes/common/health.ts#L104)) → one pooled checkout, is registered without auth, and is exempt from the global limiter ([security.ts:118-122](../apps/backend/src/plugins/security.ts#L118-L122)). At pool-size concurrency it can starve real traffic and force the LB to pull the instance. **Fix:** memoise readiness for 1–2 s (single in-flight promise) and keep the public answer static; reserve the DB probe for loopback/token. **Test:** 200 concurrent `/ready` → exactly one `pingDatabase` call.

### B-16 — `/metrics` fails open when enabled without a token

`isMetricsRequestAuthorized` returns `true` when `METRICS_TOKEN` is unset ([metricsPlugin.ts:137-141](../apps/backend/src/plugins/metricsPlugin.ts#L137-L141)), and the route has no loopback check unlike `/health` ([metrics.ts:18-28](../apps/backend/src/routes/common/metrics.ts#L18-L28)). `METRICS_ENABLED=true` without a token publishes pool/Redis/memory and the route-label inventory (admin/platform paths) to the internet, unthrottled. **Fix:** mirror `isDetailedHealthAuthorized` (loopback-or-token, fail closed). **Test:** non-loopback scrape with `METRICS_ENABLED=true` and no token → 401/404.

### B-17 — CI DB/RLS path filter omits `src/lib/**` and `middleware/**`

The `backend_db` filter covers `src/db/**`, `**/repository/**`, `**/ledgerPosting/**`, `**/use-cases/**`, `services/**`, `accounting/**`, test configs and `packages/shared/**` ([ci.yml:45-60](../.github/workflows/ci.yml#L45-L60)), but not `src/lib/**` — which contains real Drizzle SQL (`lib/auditCheckpoint.ts:76,92`, `lib/subjectKeyService.ts:34,78`). `test-backend-db` and `test-backend-rls` run on a PR only when that filter matches ([ci.yml:671-676](../.github/workflows/ci.yml#L671-L676), [:749-752](../.github/workflows/ci.yml#L749-L752)); the gate policy legitimises the skip (`scripts/ci/ci-gate-policy.mjs:49-57`). A PR touching audit-checkpoint or crypto-shredding SQL can merge with zero real-Postgres and zero RLS coverage; main-branch CI runs them after merge. **Fix:** add `apps/backend/src/lib/**` (ideally any `apps/backend/**` change) to `backend_db`. **Test:** a paths-filter table test asserting `lib/auditCheckpoint.ts` matches.

### B-18 — Credit notes have no idempotency key

`createCreditNote` generates `id: cn-${randomUUID()}` on every call ([financeCollectUseCases.ts:198-213](../apps/backend/src/finance/use-cases/financeCollectUseCases.ts#L198-L213)); `creditNoteInsertSchema` accepts only `invoiceId`, `amount`, `reason` ([financeCollect.ts:183-189](../packages/shared/src/finance/financeCollect.ts#L183-L189)), and journal idempotency is keyed on the credit-note id. A timeout + retry (or double-click) after commit creates a second note, doubles `creditedAmt` and posts a second reversal journal. **Fix:** accept a caller idempotency key/id, return the stored note on replay, and add a partial unique index. **Test:** same body + key twice → one row, one journal.

### B-19 — Bank reconciliation stores unchecked ids

`matchBankReconciliation` inserts caller-supplied `statementLineId`/`journalEntryId`/`journalLineId` with no amount comparison, no ownership check on the journal line, no FK on `journal_line_id`, no unmatch endpoint and no audit ([accountingLedgerOpsRepository.ts:265-290](../apps/backend/src/db/repositories/accountingLedgerOpsRepository.ts#L265-L290); schema [accountingLedgerOps.ts:114-120](../packages/shared/src/finance/accountingLedgerOps.ts#L114-L120)). A "reconciled" flag therefore cannot detect an amount difference, and any write-permitted user can pin a statement line to a line of another entry or a non-cash account. **Fix:** resolve the line by `(entry_id, account_id)`, require the statement's bank account, compare amounts (store `matched_amount`), add unmatch + audit. **Test:** mismatched amount → 422; unmatch releases the line.

### B-20 — Invoice numbering is a racy max-scan

`allocateNextInvoiceNumber` reads the max number then inserts with no lock ([financeBillingNumbering.ts:17-32](../apps/backend/src/db/repositories/financeBillingNumbering.ts#L17-L32)); the unique index turns the race into a 23505 and a generic 500, and `allocateInvoiceNumberBatch` derives N numbers from one read, so concurrent generate runs overlap ([financeBillingNumbering.ts:41-50](../apps/backend/src/db/repositories/financeBillingNumbering.ts#L41-L50)). Accounting's voucher numbering next door already uses an atomic counter. **Fix:** mirror the voucher counter, or retry once on 23505 by reallocating. **Test:** two parallel allocations in a real-DB test return distinct numbers.

### B-21 — Crypto-shredding leaves the subject id in cleartext in the audit payload

`executeSubjectErasure` records `oldState: { subjectId, status: "ACTIVE" }` / `newState: { subjectId, status: "SHREDDED" }` without passing the top-level `subjectId`, so `appendAuditEvent`'s subject-state encryption never runs ([cryptoShreddingService.ts:106-114](../apps/backend/src/services/cryptoShreddingService.ts#L106-L114); encryption gate at [auditTrailService.ts:151-165](../apps/backend/src/services/auditTrailService.ts#L151-L165)). The identifier survives the shred and is readable by anyone who can read the audit trail. **Fix:** pass `subjectId` so the state is encrypted, and keep only a pseudonymous record id. **Test:** erasure event's stored state is unreadable without the key.

### B-22 — Coverage and test-depth assurance

44.0 % of logic statements executed (13,960/31,711); 54 use-case files have no companion test (baseline 55), including `admissionsApprove`, `enrollmentBulkEnroll`, `enrollmentsUseCases`, `registrationPublicUseCases`, `consolidationUseCases` and `sessionRolloverJob`. Subsystem statements (logic files): `workshops` 9.1 %, `platform` 15.7 %, `sessions` 26.1 %, `notifications` 26.7 %, `enrollments` 28.8 %, `worker` 48.5 %. The coverage gate instruments only the mocked unit run, so the 46 real-Postgres suites and the RLS suite are invisible to it; the 375-file `db` layer reads 18 % for the same reason (its behaviour lives in the DB suite, which the coverage report never sees). The ratchets are real but they check shape (projections, imports, LOC), not behaviour. **Fix:** fold `test:db` coverage into the merged report, raise the floors after the P0/P1 tests land, and require a companion test for new use-cases. **Test:** the gate itself — after the P0 fixes, coverage should move without excluding files.

---

## 6. Low findings and hygiene (P3)

| ID | Finding | Evidence |
| --- | --- | --- |
| B-23 | Verification can report `VERIFIED` with `anchored: false` when the anchor row is gone (detached partition), so a status-only consumer sees green | `auditVerificationService.ts:112-117, 255-280` |
| B-24 | `getUserBackgroundJob(_userId, …)` ignores the caller: any tenant user who knows a job id can read its status/label/error | `backgroundJobService.ts:181-213`, route `backgroundJobs.ts:47` |
| B-25 | `DELETE /api/background-jobs/:id` deletes the row/artifact but never removes or aborts the BullMQ job; it keeps running and retries, and messaging can send ~5 messages per attempt | `routes/common/backgroundJobs.ts:121-125`; no `queue.remove` anywhere |
| B-26 | `task.assigned` / `task.status_changed` outbox events have no consumer; the CDC `else` branch evicts cache and marks them processed | `outboxCdcProcessor.ts:112-121`; producers `taskNotificationService.ts:39-62` |
| B-27 | Boot-only reaper fails `pending` rows older than 10 min without checking BullMQ state; queued jobs awaiting a backlog are mislabelled | `workerOrphanCleanup.ts:7,43-56` |
| B-28 | `isTimestampRevoked` infers precision from `% 1000`, so an `iat_ms` that lands on an exact second drops same-second revocations | `authSessionService.ts:66-75` |
| B-29 | Forgot-password activity log hardcodes `ip: "127.0.0.1"`, so F36's server-derived IP does not hold on this path | `tenantPasswordOtpService.ts:88-98` |
| B-30 | `login-email/confirm` issues a session from a challenge not bound to the caller or tenant (needs id + code to exploit) | `tenantLoginEmailService.ts:117-126`; route `authProfileRoutes.ts:155-160` |
| B-31 | Client `x-request-id` (unbounded) and unvalidated `traceparent` are echoed in 5xx bodies and persisted as audit correlation ids | `app.ts:26-30`, `errorHandler.ts:47-49`, `authenticate.ts:244-249` |
| B-32 | Raw Zod issue JSON is returned as `message` at 153 call sites; three different 400 shapes across plain/ts-rest/Fastify validation | `zodRequest.ts:8-11`, `contractRegistration.ts:18-26`, `errorHandler.ts:11-16` |
| B-33 | 10-30 roadmap P1 not applied: `check:backend-structure` measures 54 untested use-cases but the baseline is still 55 | `scripts/check-backend-structure.mjs:29` |
| B-34 | `open-items.md` records thresholds 43.5/33/41/46; `vitest.config.ts` enforces 42/32/40/44 | `docs/open-items.md:17-21`, `apps/backend/vitest.config.ts:57-64` |
| B-35 | No runtime authentication matrix: the route ratchet asserts `moduleAccessGuard` presence, never anonymous→401 or wrong-role→403; deny tests often `vi.mock` the real middleware away | `moduleAccessCoverage.test.ts:335-354` |
| B-36 | Aborted local-storage exports leave partial blobs (no unlink, no orphan reconciler); tenant export keys embed `Date.now()` | `config/storage.ts:101-119`, `:44-47` |

---

## 7. Prior-review re-verification

| Claim | Verdict |
| --- | --- |
| F3 — batch generation posts journals in one transaction | **Held** (`financeInvoiceGenerationUseCases.ts:66-77`) — but no audit (B-09) |
| F4 — invoice POST is insert-only | **Held on POST**, re-opened on PUT (B-01) |
| F5 — payment settlement atomic (lock + allocation + journal) | **Held on POST** (`financeMutationOperations.ts:103-148`), bypassed on PUT (B-02) |
| F7 — credit/cancel serialised | **Held** (invoice row `FOR UPDATE`); credit-note retry not idempotent (B-18) |
| F11 — finance/accounting mutations audited | **Partial** — batch generation, payment edits, late fees and bulk status are silent (B-09) |
| F13 — fiscal-year close lock | **Implemented coherently**; only a mocked call-order test exists |
| F14/F28 — job id namespacing, fair-share decrement | **Held** (verified against BullMQ 6.3.16) |
| F17 — worker shutdown budget | **Partial** — budget calibrated to sandboxed jobs, messaging unbounded; budget == PM2 kill timeout (B-06) |
| F22 — queue-add reconcile | **Held** (`queues/index.ts:26-44`) |
| F26 — Merkle roots tenant-scoped | **Held** (`/api/audit/merkle-roots` returns only the caller's head) |
| F35/F36 — audit permissions, server-derived activity log | **Held** except the hardcoded reset IP (B-29) |
| F37/F38 — logout TTL, password-change revocation | **F37 held; F38 partial** — forgot-password reset does not revoke (B-03) |
| F45/F46 — 2FA/OTP tenant binding and shared attempts | **Held**; tenant 2FA challenge still lacks an attempt counter (B-11) |
| 10-30 seven pillars | Structurally accurate, but "verified resilient" did not cover the PUT endpoints, the dead cache subscriber, or the messaging job boundary |

**2026-10-30 roadmap status.** P1 (ratchet baselines down) — **not applied** (B-33). P2 (naive timestamps) — still tracked, 144 columns. P3 (ports extraction) — unchanged at 48 use-case storage imports. P4 (route aggregators) — unchanged at 17.

---

## 8. Adversarial loophole audit

1. **Edge cases.** Decimal money is cent-normalised at posting, but `PUT` invoice/payment accept raw `number` mutations that bypass every ledger rule (B-01/B-02). Archived records are filtered on reads; the payment archive path corrupts `paidAmt` on cross-currency rows (B-07). Page limits are coerced and capped (`apiSchemas.ts:9-10`), and sort fields are allowlisted — no SQL injection found. Upload traversal is rejected and dotfiles denied.
2. **Failure modes.** Redis down: revocation/suspension/idle clock fail open (B-04). DB down: `/ready` returns 503 after a pool checkout (B-15). Process death during restore: no audit row (B-08). Shutdown: messaging job outlives the budget and races PM2 SIGKILL (B-06). Cache invalidation: silently dead across nodes (B-05). Export abort: partial blob remains (B-36).
3. **Security and multi-tenancy.** RLS coverage is complete statically (213/213 tenant tables carry `ENABLE`/`FORCE ROW LEVEL SECURITY` and the shared policy; `custom_tabs` and the finance/accounting child tables included via migration `0001`/`0093` DO blocks). `withTenant` fails closed; the only `allowGlobal` sites are the document store behind `inGlobalDocumentStoreScope()` (boot/restore) and the explicit global transaction helpers. Cross-tenant DB tests pass. Remaining vectors are intra-tenant: platform `admins` vs peer admins (B-12), job-status reads (B-24), rate-limit Host rotation (B-10), 2FA parallel guesses (B-11), and audit-table mutability by the app role (B-13).
4. **Concurrency.** Payment create locks the invoice; archive/restore does not (B-07). Fiscal close takes an advisory lock on every posting path. Audit append takes a per-shard advisory lock before reading the head, with monotonic clamping; a `tx` overload handed a root client would release it per statement (latent, no current call site). Invoice numbering is a read-max-then-insert race (B-20). Background-job dismissal does not cancel the running job (B-25).

---

## 9. What this review could not verify

- **RLS under the production role.** The local database uses `postgres` (superuser + BYPASSRLS); `test:rls` was not run. CI provisions `mms_app` and runs it; the findings above therefore rely on static policy coverage plus the existing `crossTenantIsolation`/`rlsEnforcement` suites, not a fresh local run.
- **Apache/CDN caching behaviour.** B-14's exploitability depends on whether the deployment enables `mod_cache` or a CDN; the committed Apache templates do not enable it, so the finding is a header-contract defect with a plausible shared-cache path, not a proven remote read.
- **PM2 cluster runtime.** B-05/B-06/B-04 are reasoned from the committed `ecosystem.config.cjs` (cluster, ≤4 instances) and BullMQ 6.3.16 source; no multi-process run was performed.
- **Redis outage drill.** B-04 was proven by code path, not by stopping Redis under load.
- **Production env flags.** B-16 depends on `METRICS_ENABLED`; B-10 depends on `MMS_APP_DOMAIN` and a wildcard subdomain vhost.
- **Concurrency harness.** Payments, credit notes, fiscal close and audit appends were reasoned from locks and transactions; no live interleaving test exists (the assurance gap from 2026-10-29 §7 is still open).
- **Worker at scale.** Campaign timing (B-06) is arithmetic from the throttle and gateway shape, not a measured 5,000-recipient run.

---

## 10. Remediation roadmap

1. **P0 — ledger integrity (one change set).** B-01 + B-02, with the regression tests, plus a reconciliation check (subledger AR vs trial balance) as the guard against the next bypass.
2. **P1 — session and authorization freshness.** B-03 (reset revocation), B-04 (strict auth Redis), B-05 (start the invalidation subscriber; assert at boot). These three share the auth suite and should land together.
3. **P1 — worker budget.** B-06: abort signal + per-kind timeout for messaging, then align the shutdown budget and PM2 `kill_timeout` with margin.
4. **P1 — finance correctness.** B-07; then B-18/B-20 (credit idempotency, atomic numbering) as the next finance slice.
5. **P1 — audit integrity.** B-08 + B-09, with the restore-rollback and batch-audit tests; B-13 (P2, same area: align the `REVOKE` role and sign checkpoints outside the database) can ride the same change set.
6. **P2 — perimeter and CI.** B-10 (IP-only pre-auth buckets), B-14 (private uploads), B-15/B-16 (readiness memoisation, metrics loopback), B-17 (CI filter) — small, independent diffs.
7. **P2 — other correctness.** B-19 (reconciliation), B-11 (2FA claim), B-12 (platform admin symmetry), B-21 (erasure state).
8. **P3 — hygiene and ratchets.** B-33/B-34 ratchet updates, B-35 route-auth matrix, B-36 orphan sweep, then the rest of the P3 table.

**Suggested commit grouping:** `fix(finance): guard PUT ledger fields`, `fix(auth): revoke sessions on password reset`, `fix(cache): start cross-node invalidation`, `fix(worker): bound messaging jobs and shutdown`, `fix(audit): bind restore/batch audit and align role`, `fix(http): private uploads + probe limits`, `chore(ci): match lib SQL paths`.

---

## Appendix — commands run

```bash
git rev-parse HEAD && git status --porcelain
git diff --stat 1a9b1d942 cf69f9d17 -- apps/backend packages/shared docs
pnpm --filter mms-backend typecheck
pnpm --filter mms-backend lint
pnpm --filter mms-backend test:coverage        # 320 files / 2,237 tests
pnpm --filter mms-backend test:db              # 46 files / 181 passed, 1 skipped
pnpm run check:backend-boundaries
pnpm run check:backend-structure
pnpm run check:db-projections
pnpm run check:code-norms
pnpm --filter mms-backend run db:check-rls     # role=postgres superuser=true → RLS inert locally
```

Coverage by subsystem (logic files only, mocked unit run):

| Subsystem | Stmts | Subsystem | Stmts |
| --- | --- | --- | --- |
| `workshops` | 9.1 % | `notifications` | 26.7 % |
| `platform` | 15.7 % | `enrollments` | 28.8 % |
| `db` (repos; schema excluded) | 18.1 % | `worker` | 48.5 % |
| `sessions` | 26.1 % | `services` | 48.1 % |
| `routes` | 52.3 % | `accounting` | 62.8 % |

---

## 11. Resolution — 2026-10-31 (same day)

All P0/P1 findings were fixed in the working tree. No commit, push, or PR was created; the changes are left staged in the filesystem for review. P2/P3 findings remain open (B-10–B-36), including the audit `REVOKE` role mismatch (B-13), which needs a migration.

**Evidence after the fixes**

| Check | Result |
| --- | --- |
| `pnpm --filter mms-backend test` | **329 files / 2,274 tests passed** (was 320 / 2,237) |
| `pnpm --filter mms-backend typecheck` | Pass |
| `pnpm --filter mms-backend lint` | Pass |
| `pnpm --filter mms-backend test:db` | Pass (46 files / 181 passed, 1 skipped) |
| `check:backend-boundaries` / `check:db-projections` | 0 offenders |
| `check:backend-structure` | 48 / 66 / 17 held; use-cases without tests **54 vs baseline 55** |
| `check:code-norms` | Pass (0 `any`; no backend file > 300 LOC) |

| ID | Status | Change | Regression test |
| --- | --- | --- | --- |
| B-01 | **Fixed** | Ledger guard now covers `creditedAmt` and `status → cancelled/paid`; internal cancel/credit paths use an explicit `allowLedgerSensitive` flag; the posting lookup goes through the finance repository seam | `financeLedgerSyncGuards.test.ts` (11 tests) |
| B-02 | **Fixed** | `updatePaymentById` rejects financial edits on posted payments, runs in one tenant transaction, and writes an UPDATE audit with the old state | `financePaymentUpdateGuards.test.ts` (6 tests) |
| B-03 | **Fixed** | Forgot-password reset revokes all sessions + refresh tokens before changing the password, and binds the user to the reset tenant | `tenantPasswordOtpAttempts.test.ts` resolution cases (5 tests) |
| B-04 | **Fixed** | Strict Redis reads (`lib/authRedisReads.ts`) for revocation/blocklist/session clock; middleware and WebSocket map `RedisUnavailableError` to 503/1013 instead of failing open | `authRedisFailClosed.test.ts`, `authDependencyFailure.test.ts` |
| B-05 | **Fixed** | `startCacheInvalidationSubscriber()` is called from `registerHttpPlugins`, so PM2 instances receive RBAC/settings evictions; boot logs an error if pub/sub is unavailable | `cacheInvalidationSubscriber.test.ts` |
| B-06 | **Fixed** | Per-kind wall clock (messaging 10 min), shutdown abort signal, `pause(true)`, 75 s force-exit with PM2 `kill_timeout` 90 s; the generic worker passes the shutdown signal | `backgroundJobDeadline.test.ts`, `backgroundJobShutdownAbort.test.ts` |
| B-07 | **Fixed** | Payment archive/restore applies `invoiceAmount` (cash amount only as fallback) and locks invoice rows (`FOR UPDATE`, ordered) inside the lifecycle transaction | `financeRecordLifecycle.test.ts` (12 tests), `financePaymentArchiveDeltas.test.ts` |
| B-08 | **Fixed** | `restoreWorkspaceWithAudit` runs restore + RESTORE audit in one tenant transaction with the sync statement budget; audit failure rolls back the restore | `dbSyncRestoreAudit.test.ts` |
| B-09 | **Fixed** | Batch invoice generation emits one CREATE audit event per generated invoice | `financeInvoiceGenerationUseCases.test.ts` |

**Behaviour changes to note in review**

- `PUT /api/finance/invoices/:id` and `PUT /api/finance/payments/:id` now return **422** for ledger-sensitive edits of posted documents (instead of silently desynchronising the ledger).
- Authenticated requests against a deployment with `REDIS_URL` but an unreachable Redis now return **503** rather than accepting potentially-revoked sessions.
- `POST /api/db/sync` now fails (and rolls back) if its audit row cannot be written.
- Worker shutdown aborts in-flight messaging campaigns immediately; sandboxed exports keep their full 60 s budget, and PM2's kill timeout now sits 15 s above the app's force-exit.

### P2 batch 2 — 2026-10-31 (same day)

Second remediation batch, also left uncommitted: B-10, B-11, B-12, B-14, B-15, B-16, B-17 and B-21.

**Evidence:** unit suite **331 files / 2,291 tests** (was 329 / 2,274; +17 tests), `typecheck` and `lint` pass, `test:db` 46 files / 181 passed / 1 skipped, ratchets held (boundaries 0, projections 0, structure 48/66/17 and 54 vs 55, no backend file > 300 LOC).

| ID | Status | Change | Regression test |
| --- | --- | --- | --- |
| B-10 | **Fixed** | Pre-auth rate-limit buckets are IP-only; the tenant dimension requires a `mms_access`/`mms_platform_access` cookie, so rotating `Host` no longer mints fresh login/registration buckets | `rateLimitConfig.test.ts` (12 tests) |
| B-11 | **Fixed** | Tenant 2FA uses atomic `DELETE … RETURNING` claims, carries an `attempts` counter, re-arms on a wrong code and dies at the shared five-attempt ceiling | `twoFactorChallengeTenant.test.ts` (7 tests) |
| B-12 | **Fixed** | `setAdminDisabled` / `deleteAdmin` now require `requirePlatformSuperUser()`, matching create/update; a delegated `admins` grant can no longer remove a super-user/system holder | `platformUsers.integration.test.ts` (10 tests) |
| B-14 | **Fixed** | `/uploads/**` defaults to `private, no-store` + `Vary: Authorization`; only `branding` categories stay public, so legacy root-level avatars/images cannot be proxy-cached | `uploadsAuth.test.ts` (13 tests), `serverConfig.test.ts` |
| B-15 | **Fixed** | `/ready` memoises its DB probe (~1 s, `READY_PROBE_CACHE_MS` override) with single-flight coalescing; shutdown still bypasses the cache | `app.health.test.ts` (8 tests, 20-concurrent case) |
| B-16 | **Fixed** | `/metrics` is loopback-or-token: a missing `METRICS_TOKEN` no longer authorises a non-loopback scrape; loopback detection is shared with `/health` | `metricsRouteAuth.test.ts` (4 tests), `metrics.test.ts` |
| B-17 | **Fixed** | CI `backend_db` filter now includes `apps/backend/src/lib/**` and `middleware/**`, so audit/crypto SQL and auth paths run DB + RLS on PRs | workflow diff |
| B-21 | **Fixed** | Erasure audit passes `subjectId`, so its ACTIVE/SHREDDED states are subject-encrypted before the key is destroyed | `cryptoShreddingAudit.test.ts` (2 tests) |

**Behaviour changes**

- Login/registration/2FA limits are now per-IP until a session cookie exists; authenticated traffic keeps the tenant dimension.
- A wrong 2FA code keeps the challenge alive (up to five attempts) instead of destroying it on the first guess; parallel guesses now fail closed.
- Non-super platform operators receive **403** when disabling/deleting an operator.
- Root-level legacy avatars/images are no longer publicly cacheable.
- `/ready` can return a result up to ~1 s old; `/metrics` returns 401 for non-loopback scrapes without a configured token.

**Deferred after both batches:** B-13 (audit `REVOKE` role + external checkpoint signing; needs a migration), B-18 (credit-note idempotency; shared contract + replay semantics), B-19 (bank-reconciliation validation; needs product sign/account/partial-match rules), B-20 (invoice-number race; needs transaction-ownership change), B-22 (coverage/assurance programme), B-23–B-36 (hygiene).
