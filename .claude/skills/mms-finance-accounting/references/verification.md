# Verification, evidence, and skill routing

Advisory review checklist. Existing tests demonstrate only their asserted cases. Add missing regression evidence when implementing a control; do not present recommendations below as universally enforced or a compliance certification.

## Select evidence by risk

| Change | Observable assertions |
|---|---|
| Money/rounding | Exact totals, safe bounds, excessive scale, non-finite values, zero/negative cases, accumulated overflow, deterministic allocation residuals; no mixed-currency summation. |
| Journal create/post/edit | Draft eligibility; posted balance; inactive/foreign-tenant accounts; immutable header and children; unchanged replay; changed replay conflict; forged source/lifecycle/actor fields rejected or server-derived. |
| Concurrent writes | Two real PostgreSQL connections: post versus stale edit, two creates, overlapping bulk writes, allocation conflicts, close versus post, deactivate versus post as applicable. Assert persisted state and absence of partial children. |
| Close/opening | Invalid retained-earnings account, double close, failure rollback, date and declared-year lock checks, lifecycle bypass, unchanged/changed opening replay, no duplicate carry-forward. |
| Reports | Known opening assets plus revenue/expenses; before/after close; comparative windows; actual reversals; correct P&L versus trial-balance rows; all KPIs/charts/exports use equivalent populations. |
| Cash flow | Cash transfers, provider fees, noncash entries, investing/financing flows, FX reconciliation. Compare direct/indirect operating totals, not operating flow to total cash by accident. |
| Bank matching | Foreign tenant/account/currency, duplicate import/match, split settlement, unmatched residual, concurrent match and auditable unmatch. |
| Permissions | Fastify inject allow/deny for actual capabilities; direct API calls, setup versus posting, delegated roles, imports/jobs, and cross-tenant identifiers. |
| Recovery | Partial import/worker retry, uncertain provider outcome, restore control totals, source identities, closed states, attachments/audit evidence, credential exclusion. |

## Current evidence anchors

Read assertions before relying on a filename:

- `packages/shared/src/finance/accountingLedgerInvariants.test.ts`, `packages/shared/src/finance/accountingLedgerOps.test.ts`, `packages/shared/src/finance/accountingReportAggregates.test.ts` — shared contracts/helpers; not database or accounting-framework proof.
- `apps/backend/src/__tests__/accountingUseCases.test.ts` — lifecycle and posted-content guards, create replay and lock-before-validation orchestration with fakes.
- `apps/backend/src/__tests__/accountingPeriodClose.test.ts` — close orchestration and retained-earnings validation.
- `apps/backend/src/__tests__/accountingLedgerGuards.test.ts`, `apps/backend/src/__tests__/ledgerPostingService.test.ts`, `apps/backend/src/__tests__/accountingLedgerOpsUseCases.test.ts` — inspect case-level coverage for the operation.
- `apps/backend/src/__tests__/accounting.integration.test.ts` — route contracts and permission cases with mocked services.
- `apps/backend/src/__tests__/db-integration/accountingConcurrencyDb.integration.test.ts` — PostgreSQL stale draft/post conflict and competing creates.
- `apps/backend/src/__tests__/db-integration/accountingReportDb.integration.test.ts` — real aggregation and closing-report behavior.

These anchors do **not** establish complete safe-integer bounds, monthly-period locking, close/post synchronization, fund accounting, all cash-flow classifications, dual approvals, or universal DB-level posted immutability. Treat each as a capability to inspect and test, not a promise inferred from a schema or this skill.

## Commands

Run from the repository root; use the package names actually declared in the workspace:

```bash
pnpm typecheck
pnpm --filter @mms/shared test -- src/accountingLedgerInvariants.test.ts src/accountingLedgerOps.test.ts src/accountingReportAggregates.test.ts
pnpm --filter mms-backend test -- src/__tests__/accountingUseCases.test.ts src/__tests__/accountingPeriodClose.test.ts src/__tests__/accountingLedgerGuards.test.ts src/__tests__/accountingLedgerOpsUseCases.test.ts src/__tests__/ledgerPostingService.test.ts src/__tests__/accounting.integration.test.ts
pnpm --filter mms-backend test:db -- src/__tests__/db-integration/accountingConcurrencyDb.integration.test.ts src/__tests__/db-integration/accountingReportDb.integration.test.ts
```

Run relevant finance billing/collection tests when those paths change. The ordinary backend suite uses mocks; the opt-in database suite requires a reachable **test** PostgreSQL and isolated fixtures. Require actual assertions to execute; report unavailable infrastructure as blocked verification, not passing skipped tests. Avoid credentials in output. See `mms-testing-e2e` for harnesses and `mms-completion-review.md` for lint, UI, and authorization checks.

For financial bug fixes, prefer a small independently checkable ledger fixture over a snapshot of implementation output. For property-style tests, use deterministic seeds and meaningful invariants (balanced postings, replay stability, allocation totals, balanced round trips); adopt new testing dependencies only through the existing dependency policy.

## Related skills reviewed and their accounting responsibilities

| Skills | Accounting-specific handoff |
|---|---|
| `mms-finance-accounting` | Domain decisions; central references and policy applicability. |
| `mms-reports-export` | Flow/stock/closing semantics, cash-flow classification, issued exports versus live definitions. |
| `mms-audit-trail`, `mms-soft-delete` | Transaction evidence, legal holds, posted-entry lifecycle exception, scoped erasure. |
| `mms-backend-api`, `mms-backend-security` | Server-owned fields, tenant capabilities, replay and transaction boundaries. |
| `mms-schema-migrate`, `mms-shared-package` | Exact amounts, cross-row integrity, source uniqueness, compatible DTO/migration changes. |
| `mms-query-factories`, `mms-form-architecture` | No financial optimistic success; stable retry identity, pending/conflict behavior and invalidation. |
| `mms-module-work`, `mms-module-setup` | Posted entries are not generic editable/trash records; policy changes have historical effects. |
| `mms-settings-i18n`, `mms-i18n-completeness` | Currency/date display versus stored values; RTL signs, identifiers, exports. |
| `mms-background-jobs`, `mms-queue-ops` | Retry-safe imports/postings, durable progress and reconciliation before replay. |
| `mms-backup-restore`, `mms-data-sync` | Restore validation and prevention of legacy collection-write bypasses. |
| `mms-testing-e2e`, `mms-code-review` | Risk-based evidence and independent ledger review. |
| `mms-module-page`, `mms-frontend`, `mms-fields-registry`, `mms-ui-ux-design` | Existing shell, component and field standards apply; they do not define accounting policy. No duplicate accounting rules added. |
| `mms-migration-fixes`, `mms-db-performance`, `mms-error-triage`, `mms-incident-response`, `mms-ops-deploy`, `mms-release-versioning` | Use existing workflows for actual debt, performance, incident, deployment, or release tasks; this skills refresh does not authorize those actions. |

Keep accounting details here instead of copying a new ledger policy into each general-purpose skill. Standards authoring and mirror integrity remain owned by `mms-agent-standards` and `antigravity-workspace`.
