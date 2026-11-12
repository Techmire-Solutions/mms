# Finance module — security, multi-tenancy and compliance audit

Scope: tenant isolation, granular RBAC and audit-trail atomicity across the Finance/Accounting module — chart of accounts, voucher counters, exchange rates, invoices/payments, reports, period close, reversals, waivers (credit notes) and the audit chain (`auditAtomicityDb`).

Method: read the authorization plumbing (`registerModuleAccess`, `resolveModuleRouteAction`, `evaluateModuleAccess`, `rbacCanHelpers`, the manifests and `COLLECTION_*_PERMISSION` maps), every finance/accounting repository's tenant predicate, the audit service (`recordModernAuditEvent`, hash chain, append-only trigger) and each mutation's call site; then exercised the invariants against PostgreSQL (two-tenant fixtures, a non-superuser RLS role, and a forced audit-append failure).

Status: **Fixed** findings landed with this change; **Verified** items were exercised with no change; **Documented** items are deliberate limits or follow-ups.

---

## 1. Verified baseline

| Guarantee | Evidence |
|---|---|
| **Tenant-scoped financial reads/writes** | Chart of accounts (`accountingAccountsRepository` always filters `workspaceSubdomain`), voucher counters (`accountingVoucherRepository.ts:128-146` — the conflict target and the update `WHERE` both carry `workspace_subdomain`), exchange-rate lookup (tenant table filtered; only the platform `fx_reference_rates` fallback is global by design), report aggregates (`accountingRepositoryReport.ts` joins include workspace equality + tenant `WHERE`), invoices/payments/entries/accounts by-id (composite tenant + id), runs (revaluation/IAS 29/hedge) all scoped. New DB suite `financeSecurityDb` proves a foreign id returns `null`, lists/reports exclude the other tenant, and voucher counters are independent per tenant. |
| **RLS on financial tables** | Every `finance_*`/`accounting_*` table carries `ENABLE` + `FORCE ROW LEVEL SECURITY` + `tenant_isolation_policy`; the `audit_trail_events` parent is protected (partitions fixed — F5). |
| **No cross-tenant audit append** | `recordModernAuditEvent` refuses to append to a shard other than the request tenant (`auditTrailService.ts:262-270`). |
| **Audit atomicity by construction** | The audit append joins the caller's transaction (`hasActiveTransaction`), takes a per-shard advisory lock, and writes a SHA-256 chain row; the append-only trigger (`0235`) rejects UPDATE/DELETE. |
| **Closed-year protections** | Bulk fiscal-year saves cannot reopen a closed year or change its dates (`assertFiscalYearWritesAllowed`); posting into a closed period/FY is blocked in the DB (0249). |
| **Module gate coverage** | Every `/api/finance` and `/api/accounting` route is classified by `registerModuleAccess` and covered by `moduleAccessCoverage.test.ts`. |
| **Guardians/students are fail-closed** | No guardian/student RBAC role exists and no self-service finance route exists, so the module gate denies them (tested). |

## 2. Findings

### P1 — fixed

**F1 — the Finance manifest collapsed every action to `finance.write`.** `FINANCE_MODULE_MANIFEST.permissions` mapped `read`, `delete`, `export` and `reports` to `finance.write` (`packages/shared/src/finance/financeManifest.ts`), so an auditor or principal (granted only `finance.read`) was denied every finance read at the module gate and in handlers — `finance.read` was dead code and read-only roles could not inspect financial records. *Fixed:* `read/reports/export → finance.read`, `write → finance.write`, `delete → finance.delete`, plus the new `manage` capability.

**F2 — delete silently fell back to write.** `COLLECTION_DELETE_PERMISSION` had no finance/accounting entries and `computeCanDeleteCollection` fell back to `canWriteCollection`, so a write-only role could archive invoices, payments, ledger entries, accounts and fiscal years while a delete-only role could not. The module gate also mapped every non-GET route to `write` for these modules. *Fixed:* the five collection delete mappings, `DELETE`/restore/bulk route-action rules for both modules, and the existing handler `canDeleteCollection` checks now resolve the right permission.

**F3 — no privileged-action capability.** The system has nine roles and no Cashier/Billing or Finance Controller; `accounting.write` authorised period close, posting-period close/reopen, fiscal-year close and voucher renumbering, while `finance.write` authorised invoice cancellation, credit notes (the fee-waiver path), fee schedules and bulk status. *Fixed:* new permissions `finance.manage` and `accounting.manage` (`ALL_PERMISSIONS` + `PERMISSION_RULES` + manifest `manage`), route-action rules mapping the privileged routes to the `manage` action, in-handler `canManageFinance`/`canManageAccounting` guards (defence in depth, including the contract `bulk-status` handler), and frontend gating through the existing `useModulePermissions().canManage` (invoice cancel/credit-note actions, fee schedules, bulk status). Admins/super-admins hold `manage` automatically; the accountant role does **not** (see behaviour change).

**F4 — unlogged financial mutations.** Fixed:
- invoice/payment **archive and restore**, single and bulk, now append `DELETE`/`RESTORE` audit rows (`event: invoice_archived`/`invoice_restored`/`payment_archived`/`payment_restored`) inside the same tenant transaction, including the operator's `deletionReason`;
- **bulk invoice status** now appends one `UPDATE` per invoice (`event: status_changed`) with before/after status in one transaction;
- the **fee-waiver justification** is in the chain: `recordCreditNoteAudit` now stores `invoiceId`, `reason` and `creditedAmt`;
- **exchange-rate upserts** capture the replaced rate as `oldState` (exact-key lookup via `findExchangeRatesByKeys`) alongside `newState` and the estimate `overrideReason`;
- **posting-period reopen** accepts an optional `reason` (new strict body schema) and records it.
Corrected during implementation: **voucher numbering was already audited** at the repository seam (`accountingVoucherRepository.saveVoucherNumbering` appends the before/after row in the same transaction), so no change was needed there — the initial finding was wrong and the duplicate audit that had been added was removed. Already audited and verified: manual journal create/update/delete, reversal (with `reason`/`remarks`/`priorPeriod`), posting-period close, fiscal-year close (with closing entry id), currency settings, exchangeability, FX revaluation, IAS 29 and hedge valuations/settlements.

### P2 — fixed

**F5 — audit partitions had no RLS.** `auditPartitionService` created monthly partitions with a bare `CREATE TABLE … PARTITION OF`; PostgreSQL does not inherit the parent's policy, so every `audit_trail_events_y*` partition (and the DEFAULT partition) was readable across tenants by a direct partition query. *Fixed:* migration `0250_audit_partition_rls.sql` enables/forces RLS and recreates the parent policy on every existing partition (idempotent `pg_inherits` loop), and the provisioner applies the same statements to each new month. The new `auditPartitionRlsDb` suite proves a non-superuser role sees only its tenant's rows in both the parent and the physical partition.

### P2/P3 — documented

- **Students/guardians have no finance surface** — there is no guardian/student RBAC role and no self-service invoice/receipt route; the module gate denies them (tested). The requirement "view their own invoices/receipts" is therefore unimplemented rather than bypassed; a portal with `studentId`/`familyContactId` scoping is a separate feature.
- **Export completion audit is client-reported** — the queue event is server-side; the "exported N rows" event comes from `POST /export-audit`. Read-side, not a financial mutation.
- **Append-only escape hatches** — the immutability trigger honours `app.allow_audit_purge`/`app.allow_hard_purge` for retention/erasure, and the dev/test connection is a superuser (RLS inert there). Chain verification still detects deletion/update, and the code-level tenant filters remain the primary control.
- **System-posted ledger entries** are audited at their source identity (invoice/payment/reversal/revaluation/IAS 29/hedge/closing) rather than duplicated per entry; manual vouchers are audited directly.

## 3. Role → capability matrix (defaults after this change)

| Capability | admin / super_admin | accountant | auditor | principal | guardian/student |
|---|---|---|---|---|---|
| Read invoices/payments/ledger | ✓ | ✓ | ✓ (was denied) | ✓ (was denied) | — |
| Record payments, issue drafts, post vouchers, run revaluations | ✓ | ✓ | — | — | — |
| Cancel/void an invoice, credit note (waiver), fee schedules, bulk status | ✓ (`finance.manage`) | — (grant via a controller custom role) | — | — | — |
| Close/reopen a period, close a fiscal year, change voucher numbering | ✓ (`accounting.manage`) | — (grant via a controller custom role) | — | — | — |
| Archive/restore financial records | ✓ (`finance.delete`/`accounting.delete`) | ✓ | — | — | — |
| Own invoices/receipts | — | — | — | — | not implemented (fail-closed) |

Tenants express "Cashier/Billing" and "Finance Controller" through custom roles: a cashier holds module actions `create/update` (write) but not `manage`/`delete`; a controller holds `read` + `manage`.

## 4. Audit coverage matrix

| Mutation | Event | Transaction |
|---|---|---|
| Manual voucher create/update/delete | `accounting_entries` CREATE/UPDATE/DELETE | same tenant tx |
| Voucher reversal | `accounting_entries` CREATE with `reason`, `remarks`, `priorPeriod` | same tx |
| Invoice create/update | `finance_invoices` CREATE/UPDATE (minimised state) | same tx |
| Invoice cancel | `finance_invoices` UPDATE `event: invoice_cancelled` | same tx |
| Invoice/payment archive/restore (single+bulk) | `finance_invoices`/`finance_payments` DELETE/RESTORE + `deletionReason` | same tx (new) |
| Payment create/update | `finance_payments` CREATE/UPDATE | same tx |
| Credit note / fee waiver | `finance_credit_notes` CREATE with `reason` | same tx (reason new) |
| Bulk invoice status | `finance_invoices` UPDATE `event: status_changed` | same tx (new) |
| Exchange-rate upsert | `accounting_exchange_rates` UPDATE old+new + `overrideReason` | same tx (old state new) |
| Currency settings / exchangeability | settings tables UPDATE old+new | same tx |
| Posting-period close/reopen | `accounting_posting_periods` UPDATE with `reason` | same tx (reopen reason new) |
| Fiscal-year close | `accounting_fiscal_years` UPDATE + closing entry id | same tx |
| Voucher numbering | `accounting_voucher_numbering` UPDATE old+new | same tx (already) |
| FX revaluation / IAS 29 / hedge valuation/settlement | run/relationship rows with entry ids | same tx |
| Generated fee invoices | `finance_invoices` CREATE | same tx |

## 5. Landed changes

| File | Change |
|---|---|
| `packages/shared/src/auth/permissions.ts`, `permissionRules.ts` | `finance.manage`, `accounting.manage` |
| `packages/shared/src/finance/financeManifest.ts` | read/write/delete/export/reports fixed + `manage` |
| `packages/shared/src/finance/accountingModuleManifest.ts` | `manage` |
| `apps/backend/src/lib/rbacPermissionMaps.ts` | delete mappings for invoices/payments/entries/accounts/fiscal years |
| `apps/backend/src/lib/rbacCanModuleHelpers.ts` | `canManageFinance`, `canManageAccounting` |
| `apps/backend/src/lib/moduleRouteActionRulesFinance.ts` (new) | delete/manage route-action rules |
| `apps/backend/src/routes/tenant/finance/*`, `accounting/*` | manage gates on cancel, credit notes, fee schedules, bulk status, period close/reopen, fiscal-year close, voucher numbering |
| `apps/backend/src/finance/use-cases/financeAuditEvents.ts` | credit-note reason; archive/restore reason support |
| `apps/backend/src/finance/use-cases/financeRecordLifecycle.ts` + new `…Ledger.ts` | archive/restore audit in-transaction (split for the length ceiling) |
| `apps/backend/src/finance/use-cases/financeMutationOperations.ts` | bulk-status audit |
| `apps/backend/src/accounting/use-cases/exchangeRateUseCases.ts` + repository/port | rate `oldState` |
| `apps/backend/src/accounting/use-cases/accountingPostingPeriodUseCases.ts` + route + shared schema | reopen `reason` |
| `apps/backend/src/services/auditPartitionService.ts` | RLS on newly provisioned partitions |
| `apps/backend/src/db/migrations_drizzle/0250_audit_partition_rls.sql` (+ snapshot/journal) | partition RLS backfill |
| `apps/frontend/.../InvoicesList.tsx`, `InvoiceCorrectionActions.tsx`, `useFinancePageController.ts` | `canManage` gating |

## 6. Evidence

- `financeRbacCapabilities.test.ts` (8): role matrix — auditor/principal read, accountant write-not-manage, admin manage, delete vs write, controller custom role, guardian/student denied.
- `financeRbacRoutes.test.ts` (7): privileged routes return 403 for the accountant and 200 for the admin (cancel, credit note, fee schedules, fiscal-year close, period close/reopen with reason, voucher numbering); guardian denied; write paths unchanged.
- `finance.integration.test.ts` (12, +1): the contract `bulk-status` path is 403 for the accountant and 200 for the admin.
- `financeSecurityDb.integration.test.ts` (7): cross-tenant by-id reads null; lists/report aggregates scoped; voucher counters independent; **audit atomicity** (a journal entry whose audit append fails is rolled back with no audit row); credit-note reason, archive/restore events and numbering before/after in the chain.
- `auditPartitionRlsDb.integration.test.ts` (1): a non-superuser tenant role reads only its own rows from the parent **and** the physical partition.
- Whole-suite: backend unit **530 files / 3759 tests**, frontend finance/accounting **77 files / 389 tests**, shared **284 / 2297**, finance/accounting + audit DB batch **23 files / 122 tests**, typecheck clean, all ratchets green, migration 0250 applied to the dev database (15/15 audit partitions protected), ledger-invariant audit clean.

## 7. Behaviour change and rollback

- The **accountant** role no longer closes periods, cancels/voids invoices, issues credit notes, edits fee schedules or renumbers vouchers by default; **auditor/principal** can now read finance. Grants move to `finance.manage`/`accounting.manage`; a tenant can create a "Finance Controller" role or edit the accountant role to restore a previous workflow. This is the deliberate least-privilege separation the audit requested; it should ship with a release note.
- Rollback is code-only except migration 0250, whose statements are additive policies (a forward migration would drop them). No tenant data was rewritten.

## 8. Recommendations not implemented

1. Guardian/student self-service invoices and receipts (portal + `studentId`/`familyContactId` scoping + receipt access), with its own compliance review.
2. Authoritative export-completion audit in the worker instead of the client `POST /export-audit` call.
3. A dedicated least-privilege DB role for the application (the dev connection is a superuser, which makes RLS inert; `db:check-rls` exists and should gate deployments).
4. Periodic verification job wiring for the new audit volume (the verification scheduler exists; partition-level RLS should be asserted in its health check).
