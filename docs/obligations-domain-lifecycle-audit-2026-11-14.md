# Domain Use Cases & Lifecycle State Machine Review: Obligations Module

Review of the **core domain layer** of the Obligations module — `apps/backend/src/obligations/use-cases/`, the state transitions it permits, and the transactional boundaries around its writes — against the Clean Architecture, lifecycle and balance-invariant questions in the brief.

**Status: reviewed and refactored.** The findings below were raised against this repository and the guardrails they call for were applied in the same change set (see [§5](#5-what-landed)). Nothing here required a migration, so a database was not needed to accept the change; the one DB-integration test written for it is opt-in.

---

## 0. Premise correction

The brief describes a **pledge/balance** domain: seven lifecycle states, an assessed amount, installments, waivers, and an outstanding balance. That domain is not in this module. Verified against the use cases, the Drizzle schema, the shared contracts and a module-wide grep — there is no `status`, no `assessed_amount`/`fulfilled_amount`/`waived_amount`/`outstanding_balance`, no installment entity, and no parent-summary update.

The model in the brief is real, but it belongs to **Finance**, and that is where the vocabulary comes from:

| Briefed concept | Where it actually lives |
| --- | --- |
| Draft / Pending / Partially Fulfilled / Fulfilled / Overdue / Waived / Cancelled | `INVOICE_STATUSES = paid \| pending \| overdue \| partial \| cancelled` ([financeInvoiceTypes.ts:8](../packages/shared/src/finance/financeInvoiceTypes.ts#L8)) |
| `assessed − fulfilled − waived == outstanding ≥ 0` | `finalAmt + lateFee − credited − paid`, integer cents, clamped at 0 ([financeInvoiceAmounts.ts:29-41](../packages/shared/src/finance/financeInvoiceAmounts.ts#L29-L41)) |
| "Overdue Obligations" | a dashboard widget over **finance invoices** ([OverdueObligationsWidget.tsx:26-46](../apps/frontend/src/components/dashboard-widgets/OverdueObligationsWidget.tsx#L26-L46)) |
| Obligations with `status` and `dueDate` | only in the CSV contract, which invented both — now removed ([obligationsTransferSchema.ts](../packages/shared/src/dataTransfer/schemas/obligationsTransferSchema.ts)) |

What Obligations actually is: **a receipt ledger**. A collection is money received from a contact, attributed to an obligation type and a mujtahid's representative, split across the wakala's distribution rules, and posted to the general ledger. Its state space is:

```
                 create / save                       archive (delete)
   (none) ───────────────────────▶  active  ───────────────────────────▶  archived
                                     │  ▲                                   │
                    ledger epoch 0   │  │  restore                          │
                    → revision N     │  └───────────────────────────────────┘
                                     │            (reverse run, re-post)
                                     ▼
                         accounting_entries: source_type='obligation'
                         source_id = oc-<sha256(collectionId|epoch)>
                         + reversal entries keyed on the archive timestamp
```

Everything below is audited against **that** model, and every question in the brief maps onto a real defect in it.

---

## Findings matrix

### A. Clean Architecture separation

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| **A1** | HIGH | The domain layer is a **CRUD shell**. `obligationsUseCases` composes `createGenericRelationalService` + `defineTenantBulkCollectionService`, and all 16 original tests assert *delegation*. Module-wide there were exactly two rules: `assertDistributionAccountsValid` and the ledger wiring. | [obligationsUseCases.ts:44-70](../apps/backend/src/obligations/use-cases/obligationsUseCases.ts#L44) |
| **A2** | HIGH | The **controller owned the transaction boundary** (4 read handlers opened `withTenant`) and reached into another module for the voucher lookup. | [obligationContractRouter.ts:49](../apps/backend/src/routes/tenant/obligations/obligationContractRouter.ts#L49) |
| **A3** | HIGH | **Domain errors were flattened to 500**: 7 handlers were `try { … } catch { return 500 database_error }` with no log, and `assertDistributionAccountsValid` threw a bare `Error` with `statusCode` instead of an `HttpDomainError`. | [obligationContractRouter.ts:55](../apps/backend/src/routes/tenant/obligations/obligationContractRouter.ts#L55), [obligationDistributionAccounts.ts:31-35](../apps/backend/src/obligations/use-cases/obligationDistributionAccounts.ts#L31) |
| **A4** | MEDIUM | The one real rule was **bypassed on one of three write paths**: save and replace validated the account mapping, the bulk upsert did not. | [obligationsCatalogUseCases.ts:199](../apps/backend/src/obligations/use-cases/obligationsCatalogUseCases.ts#L199) |
| **A5** | MEDIUM | **Another module's domain lived in the obligations namespace**: the Tasks state machine (`TASK_STATUS_TRANSITIONS`, `isTaskStatusTransitionAllowed`) sat in `packages/shared/src/obligations/` and was imported by `moduleAccessPolicy`, `tasks.contract` and `csvExport.dto`. | [tasksModuleManifest.ts:18-42](../packages/shared/src/tasks/tasksModuleManifest.ts#L18) |
| **A6** | MEDIUM | The **split calculation was duplicated with different normalisation**: the ledger renormalised by the sum of all rules, the frontend divided by the liability sum only — so the rep-dues figure and the posted liability diverged whenever a wakala's percentages ≠ 100. | [obligationPostingLogic.ts:129-130](../packages/shared/src/finance/obligationPostingLogic.ts#L129), [obligationsSummaryCalculations.ts:110-114](../apps/frontend/src/tenant/features/obligations/lib/obligationsSummaryCalculations.ts#L110) |
| **A7** | LOW | The preferences **audit row was written by the controller**. | [obligationContractRouter.ts:179](../apps/backend/src/routes/tenant/obligations/obligationContractRouter.ts#L179) |

### S. Lifecycle state machine

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| **S1** | HIGH | **The briefed machine does not exist.** The real transitions are `active → archived` and `archived → active`, enforced as `already archived` / `already active` **404s from the generic service** — a transport-shaped rule, not a domain one. There is no "cannot cancel a settled obligation" analogue because nothing is settled. | [genericRelationalService.ts:103](../apps/backend/src/services/genericRelationalService.ts#L103) |
| **S2** | HIGH | **The illegal transition this module really has: a receipt recorded for a type/representative pair with no wakala.** The browser filtered the picker; the API did not, and the posting engine then credited **100 % to income**, silently converting a wakala liability into income. | [obligationPostingLogic.ts:116](../packages/shared/src/finance/obligationPostingLogic.ts#L116) |
| **S3** | HIGH | **A catalogue replace could silently destroy split rules.** `mujtahids → mujtahid_reps → wakala_types → obligation_distributions` is a 3-level `ON DELETE CASCADE` (`0068`), and every `replace*ForWorkspace` deletes the rows the caller omitted — so `PUT /mujtahids/bulk` with a shortened list wiped wakalas *and* their rules. Past receipts kept their entries; every later receipt posted 100 % income. | [obligationWakalaRepository.ts:135](../apps/backend/src/db/repositories/obligationWakalaRepository.ts#L135) |
| **S4** | MEDIUM | A wakala and its rules are **one aggregate split across two endpoints and two transactions**; between them the DB held a wakala with no rules. | [useWakalaTypeManager.ts:66](../apps/frontend/src/tenant/features/obligations/hooks/useWakalaTypeManager.ts#L66) |
| **S5** | MEDIUM | **No set-level validation of percentages.** Individual rows are CHECKed 0–100 (migration 0258); nothing rejected a wakala totalling 40 % or 180 %, and the UI accumulated with `parseFloat`. | [useWakalaTypeManager.ts:48](../apps/frontend/src/tenant/features/obligations/hooks/useWakalaTypeManager.ts#L48) |
| **S6** | LOW | Catalogue rows have **no OCC token** — wakala/rep/type edits are last-write-wins, unlike collections (which gained `version` in 0258). | [obligationCatalogTables.ts](../apps/backend/src/db/schema/obligationCatalogTables.ts) |

### B. Balance invariants & transactional boundaries

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| **B1** | HIGH | **There is no balance to be invariant.** Nothing computes `assessed − fulfilled − waived`; the only money aggregate is `sum(amount)` over receipts (exact since the `numeric::text` fix). Every "outstanding" figure is the client-side dues computation. | [obligationRepositoryMetrics.ts:40](../apps/backend/src/db/repositories/obligationRepositoryMetrics.ts#L40) |
| **B2** | — | The invariant the brief wants **is implemented in Finance, correctly** — locked invoice (`forUpdate`), integer cents, `delta > remaining` rejected, cancelled invoices refused. It is the reference pattern, not a defect. | [financePaymentArchiveDeltas.ts:84-110](../apps/backend/src/finance/use-cases/financePaymentArchiveDeltas.ts#L84) |
| **B3** | HIGH | **The create/edit path is still non-atomic with the ledger**: the row commits, then the journal sync runs in another transaction with failures only logged. Archive/restore became atomic in the previous change set; save/create did not. A downgraded amount can commit while the ledger keeps the old value, and nothing reconciles it. | [obligationsUseCases.ts:100](../apps/backend/src/obligations/use-cases/obligationsUseCases.ts#L100) |
| **B4** | MEDIUM | The ledger revision is chosen by probing epochs 0…99 one query at a time, and the epoch is read **before** the row is written (TOCTOU across the two transactions). The OCC token mitigates but does not serialise. | [obligationPostingSources.ts:45](../apps/backend/src/accounting/ledgerPosting/obligationPostingSources.ts#L45) |
| **B5** | — | **No multi-table balance update exists to be atomic.** The brief's "update installment status + parent summary" has no implementation. The only multi-table write is collection + journal entry (+ lines), already one transaction in `persistGeneratedEntry`. | [ledgerPostingHelpers.ts:109](../apps/backend/src/accounting/ledgerPosting/ledgerPostingHelpers.ts#L109) |

### E. Uncovered edge cases

| # | Edge case | Status |
| --- | --- | --- |
| **E1** | Receipt for a type/rep pair with no wakala (S2) | **Closed** — `assertReceiptHasWakala` on every collection write |
| **E2** | Shortened catalogue replace deletes referenced rows (S3) | **Closed** — 409 before the write (FK change deferred, D1) |
| **E3** | Percentages ≠ 100 (S5) | **Closed** on the aggregate write (D-rule: empty set allowed) |
| **E4** | A downward amount edit commits the row even when the reversal is refused by a closed period | Open — B3/D4 |
| **E5** | `obligations:export` / `obligations:import` runners are registered nowhere, so both endpoints answer 503 behind live buttons; the CSV mapping read `title`/`status`/`dueDate`/`notes` fields no record has (a hardcoded `status: "pending"` column) | **Half closed** — the phantom fields are gone; the runners are D3 |
| **E6** | Archiving a receipt whose posting never existed succeeds silently (nothing to reverse, nothing recorded) | Open — D4 |
| **E7** | No reconciliation job for missing/stale postings | Open — D4 |

---

## 1. Clean Architecture separation

### 1.1 A1 — the domain layer was a pass-through

`obligationsUseCases` assembled generic CRUD and bulk services:

```ts
const collectionCrud = createGenericRelationalService<ObligationCollection>({
  repo: { listByWorkspace, findById, save, bulkDelete: …, bulkRestore: … },
  schema: obligationCollectionRecordSchema,
  websocketCollection: "obligation_collections",
  idPrefix: "oc",
});
```

and the test suite pinned exactly that shape ("delegates to the injected repository", 16 times). A layer that only forwards cannot reject anything, which is why every defect in this report reached production.

**Refactor applied.** The rules now exist as a pure domain module, [`obligations/domain/obligationWriteGuards.ts`](../apps/backend/src/obligations/domain/obligationWriteGuards.ts):

| Guard | Rule |
| --- | --- |
| `assertReceiptHasWakala` | a receipt is only postable when its type/representative pair resolves to a wakala |
| `assertSplitRulesComplete` | a wakala's rules total 100 % in basis points, or are empty (the documented "not configured" state) |
| `assertNoCascadingLoss` | a catalogue replace may not delete rows that wakalas or distribution rules still reference |
| `findWakalaForReceipt` | the pair lookup the posting service also uses, extracted so the two cannot drift |

They are pure (no I/O) and covered by [obligationDomainGuards.test.ts](../apps/backend/src/__tests__/obligationDomainGuards.test.ts) — 13 tests, including the float trap (`33.33 + 33.33 + 33.34`) and the "four rules on two cents" allocation.

### 1.2 A2 — the controller owned the transaction and crossed modules

Four read handlers opened the tenant transaction themselves, and the voucher handler called accounting directly:

```ts
const result = await withTenant(String(request.tenant?.id), () => useCases.load…(), { readOnly: true });
const result = await findObligationJournalEntry(String(request.tenant?.id), params.id);
```

**Refactor applied.** `obligationsUseCases` gained `runObligationsRead<T>(operation)` (opens the read transaction for the request tenant) and `loadObligationCollectionVoucher(id)` (wraps the accounting lookup). The router no longer imports `db/tenant-context` or the accounting function.

`check:backend-boundaries` did not catch this: it only bans `db/repositories`, `dbClient` and `drizzle-orm` imports in `routes/`, not `withTenant` or cross-module use of another module's service. That gap is worth closing in the ratchet (recorded as D5).

### 1.3 A3 — domain errors became 500s

Seven handlers were identical:

```ts
try { … } catch { return { status: 500, body: { type: "database_error", … } }; }
```

so a `ValidationError` (400) or `ConflictError` (409) from a use case reached the client as a server fault, with no log line. Two conventions also disagreed: `assertDistributionAccountsValid` threw a plain `Error` carrying `statusCode`, which neither the contract router nor the global error handler recognises.

**Refactor applied.**
- `assertDistributionAccountsValid` throws `ValidationError` (code `obligation_account_invalid`).
- The router maps failures through one helper, `obligationsError(error, fallback)`, built on `mapDomainError`: a domain error keeps its status and `type`, anything unmapped stays a logged 500.
- The contract declares the statuses the use cases can now produce (`400`, `409` on writes, `404` on the voucher), so the client types stay honest.
- Pinned by two new route tests: a `ValidationError` → **400 `validation_error`**, and a raw `Error` → **500 `database_error`**.

### 1.4 A4 — the rule bypassed on one write path

`saveObligationDistribution` and `replaceObligationDistributions` called `assertDistributionAccountsValid`; the bulk upsert did not. Since migration 0258 the FK now catches it, but as a `23503` → 500 rather than a domain 400.

**Refactor applied.** `upsertObligationDistributions` validates before delegating, with a test asserting the repository is never called on a bad account.

### 1.5 A5 — another module's domain in the obligations folder

`packages/shared/src/tasks/tasksModuleManifest.ts` held the entire Tasks state machine and was imported by `moduleAccessPolicy`, `tasks.contract`, `csvExport.dto` and the shared barrel.

**Refactor applied.** Moved to `packages/shared/src/tasks/tasksModuleManifest.ts` (with its two tests); four import sites updated.

### 1.6 A6 — one rule implemented twice

The ledger's `buildObligationPostingLines` renormalised by the sum of all rules; the summary's `buildRepSummary` did `amount * (totalLiabilityPct / 100)`. Whenever a wakala's percentages did not total 100 the screen and the ledger disagreed about what a representative was owed.

**Refactor applied.** `allocateWakalaSplits(totalCents, percentages)` in [obligationSplitAllocation.ts](../packages/shared/src/finance/obligationSplitAllocation.ts) is now the only allocation rule: the ledger builder and the frontend summary both call it, and the summary accumulates in integer cents (it used `+=` on floats). Seven allocator tests pin normalisation, the leftover cent, the sub-cent split and the degenerate all-zero set.

### 1.7 A7 — audit written by the controller

**Refactor applied.** `updateObligationPreferencesService(preferences, actor)` writes the save and its audit row; the controller passes the actor and no longer writes audit itself. A caller without an actor (restore/import) still saves — but now the audit gap is visible in one place instead of being the controller's job.

---

## 2. Lifecycle state machine

### 2.1 S1 — the real transitions, and the missing guard

The module's transitions are archive and restore. Both route through `collectionCrud`, which asks the repository and turns a zero-row update into `NotFoundError("… is already archived")`. The state rule therefore lives in a **transport-shaped** generic service, not in a domain module. Archive/restore also post and reverse the ledger atomically (previous change set), which is the one lifecycle guarantee that is real.

**Recommendation (not applied).** If a status machine is genuinely wanted, the pattern to copy is Finance, not this module: a transition table in `@mms/shared` (like `TASK_STATUS_TRANSITIONS`), a pure `assertTransitionAllowed(from, to)`, and use cases that consult it before writing. That is a new capability (D5), not a refactor.

### 2.2 S2 — the illegal transition that actually existed

```
receipt(type=B, rep=R) where no wakala(type=B, rep=R) exists
   → collection saved
   → resolveDistributionRules() returns []
   → buildObligationPostingLines falls back to the default income account
   → Dr Cash / Cr Income   (the liability the donor intended is never recorded)
```

The browser prevented it (`eligibleRepsForType` only offered reps that have a wakala); the API accepted it.

**Refactor applied.** `assertReceiptHasWakala` runs in `createObligationCollection`, `saveObligationCollection` and `upsertObligationCollections` (one wakala read per batch), rejecting with `400 validation_error` / code `obligation_wakala_required` **before** any write. Tests assert both the rejection and that `bulkSaveObligationCollections` was not called.

**Accepted consequence:** a workspace that recorded receipts against a type/rep pair with no wakala can no longer *edit* those receipts through the bulk save. That is intentional — the edit would re-post the same wrong split — and it is the behaviour change called out in the assumptions.

### 2.3 S3 — cascade deletes as a silent state transition

```
PUT /api/obligations/mujtahids/bulk  [m1]        (m2 omitted)
   └─ replaceMujtahidsForWorkspace → DELETE mujtahids WHERE id NOT IN (m1)
        └─ CASCADE mujtahid_reps of m2
             └─ CASCADE wakala_types of those reps
                  └─ CASCADE obligation_distributions of those wakalas
```

No error, no audit row, no trace. Posted receipts keep their ledger entries; every *future* receipt for those pairs falls into S2's 100 %-income fallback.

**Refactor applied.** `replaceMujtahids`, `replaceMujtahidReps` and `replaceWakalaTypes` compute the doomed ids and ask `repo.countCatalogueDependents(tenant, kind, ids)` what would be lost; a non-zero answer throws `409 catalogue_in_use` naming up to five ids, the wakala count and the rule count. The count lives in a repository ([obligationCatalogueDependentsRepository.ts](../apps/backend/src/db/repositories/obligationCatalogueDependentsRepository.ts)); the *policy* lives in the use case and the message in the domain guard.

**Deferred (D1):** move the three FKs to `RESTRICT` so the database enforces it too, and give the UI an explicit "reassign these rules / delete them" flow. The use-case guard closes the silent-loss hole without a migration.

### 2.4 S4 / S5 — the aggregate, and the missing total

A wakala and its rules were saved by two requests, and nothing checked that a wakala's rules form a set:

```ts
await onChangeWakala([...wakalaTypes, { ...form, id: wakalaId }]);      // transaction 1
await onChangeDistributions([...distributions, ...distsToAdd]);        // transaction 2
```

**Refactor applied.**
- New endpoint `PUT /api/obligations/wakala-aggregate/bulk` → `replaceWakalaAggregate`, which validates the account mappings **and** `assertSplitRulesComplete`, then calls `replaceWakalaAggregateForWorkspace` — one `withTenant` transaction writing wakalas and rules together.
- The UI saves through it (`onSaveAggregate`), with the old two-call sequence kept as a fallback when the prop is absent (the second render site still uses the pair).
- `assertSplitRulesComplete` rejects an incomplete set (`60 %` → "distribution percentages total 60.00%, expected 100%") and accepts the empty set, so a workspace mid-configuration can still save nothing.
- An opt-in DB test proves atomicity: a distribution violating the account FK rolls the wakala insert back.

### 2.5 S6 — catalogue OCC

Deferred (D2). Wakala/rep/type edits remain last-write-wins; the aggregate endpoint is the natural place to add a `version` once it is the only write path.

---

## 3. Balance invariants & transactional boundaries

### 3.1 B1 / B5 — no balance, and nothing to make atomic

Answers to the two direct questions in the brief, stated plainly: **the module has no `assessed − fulfilled − waived` invariant to enforce**, and **there is no multi-table balance update** — no installment status, no parent summary. The only multi-table write is the collection row plus its journal entry, and `persistGeneratedEntry` already wraps that.

### 3.2 B2 — the reference implementation the brief describes

Finance gets it right, and this is the template any future Obligations balance must copy:

```ts
const remainingCents = moneyToCents(getOutstandingAmountForInvoice(invoice));
if (delta > remainingCents) {
  throw Object.assign(new Error("Payment amount exceeds the remaining invoice balance"), {
    statusCode: 422, type: "validation_error",
  });
}
await repo.saveInvoice(tenant, applyCollectedDelta(invoice, delta));
```

Locked read (`forUpdate: true`), integer cents, explicit over-application rejection, cancelled-invoice refusal — one transaction.

### 3.3 B3 / B4 — the two residual transactional gaps

Both are recorded, not re-opened in this change set:

- **B3**: `saveObligationCollection` commits the row, then `postSavedCollection` posts in its own transaction and swallows a failure by design. The mitigation is a same-transaction outbox for the save path (D4), exactly as archive/restore already do.
- **B4**: `findLatestObligationPosting` probes epochs 0…99 one query at a time before the row write. With the OCC token from 0258 a stale save now 409s, so two revisions cannot both claim the same epoch; a single `SELECT … WHERE source_type='obligation' AND source_id LIKE …` (or a stored epoch column) would remove the probe loop.

---

## 4. What the brief's model would require

If the product genuinely wants pledges with assess/fulfil/waive, that is a **new capability**, and the honest design is:

1. New columns on a new `obligation_pledges` entity (not on `obligation_collections`, which is a receipt): `assessed_amount`, `fulfilled_amount`, `waived_amount`, `due_date`, `status`.
2. A transition table in `@mms/shared` — `PLEDGE_STATUS_TRANSITIONS` — mirroring `TASK_STATUS_TRANSITIONS`, with `assertTransitionAllowed` rejecting `settled → cancelled`.
3. A balance row maintained under a row lock, with the Finance invariant (`B2`) and a `CHECK (assessed - fulfilled - waived >= 0)`.
4. A guard that refuses an assessed-amount edit below `fulfilled + waived`, the direct analogue of `delta > remaining`.
5. Installments as children with their own status, updated in the **same** transaction as the parent summary (the aggregate pattern from S4).

Recorded as D5 rather than built, because it needs a product decision, a schema, and a lifecycle the current module does not have.

---

## 5. What landed

| Area | Change |
| --- | --- |
| Domain | new [`obligations/domain/obligationWriteGuards.ts`](../apps/backend/src/obligations/domain/obligationWriteGuards.ts) + 13 tests |
| Use cases | receipt guard on all three collection writes; catalogue cascade guard; `replaceWakalaAggregate`; upsert-path account validation; `runObligationsRead`; `loadObligationCollectionVoucher` |
| Preferences | audit row moved into the service (actor argument) |
| Repository | `replaceWakalaAggregateForWorkspace` (one transaction), `countCatalogueDependents` (+ port, adapter, barrel) |
| Contract/API | `replaceWakalaAggregate` endpoint + `wakalaAggregateBodySchema`; `400`/`409`/`404` declared on the endpoints that can produce them |
| Router | one `obligationsError` mapper on `mapDomainError`; no `withTenant`, no cross-module call, no controller audit |
| Shared | `allocateWakalaSplits` (single allocation rule) consumed by the ledger and the summary; tasks manifest moved out of `obligations/`; transfer schema trimmed of `title`/`status`/`dueDate`/`notes` |
| Frontend | aggregate mutation + single-call wakala save (with the pair as fallback); summary accumulates in integer cents |

Test evidence: domain guards 13, use cases 23 (7 new), contract REST 12 (4 new), allocator 7, DB integration 1 new (opt-in), frontend obligations 79 unchanged.

---

## 6. Deferred

| ID | Item |
| --- | --- |
| **D1** | Move the three catalogue FKs to `RESTRICT` + an explicit reassign/delete flow, so the DB enforces what the use-case guard now checks. |
| **D2** | OCC `version` on `wala_types`/`mujtahid_reps`/`obligation_types` once the aggregate endpoint is the only write path. |
| **D3** | Register `obligations:export` / `obligations:import` runners (name→id resolution for donor/type/rep) **or** hide both buttons. Both endpoints answer 503 today. |
| **D4** | Same-transaction outbox for the save-path ledger sync (B3), plus the reconciliation script for missing/stale postings (E6/E7). |
| **D5** | The pledge/balance domain (§4) — a product decision, not a refactor. |
| **D6** | Extend `check:backend-boundaries` to flag `withTenant` and cross-module service imports in `routes/`, so A2 cannot recur. |
| **D7** | ~~Add `apps/frontend/src/tenant/features/obligations` to `check:money-safety`'s `SCAN_DIRS`~~ — **Done.** The directory is scanned and the eight violations it surfaced are fixed at the source (text-based amount validation and `roundMoneyAmount` on the payload; the percentage inputs use `Number`), with no allow-list widening. |

---

## 7. Verification

Green on this change set (this repository state, no database):

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 6/6 packages |
| `pnpm --filter @mms/shared test` | 2 383 tests |
| `pnpm --filter @mms/shared exec vitest run src/finance src/money src/dataTransfer` | 298 tests (allocator, posting, invoice amounts, transfer schemas) |
| `pnpm --filter mms-backend exec vitest run src/__tests__/obligation* src/__tests__/obligations*` | 75 tests: guards 13, use cases 23, ledger wiring 7, contract REST 12, posting 11 |
| `pnpm --filter mms-frontend exec vitest run src/tenant/features/obligations` | 79 tests |
| `node scripts/check-backend-boundaries.mjs`, `check-backend-structure.mjs` | held |
| `node scripts/check-code-norms.mjs`, `check-docs.mjs`, `pnpm check:i18n` | held |
| `pnpm exec prettier --check` (changed files) | clean |

**Verified later on a live database:** `test:db` ran in a subsequent session. [obligationsPersistenceDb.integration.test.ts](../apps/backend/src/__tests__/db-integration/obligationsPersistenceDb.integration.test.ts) initially failed — its fixtures predated the `0258` composite FKs — and passes 7/7 once the sender/mujtahid parents were seeded; `obligationsTenantIsolation` (run as a `NOBYPASSRLS` role) proves the catalogue tables stay tenant-isolated.
