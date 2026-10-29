# Ledger controls

Advisory implementation/review guidance; existing MMS norms remain in the owning rules listed in the skill. The [verification matrix](verification.md) distinguishes demonstrated controls from requirements needing implementation. External sources and applicability are in [policies](policies-2026.md).

## Exact amounts and currencies

- Persist exact decimal amounts using PostgreSQL numeric columns; use decimal strings at new API boundaries under the existing money rule. Define currency, scale, precision, maximum amount, rounding mode, and rounding stage explicitly. Two decimal places is the current MMS contract, not a universal currency rule.
- For existing numeric DTOs, reuse shared validation and cent helpers, check safe-integer limits on each converted amount **and accumulated totals**, and test boundary values. Do not silently migrate only one caller. A string converted through `Number` before arithmetic can already lose precision; use a coordinated DTO/storage/helper migration when exact decimal or BigInt arithmetic is needed.
- Reject non-finite, over-precision, negative debit/credit, and out-of-range input; signed bank-statement amounts have a different contract. Do not use an epsilon to excuse an unbalanced posted journal or round each intermediate operation without an explicit policy.
- Distinguish transaction currency, functional currency, and display currency. Never sum unlike currencies, infer accounting currency from locale, or make a currency-symbol change re-denominate historical entries. Rates and currency-specific scales need explicit storage before claiming multicurrency support.
- Keep debit/credit equality in the posting currency/basis with explicit rounding or FX gain/loss lines when justified. Presentation rounding must reconcile to published totals; preserve the underlying exact amount.

## Posting state and identity

Review the draft → posted transition separately from create/edit. Drafts can be incomplete under the current contract; posted entries need valid single-sided lines, nonzero balanced totals, active tenant-owned accounts, and an eligible accounting date. Updating an account's type after use also changes report classification: require an explicit historical policy or prohibit that change.

Ordinary writes should not set source keys, posted audit identity, deleted/restored flags, period-close metadata, or approval state. Derive actors from authenticated context, including impersonation and worker origin. Do not mistake setup access for authority to post, pay, reverse, or close.

Treat posted journal content and line identity as immutable. Use a linked reversal or adjustment with reason, original reference, actor, and permitted effective date. Void/refund/credit-note/chargeback workflows should maintain source-to-ledger traceability rather than erase the original event. Prevent duplicate reversals according to the supported full/partial reversal policy.

For idempotency, prefer a stable source/event or client operation ID scoped to tenant and operation, backed by uniqueness and a canonical payload digest. Same key plus equivalent payload returns the original result; changed economic content conflicts. Amount/date/person alone is a duplicate heuristic, not a universal business identity: legitimate equal payments or payroll adjustments may recur. Never let a generic upsert replace an existing posted entry on a create retry.

## Atomicity and concurrency

Use one tenant transaction for source changes, journal header/lines, allocations, and transactional audit/outbox evidence. Acquire the relevant locks **before** reading the state used for validation, and hold them until commit. Row locks cover existing rows; absent IDs need a uniqueness/conditional-insert protocol or transaction advisory locks. MMS journal locks are in `apps/backend/src/db/repositories/accountingEntryLocks.ts`.

Use a consistent lock order for overlapping batches and ensure every competing writer participates. Avoid a stale repeatable-read snapshot after waiting for a lock; choose isolation deliberately. A serializable failure or deadlock needs a bounded retry of the whole transaction, with the same idempotency identity and no duplicated external side effects. Report a conflict after the retry budget, not an unbounded loop.

Entry locks alone do not protect close-versus-post or deactivate-versus-post races. Design a shared period/account protocol, or equivalent constraints and conditional writes, and prove each with two real database connections. A prior active-account lookup or a fiscal-year status check in another transaction is insufficient.

A row `CHECK` cannot prove that all lines of an entry balance. If adding database enforcement, validate the finalized entry across its children at the correct transaction boundary, with draft/import/restore behavior specified. Document direct-SQL/admin bypass boundaries; do not claim database append-only enforcement from application guards alone.

## Billing, collection, disbursement, and imports

- Separate invoice issuance, recognition, payment allocation, settlement, refund, credit note, write-off, and chargeback states. Reconcile receivable/payable subledgers to control accounts. Prevent concurrent allocation from overpaying a balance unless an explicit customer-credit/advance policy supports it.
- Distinguish gross customer receipts, provider fees, refunds, and net bank settlement. Preserve provider IDs and clearing-account movements rather than posting the net deposit as revenue.
- Authenticate provider callbacks, verify signatures/replay limits using the provider's current documentation, handle duplicate/out-of-order events, and reconcile uncertain timeouts against provider state before retrying a charge. The database cannot atomically commit an external bank action; use durable intents/outbox and reconciliation, not an “exactly once” claim.
- Prefer provider-hosted/tokenized card collection. MMS should not collect PAN/CVV. PCI prohibits retaining sensitive authentication data after authorization even encrypted; it is inaccurate to say PCI bans all PAN storage in all systems. Never put secrets or card data into journals, logs, attachments, or retry payloads.
- Imports need preview, mapping/version, duplicate keys, control totals, errors per row, and a clear atomic-batch or checkpoint policy. Preserve original files and provenance subject to retention/access policy. A retry must resume or replay deterministically without double posting.
- For payment approval or maker/checker workflows, specify roles, value thresholds, self-approval prevention, delegation, changed-bank-detail verification, and audit evidence. These are design recommendations until actual server permissions and tests exist; do not invent permission names or assume MFA is already required by every route.
