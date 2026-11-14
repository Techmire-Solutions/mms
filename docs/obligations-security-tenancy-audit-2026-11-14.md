# Security, Multi-Tenancy & Compliance Audit: Obligations Module

Review of tenant isolation, RBAC enforcement and audit-trail integrity for the Obligations module — 7 tables, 22 contract routes, 6 bulk routes, 4 trash routes, and the catalogue/aggregate write paths.

**Status: reviewed and hardened.** Tenant isolation is sound and now *proven* against a live database; RBAC had one real gate mismatch; and the module wrote **no audit rows for its own mutations at all**, which is closed here along with a silent ledger divergence and a duplicate-RLS-policy defect.

---

## 0. Scope corrections

| Briefed | Reality |
|---|---|
| Installment schedules, batch assessment, aging summary | **No installment entity, no assessment, and no obligation aging** anywhere in the repo (established in the three prior audits). Aging is a Finance-invoice query. |
| Waiver approval, write-off, alter historical due dates | **No waiver, write-off or due-date concept.** A waiver is a Finance credit note; a receipt has a `received_date`, not a due date. |
| `customRoleModuleAccess`, `auditAtomicityDb` | Neither is a real symbol. The mechanisms are `registerModuleAccess` + `moduleAccessGuard` (honouring the workspace **custom-role catalog**) and `auditAtomicityDb.integration.test.ts`, which covered **contacts only** (0 obligation references). |
| Students/contacts/guardians viewing their own obligations | **No self-service surface exists** — no guardian/student role in the default catalog, no portal route, `/api/obligations` is staff-only. The risk is the *absence* of a scoped portal, not an over-broad one. |

The module has three permissions (`obligations.read/write/delete`), seven tables with `FORCE ROW LEVEL SECURITY`, and — before this change set — zero audit rows for anything it wrote.

---

## Findings

### T — Tenant isolation

| # | Sev | Finding | Status |
|---|---|---|---|
| **T1** | — *(verified good)* | Every obligation read/write filters `workspace_subdomain` inside `withTenant`/`withTenantRead`: 4–22 tenant predicates per file across 10 repositories, including the newer `countCatalogueDependents` and `replaceWakalaAggregateForWorkspace`. No `withGlobalTenant`/`allowGlobal` in the module. Every FK is composite `(workspace_subdomain, id)` — including the `sender → contacts` and `distribution → accounting_accounts` edges — so a cross-tenant row cannot be linked. | **Proven** — the new RLS suite runs as a `NOSUPERUSER NOBYPASSRLS` role and shows zero cross-tenant rows for unfiltered `SELECT`/`UPDATE`/`DELETE`, and a rejected foreign-tenant FK reference |
| **T2** | MEDIUM | **Five catalogue tables carried two permissive RLS policies each.** `0052` created `<table>_tenant_isolation`; `0076` created `tenant_isolation_policy`; `0108` dropped the legacy policy for `obligation_collections` **only**. Permissive policies are OR-ed, so a future stricter predicate would be silently defeated — the exact defect `0229` fixed elsewhere. | **Fixed** — migration `0259` drops the five legacy policies and asserts exactly one policy + `FORCE RLS` per table at migration time |
| **T3** | — *(verified good)* | No request path can set `app.rls_bypass`, and the audit writer refuses a cross-tenant append (`[audit] refusing to append to X from a Y request`). | Verified |
| **T4** | LOW | `permissions.setupView = configuration.view` exists, but `getPreferences` guards with `obligations.read`. A reader without `configuration.view` can read Setup preferences. | Recorded (D4) |

### R — RBAC enforcement

| # | Sev | Finding | Status |
|---|---|---|---|
| **R1** | HIGH | **Trash/restore resolved to the `write` action at the module gate.** `MODULE_ROUTE_ACTION_RULES` had delete-action rules for students, enrollments, examinations, workshops and faculty but **none for obligations**, so `DELETE /collections/:id` and the three `POST …/restore\|bulk-delete\|bulk-restore` routes required `obligations.write`. The handlers correctly require `obligations.delete`, so **a custom role granted only the delete permission was 403'd at the gate** — the same mismatch those four modules' rules fix. | **Fixed** — two rules added + gate tests |
| **R2** | MEDIUM | **No granularity between recording and destroying.** `obligations.write` covers recording a receipt *and* the destructive catalogue replaces (types / mujtahids / reps / wakala / distributions / aggregate), which delete rows. The 409 cascade guard refuses *lossy* writes; it does not separate the permission. Only `accountant` (+ admin/super_admin bypass) holds write by default. | Recorded (D2) |
| **R3** | — *(verified good)* | Guards are layered and server-side only: `registerModuleAccess` (grant → enablement → action, from the auth-verified tenant and workspace row) + per-handler `canRead/Write/DeleteCollection` (owning `userHasPermission`) + preferences write requiring `settings.global.write`. Custom roles are honoured through the role catalog; admin/super_admin→all is centralised in `roleHasPermission`. | Verified |
| **R4** | — *(note)* | Default-role grants: `principal`/`registrar`/`auditor`/`teacher`/`assistant_teacher`/`librarian` = read; `accountant` = create/read/update/delete; `admin`/`super_admin` = all. No role can reach the module without a grant. | Verified |

### A — Audit trail & compliance

| # | Sev | Finding | Status |
|---|---|---|---|
| **A1** | **CRITICAL** | **No audit rows for any obligation receipt mutation.** `grep -i audit` over the module returned only comments: create, amount edit, archive and restore wrote **nothing** to `audit_trail_events` — no actor, no before/after, no reason. Only the ledger side was audited (`recordJournalEntryAudit`). | **Fixed** — create/update/delete/restore/catalogue writes now append same-transaction audit rows |
| **A2** | HIGH | **Deletions carried no justification.** The manifest set `captureDeletionReason: false`, so no reason was ever collected or stored. | **Fixed** — capture enabled; the reason lands on the row and in the audit `newState` + outbox event |
| **A3** | HIGH | **The save path swallowed policy rejections → unaudited divergence.** `postSavedCollection` logged and continued on *any* posting failure, so an edit into a closed fiscal year (or against an archived account) committed the row while the ledger kept the old value — and, before A1, nothing recorded either. | **Fixed** — a 4xx ledger rejection now aborts the transaction (the write and its audit row roll back); infrastructure (5xx) failures still let the write stand, logged and now attributable |
| **A4** | MEDIUM | Catalogue replaces and the workspace purge wrote no audit row and emitted no outbox event, so a wakala/rule wipe left only the 409 guard as evidence. | **Fixed** — replace rows carry created/removed ids; the purge records counts before deleting |
| **A5** | — *(verified good)* | The chain itself is sound: hash-linked, append-only, partition-RLS isolated, and `recordModernAuditEvent(tx, …)` appends inside the caller's transaction (atomic by construction, with a cross-tenant refusal). The module simply never called it. | Verified |

---

## 1. What was applied

### 1.1 Audit rows and outbox events for every obligation mutation (A1, A2, A4)

New `apps/backend/src/obligations/use-cases/obligationAuditTrail.ts` follows the contacts/students pattern — per-row `actionType`, `oldState`/`newState`, `realUserId`, plus an outbox snapshot on archive:

| Mutation | Audit | Outbox |
|---|---|---|
| Create receipt | `CREATE` (full new state) | — |
| Edit receipt | `UPDATE` with `changedFields` diff; **skipped when nothing changed** | — |
| Archive (single + bulk) | `DELETE` + `newState.reason` | `entity.soft_deleted` + forensic snapshot |
| Restore (single + bulk) | `RESTORE` | `entity.restored` |
| Catalogue replace (×5) | `UPDATE` with `createdIds`/`removedIds` | — |
| Wakala aggregate | one `UPDATE` for wakalas + one for distributions | — |
| Workspace purge | `DELETE`, `operation: "workspace_purge"`, row counts | — |

Every call sits **inside the transaction that performs the mutation** (a nested `withTenant` joins the ambient transaction), so an audit-append failure rolls the write back — proven by a new DB suite. The actor is `getRequestUserId()`; background paths record `null` explicitly.

### 1.2 Ledger divergence (A3)

`runLedgerPosting` gained a `policy` mode: a **4xx** ledger rejection (closed fiscal year `yearClosed`, archived account, unbalanced entry) now propagates and rolls back the write + audit; a **5xx** failure is still logged and tolerated so a ledger outage cannot block recording money that arrived. Create, save and bulk-upsert postings moved **inside** their write transactions for this to hold.

### 1.3 Module gate (R1)

Two `MODULE_ROUTE_ACTION_RULES` entries (`onlyModules: ["obligations"]`) classify `DELETE /collections/:id` and the three trash/restore `POST`s as the `delete` action, with gate tests for both directions (delete-only role passes; `PUT` still requires write).

### 1.4 RLS policy dedup (T2)

Migration `0259_obligations_rls_policy_dedup.sql` drops the five legacy permissive policies, leaves the one documented policy per table, and asserts at migration time that every obligation table has **exactly one** policy and `FORCE RLS` — so a future policy change fails loudly instead of silently relying on a stray duplicate. Applied and verified on a live database.

---

## 2. Verification

This environment **had a live PostgreSQL** for this change set, so the DB-dependent claims below are actually verified — a correction to the "no database here" caveat carried by the previous audits.

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 6/6 packages |
| `pnpm --filter @mms/shared test` | 2 393 tests (manifest expectation updated for `captureDeletionReason`) |
| backend obligations / soft-delete / module-gate suites | **198** tests, 18 files |
| `vitest.db.config` — `obligationsAuditAtomicityDb` | **2/2 passed against live PostgreSQL**: a failing audit append rolls the receipt back; a clean write commits exactly one `CREATE` row |
| `vitest.rls.config` — `obligationsTenantIsolation` | **6/6 passed as a NOSUPERUSER NOBYPASSRLS role**: unfiltered reads, explicit-id reads, UPDATE, DELETE all cross-tenant-safe; all seven tables isolated; foreign-tenant FK rejected; exactly one policy + `FORCE RLS` per table |
| `0259` applied by the DB suite | policy inventory now one-per-table (was two on five tables) |
| `check-migrations.sh` · migration-hygiene · migration-indexes · forward-only | held |
| `check-code-norms` · `check-backend-boundaries` · `check-docs` · `check:i18n` | held (two files split to stay under the 300-line ceiling) |

The RLS suite is written to **fail closed** when connected as a superuser/bypass role (it did during development, as designed), so it stays in the `test-backend-rls` job.

## 3. Deferred

| ID | Item |
|---|---|
| **D1** | A read-side detector for residual A3 divergence: flag receipts whose ledger revision predates `updated_at` (extends the reconciliation script from the Finance audit). |
| **D2** | An `obligations.manage` permission separating destructive catalogue edits (and any future write-off) from recording receipts — needs a permission key, role defaults and a UI gate. |
| **D3** | A student/guardian self-service surface, row-scoped by `sender_id`/guardian link. New capability, not a hardening of this one. |
| **D4** | `setupView` alignment for the preferences read, and a UI prompt that supplies the deletion reason (the field is accepted and stored today, but the client does not send it yet). |
| **D5** | Outbox consumers for the new `entity.soft_deleted`/`entity.restored` obligations events beyond the existing CDC listener. |

## 4. Assumptions

1. Per-row audit rows inside a bulk transaction are acceptable cost: bulk sizes are user-driven (≤ hundreds) and contacts/students already do exactly this.
2. Enabling `captureDeletionReason` is safe: the field is optional in `softDeleteBodySchema`, so existing clients keep working; enforcement lands with D4's UI prompt.
3. Propagating 4xx ledger rejections changes behaviour deliberately — a financial document must not silently disagree with the books — and the tolerance for 5xx preserves availability.
4. Dropping the legacy RLS policies cannot loosen isolation: the surviving policy has an identical predicate, and the migration's own guard fails if a table would be left without one.
