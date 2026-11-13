# Accounting security, multi-tenancy & compliance audit

Scope: the Accounting module's tenant isolation, granular RBAC, and audit-trail integrity — every Chart of
Accounts lookup, journal posting, voucher sequence allocation, FX-rate query and financial statement, the
privileged ledger controls, and the audit rows those mutations write.

Method: traced each control to its code path and, where one exists, to a test. "Verified" means enforced at
runtime in the current tree, not merely declared. Two migrations already in the tree are load-bearing here
(`0253` ledger integrity, `0254` ledger controls); this change adds `0256` (RLS gap), the `accounting.post`
capability, controller gates and the missing audit rows.

---

## 1. Verified as already sound

### Tenant isolation
| Control | Evidence |
|---|---|
| Every accounting table is a tenant table at the database | `accounting_entries`, `_journal_lines`, `_accounts`, `_fiscal_years`, `_posting_periods`, `_currency_settings`, `_enabled_currencies`, `_exchange_rates`, `_currency_exchangeability`, `_fx_revaluation_runs/_lines`, `_hedge_relationships/_valuations`, `_ias29_runs/_lines`, `_price_indices`, `_hyperinflation_settings`, `_voucher_counters`, `_voucher_numbering`, `_entry_tags/_attachments` and the audit table all carry `ENABLE`+`FORCE ROW LEVEL SECURITY` and a `tenant_isolation_policy`. `audit_trail_events` is FORCE-RLS too (0116). |
| Application predicates | Every repository query takes the tenant and filters `workspace_subdomain`; the report SQL keys **both sides of every join** on it (`accountingReportEndpointsRepository.ts`), and the trial-balance/FX/metrics queries do the same. `GET /entries/:id` returns 404 for another tenant (tested). |
| Voucher sequence generator | Counter keyed `(workspace_subdomain, format_key, period_year)`, seeded by a tenant-scoped `existingMaxSequence`, allocated by one `UPDATE … RETURNING` under the row lock — concurrent callers get disjoint ranges, and no counter is shared across tenants. |
| Composite tenant integrity | Lines→entries and accounts self-FK are tenant-composite (0253); a parent from another workspace is rejected by FK (tested). |
| No global bypass in accounting code | No `allowGlobal`/`withGlobalTenant` usage; the audit appender refuses an append whose tenant differs from the request tenant; `app.rls_bypass` is only set by migrations/purge/global admin. |
| Cross-tenant tests | FX rates, posting periods, and the new consolidated suite (`accountingTenantIsolationDb`) which also probes the policy directly under a non-superuser role. |

### RBAC
| Control | Evidence |
|---|---|
| Collection permissions are fail-closed | `COLLECTION_{READ,WRITE,DELETE}_PERMISSION` map accounting collections to `accounting.*`; unmapped collections deny. |
| Already controller-gated | Posting-period close/reopen, fiscal-year close and voucher renumbering require `accounting.manage` at the handler **and** in `MODULE_ROUTE_ACTION_RULES`; archive/restore/delete require `accounting.delete`; deletes are separately gated. |
| Custom roles | Permission lists per module; the role editor renders the shared action vocabulary; `admin` short-circuits. |
| Audit-log access | `/api/audit/events` requires `audit.view`, is tenant-scoped, and records its own VIEW event. |

### Audit trail mechanics
| Control | Evidence |
|---|---|
| Same transaction | `recordModernAuditEvent` detects an active transaction (`hasActiveTransaction() → activeDb()`) and appends there; routes wrap the whole operation in one `withTenant`, and voucher numbering / posting periods pass the transaction explicitly. |
| Serialized + chained | Per-shard `pg_advisory_xact_lock(hashtext('audit:<tenant>'))`, clamped `hash_previous → hash_current`, RFC 8785 canonical JSON, capture-time minimization, subject-key encryption for erasure. |
| Immutable | `audit_trail_events` is append-only via the 0235 trigger; UPDATE/DELETE are rejected (asserted again in the new accounting suite). |
| Actor | `realUserId` is taken from the request context when a caller does not pass one; background jobs bind their actor. |

---

## 2. Findings and fixes

### Tenant isolation
- **T1 (P1) — five accounting tables had no RLS**: `accounting_posting_rules`, `accounting_opening_balances`,
  `accounting_bank_statements`, `accounting_bank_statement_lines`, `accounting_bank_reconciliations`.
  Their repositories do filter by workspace, so there was no leak — but the database backstop every other
  accounting table has was missing. *Fixed by migration `0256_accounting_rls_gap.sql`* (ENABLE + FORCE RLS +
  the standard policy). `accountingRlsCoverageDb` now fails if a future accounting table ships without RLS.
- **T2 (P2) — coverage**: the only cross-tenant accounting tests were FX rates, posting periods and the COA
  parent FK. *Fixed by `accountingTenantIsolationDb`* (entries/lines, accounts, posting rules, opening
  balances, bank statements, voucher counters, predicate-less raw reads and cross-tenant writes under a
  non-superuser role).

### RBAC
- **R1 (P0) — voucher reversal was write-gated.** *Fixed:* `POST /entries/:id/reverse` now requires
  `accounting.manage` and carries `moduleAction: "manage"` (module gate + `MODULE_ROUTE_ACTION_RULES`).
- **R2 (P0) — IAS 29 restatement posting was write-gated.** *Fixed:* `POST /ias29-restatements` requires
  `accounting.manage`, same two layers.
- **R3 (P1) — FX revaluation posting and opening-balances posting were write-gated.** *Fixed:* both require
  `accounting.manage`; both write (or reverse) ledger entries.
- **R4 (P0) — no draft/post separation.** *Fixed:* new `post` module action → `accounting.post` permission
  (shared `PermissionAction`/`PERMISSION_ACTIONS`/`ModulePermissionAction`/`PERMISSION_RULES`/manifest,
  editor copy in en/ar/ur/fa), granted to the built-in `accountant` (and admin via the full map) so nothing
  breaks. `assertEntriesPostable` runs on the entries bulk route (`beforeSave`) and refuses creating or
  promoting a voucher to `posted` without it — `403` with `code: "accounting.post.required"`. Unchanged
  re-saves of an already-posted voucher stay allowed (they do not change the ledger record).
- **R5 (documented)** — hedge settlement/reclassification/discontinuation, posting rules, chart seeding and
  bank reconciliation remain `write` (treasury/setup, not the named controller actions).
- Junior/Senior/Controller are now expressible as custom roles: `read+create+update` (Junior), plus `post`
  (Senior), plus `manage` (Controller); built-in role behaviour is unchanged.

### Audit trail
- **A1 (P0) — generated ledger postings were unlogged.** *Fixed:* `persistGeneratedEntry` appends an
  `accounting_entries` CREATE row (minimized state + source keys) inside the posting transaction, so
  invoice/payment/closing/reversal vouchers from other modules join the chain.
- **A2 (P0) — the chart of accounts was unaudited.** *Fixed:* per-row CREATE/UPDATE audit for account saves
  (bulk upserts audit only changed rows, delta via the minimized state), and DELETE/UPDATE-with-event for
  archive/restore including the deletion reason.
- **A3 (P1) — posting rules, opening-balance replacement, bank statements and reconciliation were unlogged.**
  *Fixed:* audit rows appended inside each repository transaction (`accountingEntityAudit.ts`), with before/
  after state.
- **A4 (P1) — no accounting atomicity proof.** *Fixed by `accountingAuditAtomicityDb`*: a probe trigger on
  `audit_trail_events` forces the append to fail and proves rollback of a generated posting, a COA update, an
  opening-balance replacement, an exchange-rate save, a period close and a reversal; the success phase proves
  one attributed row per family (actor, states, hashes) and that the chain is append-only.
- **A5 (P2) — justification capture was partial.** *Fixed:* optional `reason` on opening-balance replacement
  and bank reconciliation (recorded in the audit `newState`); reversal, deletion, rate override,
  discontinuation and period close already carried theirs.

---

## 3. Files changed

| Area | Files |
|---|---|
| Migration | `0256_accounting_rls_gap.sql` + derived snapshot + journal |
| Permission model | `auth/userEntityTypes.ts`, `auth/permissions.ts`, `auth/permissionRules.ts`, `accountingModuleManifest.ts`, `settings/moduleAccessPolicy.ts`, `auth/userRbacDefaultRoles.ts`, i18n `users.permission.post` (4 locales), `accountingErrorCodes.ts` |
| RBAC enforcement | `accountingPostingGuard.ts` (new), `rbacCanModuleHelpers.ts`, `rbacCanHelpers.ts`, `accounting.ts` (entries `beforeSave`), `accountingReversalRoutes.ts`, `accountingIas29Routes.ts`, `accountingFxRevaluationRoutes.ts`, `accountingLedgerOpsRoutes.ts`, `moduleRouteActionRulesFinance.ts`, `crudBulkRouteTypes.ts`/`crudIncludableBulkRoutes.ts`/`crudBulkRouteFactories.ts` (`beforeSave`) |
| Audit completeness | `accountingEntityAudit.ts` (new), `accountingAccountsPersist.ts`, `accountingAccountsLifecyclePersist.ts`, `accountingLedgerOpsRepository.ts`, `accountingBankingRepository.ts` (new split), `ledgerPostingHelpers.ts`, `accountingLedgerOpsUseCases.ts`, `accountingLedgerOps.ts` (schemas) |
| Tests | `accountingRlsCoverageDb`, `accountingTenantIsolationDb`, `accountingAuditAtomicityDb` (new); `financeRbacCapabilities` (+ junior/senior/post capability + module-action mapping), `accountingPostingGuard` (new: draft allowed, posted refused with `accounting.post.required`, unchanged re-save allowed, poster allowed), `accounting.integration` (route wiring: the gate runs in `beforeSave` with the session user and its refusal answers 403 + code without saving), `accountingReversalRoutes`/`accountingIas29Routes` (controller-only + write-only refusal), `financeRbacRoutes` fixtures, `obligationPostingService`/`ledgerPostingService`/`softDeleteDataLayer` mocks, `userRbacDefaults`, permission-matrix UI counts |

## 4. Measured verification
- Fresh PostgreSQL 16 + full `db:migrate`: **38 accounting/finance/audit DB suites / 230 tests** green,
  including the three new suites (16 tests).
- Backend unit **542 files / 3890 tests**; shared **288 files / 2354 tests**; frontend
  **1218 files / 4569 tests** (2 skipped).
- Repo typecheck, ESLint, Prettier, every ratchet (migration hygiene, code norms, DB projections, backend
  boundaries, docs, i18n) and `ci:local --with-db` green; test DB container removed afterwards.

## 5. Documented decisions
1. `accounting.post` is derived from a new `post` module action; the module gate cannot inspect a request
   body, so the post boundary is enforced in the handler (`beforeSave`) with route-level tests.
2. Controller authority covers the four named actions plus the two other batch postings (FX revaluation,
   opening balances); hedge settlement, posting rules, seeding and bank reconciliation stay `write`.
3. System-generated postings are attributed to the request user when present, else `system`, and are not
   gated by `accounting.post` (they are not user-authored vouchers).
4. COA audit is per-row and diff-minimized, so a whole-chart bulk upsert appends one row per changed account
   (bounded by the 2000-row bulk cap) — accepted cost for a complete COA trail.
5. RLS probes in tests `SET LOCAL ROLE` to a plain role because the local test connection is a superuser,
   which bypasses RLS even with FORCE.

## Appendix — reproduction
```bash
docker run -d --name mms-audit-pg -e POSTGRES_PASSWORD=mms -e POSTGRES_USER=mms \
  -e POSTGRES_DB=mms -p 55433:5432 postgres:16-alpine
export DATABASE_URL="postgres://mms:mms@127.0.0.1:55433/mms"
pnpm --filter mms-backend db:migrate
pnpm --filter mms-backend test:db -- accountingRlsCoverageDb accountingTenantIsolationDb accountingAuditAtomicityDb
```
```sql
-- No accounting table may lack forced RLS:
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname LIKE 'accounting\_%'
   AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
-- Audit chain is append-only:
UPDATE audit_trail_events SET new_state = '{}' WHERE workspace_subdomain = '<tenant>'; -- raises
```
