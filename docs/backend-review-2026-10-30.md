# MMS Backend Review — 2026-10-30

Comprehensive architectural, security, and code-quality review of `apps/backend` at `main` following the October 29 hardening resolutions (`a729f0b9e` / `ee5cffefd`).

---

## 1. Executive Summary & Verification Verdict

**Verdict: Structurally hardened, verified resilient, and aligned with core invariants.**
The 46 findings (F1–F46) identified in the prior review have been thoroughly verified in code. Row-level security (RLS) enforcement is fail-closed, financial ledger operations are transaction-bound with appropriate row locks, the modern audit trail participates in tenant transactions with monotone timestamp clamping and Merkle checkpoint anchoring, worker queues feature proper fair-share and timeout cancellation, and static assets enforce private cache headers.

### Baseline Health Metrics

| Metric / Check | Value / Status | Verification Command |
| --- | --- | --- |
| **Backend Test Suite** | **320 / 320 files · 2,235 / 2,235 tests pass** | `pnpm --filter mms-backend test --run` |
| **Typecheck** | **Pass (0 errors)** | `pnpm --filter mms-backend typecheck` |
| **ESLint** | **Pass (0 errors, `--quiet`)** | `pnpm --filter mms-backend lint` |
| **Route Storage Boundary** | **0 offenders (baseline 0)** | `pnpm run check:backend-boundaries` |
| **Backend Structural Seam** | **All ratchets held** (use-cases 44/48, services 64/66, aggregators 17/17, untracked use-cases 54/55) | `pnpm run check:backend-structure` |
| **Wildcard DB Projections** | **0 bare `.select()` calls (baseline 0)** | `pnpm run check:db-projections` |
| **Code Norms: 300 LOC Ceiling** | **0 backend files over 300 LOC (ceiling strictly enforced)** | `pnpm run check:code-norms` |
| **Code Norms: Explicit `any`** | **0 occurrences in backend source** | `pnpm run check:code-norms` |
| **Migration Index Safety** | **0 write-blocking index builds on hot tables** | `pnpm run check:migration-indexes` |
| **Migration Hygiene** | **0 migrations without lock_timeout; forward-only held** | `pnpm run check:migration-hygiene` |

---

## 2. Hardening Audit: Verification of Prior Findings (F1–F46)

The review verified code paths across the recent hardening commits:

### A. Audit Trail & Cryptographic Verification (F1, F2, F12)
- **F1 (Transaction Bounding):** In [`auditTrailService.ts`](../apps/backend/src/services/auditTrailService.ts#L250-L282), `recordModernAuditEvent` joins any active tenant transaction (`hasActiveTransaction() ? activeDb() : ...`) or opens a dedicated `withTenant(subdomain)` transaction. Audit reads in [`auditQueryAdapter.ts`](../apps/backend/src/audit/repository/auditQueryAdapter.ts) utilize `withTenantRead`, guaranteeing `SET LOCAL app.current_tenant` is present and RLS does not reject inserts or return empty reads.
- **F2 (Merkle Anchoring & Initial Status):** Events insert with `verificationStatus: 'PENDING'`. In [`auditVerificationService.ts`](../apps/backend/src/services/auditVerificationService.ts), verification anchors against `audit_verification_runs` checkpoint heads with tolerance for archived partitions, eliminating false `BROKEN_CHAIN` reports.
- **F12 (Hash-Chain Monotonicity):** Shard lock `SELECT pg_advisory_xact_lock(hashtext('audit:${subdomain}'))` serializes appends per workspace. The ordering timestamp is captured *after* the lock and clamped to `head.timestamp + 1ms` if requested time is less than or equal to head, preventing concurrency inversion.

### B. Financial Ledger & Idempotency (F3, F4, F5, F7, F13)
- **F3 (Batch Invoice Posting):** In [`financeInvoiceGenerationUseCases.ts`](../apps/backend/src/finance/use-cases/financeInvoiceGenerationUseCases.ts#L66-L77), batch generation runs inside a single tenant transaction (`withTenant`) and calls `tryPostInvoiceJournals(tenant, invoices)`, ensuring generated receivables post atomically.
- **F4 (Invoice Create Immutability):** In [`financeInvoiceMutationOperations.ts`](../apps/backend/src/finance/financeInvoiceMutationOperations.ts#L113-L131), `POST /api/finance/invoices` is strictly insert-only. Supplying an existing ID checks `isIdempotentInvoiceReplay`; if not an exact match, it throws `409 Conflict`.
- **F5 (Payment Settlement Atomicity):** In [`financeMutationOperations.ts`](../apps/backend/src/finance/use-cases/financeMutationOperations.ts#L103-L148), invoice row locking (`forUpdate: true`), payment allocation, journal posting, and audit logging execute within the same transaction.
- **F7 (Credit Note & Cancel Locking):** In [`financeCollectUseCases.ts`](../apps/backend/src/finance/use-cases/financeCollectUseCases.ts#L160-L230), cancel and credit note operations acquire `financeUseCases.getInvoiceByIdForUpdate(invoiceId)`, preventing race conditions on open balance calculations.
- **F13 (Fiscal Year Close Advisory Lock):** In [`accountingPeriodClose.ts`](../apps/backend/src/accounting/use-cases/accountingPeriodClose.ts#L48-L60), closing a fiscal year takes both a row lock on the year and an advisory lock (`lockFiscalYearForPosting`), shared with transaction posting paths to prevent entries landing during close.

### C. Privacy, RBAC & Session Security (F6, F35, F36, F37, F38, F45, F46)
- **F6 & F35 (Crypto-Shredding Governance):** In [`auditPrivacyRoutes.ts`](../apps/backend/src/routes/tenant/audit/auditPrivacyRoutes.ts#L22-L43), erasure requires `audit.manage` (revoked from generic teachers) plus the mandatory step-up header `X-Confirm-Erasure: <subjectId>`. Tables enforce `workspace_subdomain` with `FORCE ROW LEVEL SECURITY`.
- **F36 (Activity Log Forgery Prevention):** User activity log endpoints require `audit.manage` and derive user ID, IP address, and server-side bounded timestamps automatically.
- **F37 (Session Revocation TTL):** In [`authSessionRoutes.ts`](../apps/backend/src/routes/common/auth/authSessionRoutes.ts#L83), token revocation TTL is computed dynamically from the token's remaining lifetime (`Math.max(60, remainingSeconds)`).
- **F38 (Password Change Invalidation):** In [`authProfileRoutes.ts`](../apps/backend/src/routes/common/auth/authProfileRoutes.ts#L94-L96), changing passwords invokes `revokeAllUserSessions` and `deleteRefreshTokensForUser`.
- **F45 & F46 (2FA & OTP Tenant Scoping):** 2FA challenges in [`twoFactorService.ts`](../apps/backend/src/services/auth/twoFactorService.ts#L89) validate `challengeMatchesTenant(entry.payload, expectedTenant)`. In [`tenantPasswordOtpService.ts`](../apps/backend/src/services/auth/tenantPasswordOtpService.ts), OTP attempts are tracked by a shared monotonic counter across verification and reset routes.

### D. Worker & Asynchronous Queues (F14–F22, F28)
- **F14 (Job ID Namespacing):** Background job IDs are constructed with `buildBackgroundJobId(tenant, user, key)` preventing cross-tenant collisions in Redis.
- **F17 (Shutdown Budget):** In [`worker/index.ts`](../apps/backend/src/worker/index.ts#L179-L200), graceful shutdown pauses workers first and allocates `JOB_EXECUTION_TIMEOUT_MS + 10_000` ms before forcing process exit.
- **F22 (Queue Add Reconcile):** On timeout during `queue.add`, the worker reconciles with `queue.getJob` before marking a job failed in the database.
- **F28 (Fair-Share Decrement):** Tenant fair-share counters decrement only on the final retry attempt (`attemptsMade >= attempts`), preventing retry promotion.

### E. Static Assets & HTTP Perimeter (F39–F44)
- **F39 & F41 (Cache-Control & Dotfiles):** In [`staticAssets.ts`](../apps/backend/src/plugins/staticAssets.ts#L43-L172), attachments and tenant files serve `Cache-Control: private, no-store`. Both static plugins configure `dotfiles: "deny"`.
- **F40 & F42 (Upload Limits & Error Masking):** In [`uploads.ts`](../apps/backend/src/routes/common/uploads.ts#L37-L68), 5xx errors return sanitized reference IDs (`Internal server error. Reference: ${requestId}`), and multipart limits are constrained to 10MB file, 1 file, 4 parts, 1MB field.
- **F44 (Host Header Validation):** In [`requestHost.ts`](../apps/backend/src/lib/requestHost.ts#L21-L28), production ignores `X-Forwarded-Host` unless `MMS_TRUST_X_FORWARDED_HOST=true`.

---

## 3. Detailed Audit by Architectural Pillar

### Pillar 1: Multi-Tenancy & Row-Level Security
- `resolveTenantScope` fails closed: an empty tenant id throws an error unless `allowGlobal: true` or `inGlobalTenantScope()` is set.
- Parameterized `SELECT set_config('app.current_tenant', $1, true)` applies locally to the transaction without invalidating prepared statement caches.
- Dynamic soft-delete injection in `dbClient.ts` consistently appends `isNull(table.deletedAt)`.

### Pillar 2: Financial Accounting & Ledger Integrity
- Currency formatting strictly obeys decimal strings and BigInt units (`packages/shared/src/utils/money.ts`), completely avoiding floating-point inaccuracies.
- Period-close enforces IAS 21 foreign-currency revaluation checks before closing trial balances.

### Pillar 3: Audit Trail & Data Privacy
- Sharded hash chains use RFC 8785 canonical JSON with SHA-256 hashes.
- Right-to-erasure destroys subject encryption keys while preserving hash chain continuity.

### Pillar 4: Security & Authentication Perimeter
- Tenant switching, session timeouts, and RBAC matrix permissions are verified on every authenticated request via Redis pipelining.
- CSRF protection validates `Origin` / `Referer` headers on all state-changing HTTP mutations.

### Pillar 5: Background Worker Architecture
- BullMQ worker queues enforce memory backpressure sentinels (pausing if heap exceeds 85% and >256MB).
- Dead-letter handling records failed jobs that exceed retry ceilings into `dead_letter_jobs`.

### Pillar 6: Clean Architecture & Modular Boundaries
- Route-to-storage isolation is complete: 0 routes import `db/repositories` or `drizzle-orm` directly.
- Use-case storage imports are bounded at 44 (against baseline 48).
- Services storage imports are bounded at 64 (against baseline 66).
- 17 module route files in `routes/tenant/` serve as composition roots for modular feature routers.

### Pillar 7: Database Migration Hygiene & Performance
- All 197 migrations adhere to forward-only rules.
- Trigram GIN indexes for fuzzy search (`contacts`, `students`) are provisioned concurrently out-of-band to prevent write blocking on production tables.
- Timezone-naive timestamp migration remains tracked in `docs/timestamp-migration.md` (144 live columns across 86 tables).

---

## 4. Adversarial Loophole Audit (Post-Review Vector Analysis)

1. **Edge Cases & Payload Integrity:**
   - Evaluated decimal money formatting, unicode names, and UTC date normalizations. All route inputs are guarded by strict Zod schemas rejecting undeclared properties.
2. **Failure Modes & Silent Failures:**
   - Evaluated worker promise rejections and streaming aborts. Floating promises on queue adds are caught (`addPromise.catch(() => {})`). Snapshot transactions release pooled connections via `finally` blocks.
3. **Security, Authorization & Multi-Tenancy:**
   - Evaluated IDOR and cross-tenant leakage. Tenant subdomains in JWT claims must match the host header. RLS policies reject cross-tenant writes at the database layer.
4. **Concurrency & Resource Management:**
   - Evaluated payment balance updates, credit notes, and period closes. All critical state transitions acquire row-level locks (`FOR UPDATE`) or advisory locks.

---

## 5. Prioritized Remediation & Maintenance Roadmap

- **P1 — Baseline Ratchet Down:**
  - Update `check:backend-structure` baselines to lock in improvements:
    - Ratchet `useCasesWithoutDirectTest` from 55 down to 54.
    - Ratchet `useCaseStorageImports` from 48 down to 44.
    - Ratchet `servicesStorageImports` from 66 down to 64.
- **P2 — Timezone-Naive Timestamp Phased Migration:**
  - Execute table-by-table expand/contract migrations for hot tables (`students`, `contacts`, `finance_invoices`) to convert naive `timestamp` columns to `timestamp with time zone` per `docs/timestamp-migration.md`.
- **P3 — Ports & Adapters Decoupling:**
  - Continue extracting repository ports for the remaining 44 use-case files that directly import `db/repositories`.
- **P4 — Route Aggregator Modularization:**
  - Fold the 17 remaining `routes/tenant/{module}.ts` aggregator files into dedicated `{module}/` directories.
