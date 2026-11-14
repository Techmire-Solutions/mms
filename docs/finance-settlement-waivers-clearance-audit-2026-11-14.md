# Specialized Subsystem Audit: Settlement, Installments, Waivers & Clearance

Review of the three subsystems the brief names — settlement allocation and reconciliation, installment plans, and waiver/clearance gating — across the **Obligations** module and the modules that actually implement them (**Finance** for settlement and waivers, **Sessions** for the clearance gate).

**Status: reviewed and fixed.** The three real defects (one bypassable gate, one silent allocation drift, one status revival) are closed in this change set; the findings that turned out to be correct already are recorded as verified so they are not "fixed" later. No migration was needed.

---

## 0. Premise correction — where each subsystem actually lives

| Briefed subsystem | Reality |
|---|---|
| Settlement allocation against **obligations and installments** | **Finance only.** `finance_payment_allocations` settles **invoices**. Obligations have no receivable, no balance and no allocation — a collection is money *received*, posted to the GL at the moment it is recorded. |
| Installment plan / recurring schedule | **Absent repo-wide.** `grep -i installment` over `apps/` and `packages/` returns exactly **one** hit: a search string in a finance list-query test. Recurring billing issues **one invoice per `billingPeriod`**, never a divided total. |
| Waivers / exemptions / clearance | **Split.** A "waiver" is a Finance **credit note**. The only dues-based downstream gate in the product is **session completion certificates**. |

So the audit targets the real implementations: `createPayment` / `replacePaymentAllocations` / `applyPaymentDeltas` / `createCreditNote` (Finance) and `loadCompletionGates` + `completionGateViolations` (Sessions).

---

## Findings

### S — Settlement allocation & reconciliation

| # | Sev | Finding | Status |
|---|---|---|---|
| **S1** | HIGH | **The allocation table is write-only.** Nothing reads `finance_payment_allocations` — no report, no reconciliation, no line breakdown. A wrong or orphaned row is invisible by construction. | Recorded (D-report below) |
| **S2** | HIGH | **Allocations are not the source of truth for the balance.** `createPayment` locks and updates exactly one invoice (`payment.invoiceId`) by `invoiceAmount ?? amount`; allocations naming other invoices were stored while those invoices' `paidAmt` never moved — phantom settlement. | **Fixed** |
| **S3** | HIGH | **No allocation invariants.** Σ allocations was never compared with the applied amount (a 100.00 payment could carry a 500.00 allocation), an allocation could target another invoice, and `invoice_line_id` has **no FK** and no reader. | **Fixed** |
| **S4** | — | No FIFO/oldest-due sweep and no unapplied/advance credit: overpayment is rejected (`appliedCents > remainingCents` → 422), so credit cannot sit on account. | Design, recorded |
| **S5** | — *(verified good)* | Reversal reopens the balance correctly: archive → `applyPaymentDeltas(-1)` under `forUpdate`, integer cents, cancelled invoices skipped; restore → `+1`. A "bounce" is modelled as an archive because payments carry **no status column**. | Verified |
| **S6** | — *(not reachable)* | The 4 dp allocation column vs 2 dp `paid_amt` looked like penny drift, but every writer is 2 dp already (`positiveMoneyAmountSchema` enforces two decimals; `settlementInvoiceAmount` rounds through `roundMoneyAmount`). | Verified |

### I — Installment plans & recurring schedules

| # | Sev | Finding |
|---|---|---|
| **I1** | HIGH *(capability gap)* | **No installment engine exists**, so the brief's "100 across 3" remainder case **cannot arise** — and no minor unit is lost today either. |
| **I2** | MEDIUM | Recurring billing is one invoice per `billingPeriod` carrying the **full** fee, skipped when that period was already billed. `finalAmt` is therefore *per period*, not per session — a semantic nothing writes down. |
| **I3** | — | If an installment engine is built, the arithmetic already has two in-repo references: `allocateWakalaSplits` (largest remainder) and `computeLateFee` (BigInt basis points). No new rounding machinery is needed. |

### W — Waivers, exemptions & clearance gating

| # | Sev | Finding | Status |
|---|---|---|---|
| **W1** | MEDIUM | A waiver **is a credit note**, issued in one privileged call (`finance` credit-note authority). No maker-checker, no second approval; `reason` is optional though audited. | Recorded (D1) |
| **W2** | HIGH | **A credit note is append-only: no void, no reversal.** `finance_credit_notes` has no status and no soft-delete; routes are GET+POST. A mistaken waiver is permanent, and because `canCancelInvoice` requires `creditedAmt === 0` the invoice can then never be cancelled — the guard's own message ("Reverse the credit notes…") points at a path that does not exist. | Recorded (D1) |
| **W3** | MEDIUM | A fully waived invoice is relabelled **`status: "paid"`** with `paidAmt = 0`, so "waived" and "settled in cash" are indistinguishable. | Recorded (D2) |
| **W4** | MEDIUM | **Archiving a payment revived a fully credited invoice**: `applyCollectedDelta` derived `paidCents <= 0 ? "pending"`, so a waived invoice whose payment was archived flipped back to collectible. | **Fixed** |
| **W5** | **HIGH (bypassable gate)** | **The completion gate omitted `late_fee_amt`** while the canonical outstanding adds it, so an enrollment owing **only late fees reported zero dues and passed the certificate gate**. | **Fixed** |
| **W6** | — *(verified good)* | The gate is otherwise well guarded: `outstanding_dues` blocks certificate issuance, and an override requires the lock-override permission **and** an acknowledgement of *each* violation **and** a ≥3-char reason, all audited; `markCertificatesIssued` also filters `completion_status = 'completed'`. | Verified |
| **W7** | LOW | Dues gate only the certificate step, not completion **evaluation** — deliberate and commented. | Verified |
| **W8** | LOW | **No exam admit card, no finance hold, no clearance certificate exist**; session **promotion** and **workshop** certificates have no finance reference, so dues gate exactly one workflow. | Recorded (D5) |
| **W9** | LOW | `outstandingDues` sums invoices **across currencies** without grouping. Harmless for the `> 0` gate, meaningless as a displayed amount. | Recorded (D4) |

---

## 1. Settlement allocation & reconciliation

### 1.1 S2 / S3 — what was wrong

`createPayment` guarded the invoice balance precisely (row lock, integer cents, over-application rejected), then wrote the allocation rows with no checks at all:

```ts
const allocations = (record.allocations ?? []).map((allocation, index) => ({ … }));
await replacePaymentAllocations(tenant, payment.id, allocations.length > 0 ? allocations : [default]);
```

Three consequences:

1. Σ allocations was never compared with `invoiceAmount ?? amount` — a 100.00 payment could persist a 500.00 allocation.
2. An allocation could name a **different invoice**; only `payment.invoiceId` had its `paid_amt` moved, so the second invoice's share existed solely as an allocation row.
3. `invoice_line_id` has no foreign key and no reader, so an orphaned line reference was storable.

And nothing could notice: **S1** — no report, dashboard, export or reconciliation reads the table.

### 1.2 What was applied

New pure validator [`financePaymentAllocations.ts`](../packages/shared/src/finance/financePaymentAllocations.ts):

| Violation | Rule |
|---|---|
| `allocation_total_mismatch` | Σ allocations (integer cents) must equal the amount applied to the invoice |
| `allocation_foreign_invoice` | every allocation must target the payment's own invoice, unless the caller declares multi-invoice support |
| `allocation_line_unsupported` | a non-empty `invoiceLineId` is refused until line-level allocation is implemented end to end |

It is called by **both** writers — `createPayment` (before any write, after FX resolution supplies the applied amount) and `updatePaymentById` — and maps to `422 validation_error` with the first violation's message. Rejecting rather than supporting multi-invoice allocation is deliberate: the balance path cannot honour a second invoice, so accepting it is the silent under-settlement this fixes. **No client sends allocations today** (zero hits in `apps/frontend/src`), and the synthesised default still passes.

### 1.3 S5 — reversal, verified

```
archive payment → applyPaymentDeltas(-1) → findInvoicesByIds({ forUpdate: true })
               → applyCollectedDelta(invoice, -applied)  // integer cents
               → status: pending | partial | paid, re-derived from invoiceTotalDue
```
Cancelled invoices are skipped (their posting is already reversed), the row is locked against a concurrent `createPayment`, and the delta uses `invoiceAmount` — the invoice-currency amount — not the cash amount. Restore is the same path with `+1`.

### 1.4 The reconciliation the repo does not have

Recorded for D3 — the query an operator would need to find drift (it must run against a live database):

```sql
-- payments whose allocations do not reconcile with the amount applied
SELECT p.workspace_subdomain, p.id, p.invoice_amount, SUM(a.amount) AS allocated
  FROM finance_payments p
  JOIN finance_payment_allocations a
    ON a.workspace_subdomain = p.workspace_subdomain AND a.payment_id = p.id
 WHERE p.deleted_at IS NULL
 GROUP BY p.workspace_subdomain, p.id, p.invoice_amount
HAVING ROUND(SUM(a.amount) * 100) <> ROUND(COALESCE(p.invoice_amount, p.amount) * 100);

-- invoices whose collected balance does not equal the sum of their allocations
SELECT i.workspace_subdomain, i.id, i.paid_amt, COALESCE(SUM(a.amount), 0) AS allocated
  FROM finance_invoices i
  LEFT JOIN finance_payment_allocations a
    ON a.workspace_subdomain = i.workspace_subdomain AND a.invoice_id = i.id
 WHERE i.deleted_at IS NULL
 GROUP BY i.workspace_subdomain, i.id, i.paid_amt
HAVING ROUND(COALESCE(i.paid_amt, 0) * 100) <> ROUND(COALESCE(SUM(a.amount), 0) * 100);
```

---

## 2. Installment plans & recurring schedules

**There is nothing to audit, and that is the finding.** `grep -i installment` across `apps/` and `packages/` returns one hit — a search string in `financeListQuery.test.ts`. No engine splits a total, so:

- the brief's remainder case (100 / 3 → 33.33 + 33.33 + 33.34) **cannot occur**, and no minor unit is lost;
- recurring billing issues one invoice per period from the fee structure: `buildInvoiceDraftFromEnrollment` bills `finalAmt` (or `baseFee`) for the period, and `shouldSkipGeneratedInvoice` prevents a second invoice for a period already billed by `once` / `monthly` / `term` frequency;
- the only rounding in that path is `Math.max(0, finalAmt)`.

**I2** is the consequence worth writing down: because the amount is per period, a reader who treats `finalAmt` as a session total will be off by the number of periods.

**If it is built** (D6), the arithmetic is already proven twice in this repo: largest-remainder in [`obligationSplitAllocation.ts`](../packages/shared/src/finance/obligationSplitAllocation.ts) (assign the leftover minor unit to the largest fractional part, never to a line that would go negative) and BigInt basis points in [`financeCollect.computeLateFee`](../packages/shared/src/finance/financeCollect.ts#L9). The remaining decision is *where* the remainder goes — first or final installment — which the brief leaves open and the product must choose.

---

## 3. Waivers, exemptions & clearance gating

### 3.1 W5 — the bypassable gate (fixed)

The completion gate computed dues in one lateral:

```sql
SUM(GREATEST(0, fi.final_amt - COALESCE(fi.paid_amt, 0) - fi.credited_amt))
```

while the figure the rest of Finance shows is `finalAmt + lateFeeAmt − creditedAmt − paidAmt`. A student whose only debt was a late fee therefore had `outstandingDues = 0` and **received a completion certificate with money outstanding**.

**Applied:** the lateral now includes `COALESCE(fi.late_fee_amt, 0)`, keeping the same `GREATEST(0, …)` per-invoice clamp so a credit on one invoice cannot mask a debt on another, and the same `deleted_at IS NULL` / `status <> 'cancelled'` / `enrollment_id = e.id` scoping. Pinned by:

- [`sessionCompletionGateDues.test.ts`](../apps/backend/src/__tests__/sessionCompletionGateDues.test.ts) — a source-level assertion that the lateral still contains each component (late fee, paid, credited, clamp, scoping). A single SQL lateral that cannot be executed without a database is exactly where a text assertion earns its keep: removing `late_fee_amt` is otherwise a silent gate bypass.
- [`financeInvoiceAmounts.test.ts`](../packages/shared/src/finance/financeInvoiceAmounts.test.ts) — the canonical rule: a late-fee-only invoice is worth 10, not 0.
- The existing DB integration suite (`sessionCompletionDb`) remains the end-to-end proof in CI.

### 3.2 W6 / W7 — the gate's guardrails, verified

`assertGatesClear` allows an override only when **all three** hold: the caller holds the lock-override permission, every violation is explicitly acknowledged, and the reason is ≥3 characters — and the action is audited with the acknowledged list. `markCertificatesIssued` independently filters `completion_status = 'completed'`, so even a permission-holding caller cannot mint a certificate for a non-completer. Dues gate the certificate step only; evaluation is deliberately exempt (`action === "certificates" ? outstandingDues : 0`) so a term can be closed before every last fee is collected.

### 3.3 W1 / W2 / W3 — the waiver workflow, and its dead end

A waiver is `createCreditNote`: lock the invoice, `canCreditInvoice` (open status, amount ≤ open balance), write the note, add to `creditedAmt`, flip to `paid` when the balance reaches zero, post `Dr Income / Cr AR`, audit with the reason.

- **No approval workflow** (W1): one privileged call, optional reason. If maker-checker is required, it is a new control, not a bug fix (D1).
- **No void** (W2): `finance_credit_notes` has neither a status column nor soft-delete, and there is no reversal route. A wrong waiver is permanent — and it locks `cancelInvoice` out forever, because `canCancelInvoice` demands `creditedAmt === 0`. The guard's message points at a capability that does not exist. Recorded as D1 (schema + reversing journal + unblock).
- **`paid` overloaded** (W3): a fully waived invoice reports `paid` with `paidAmt = 0`, so a status-based report cannot distinguish cash from waiver. Recorded as D2 (a distinct `waived` status is a DB CHECK + DTO + UI change).

### 3.4 W4 — status revival (fixed)

`applyCollectedDelta` derived status from the collected amount alone, so archiving the payment on a fully credited invoice flipped it from `paid` to `pending` — nothing owed, but the directory and the overdue sweep would treat it as collectible. A fully credited invoice (`invoiceTotalDue <= 0` with `creditedAmt > 0`) now stays `paid`; a partially credited invoice still reopens correctly. Pinned in `financePaymentArchiveDeltas.test.ts`.

---

## 4. What landed

| Area | Change |
| --- | --- |
| Shared | new [`financePaymentAllocations.ts`](../packages/shared/src/finance/financePaymentAllocations.ts) (9 tests) + barrel export; late-fee canonical case in `financeInvoiceAmounts.test.ts` |
| Finance write path | allocation invariants enforced before any write in `createPayment` and in `updatePaymentById`; `settlePayment` now takes the validated rows |
| Finance reversal | `applyCollectedDelta` keeps a fully credited invoice settled |
| Sessions gate | `late_fee_amt` added to the completion-gate dues lateral |
| Tests | `financePaymentAllocations.test.ts` (9 new), `financeService.test.ts` +3 (Σ mismatch, foreign invoice, valid split), `financePaymentUpdateGuards.test.ts` +2 (edit path), `financePaymentArchiveDeltas.test.ts` +1 (waived invoice), `sessionCompletionGateDues.test.ts` (5 new) |

## 5. Deferred (with designs)

| ID | Item |
|---|---|
| **D1** | Credit-note **void**: status/reversal columns, reversing journal, and the `canCancelInvoice` unblock. Also where a maker-checker waiver approval would live. |
| **D2** | A distinct `waived` invoice status (DB CHECK + DTO + UI) instead of overloading `paid`. |
| **D3** | An allocation reconciliation report/ops script using the queries in §1.4 — plus the `invoice_line_id` FK if line-level allocation is ever built. |
| **D4** | Dues grouped by currency in the gate payload (the boolean gate is unaffected). |
| **D5** | Admit card / finance hold / dues-gated promotion — product features that do not exist. |
| **D6** | The installment engine, with the remainder-placement decision the brief leaves open. |
| **D7** | Multi-invoice settlement (and/or a FIFO sweep with an advance-credit balance) — `allowMultipleInvoices` exists in the validator for that day. |

## 6. Verification

| Command | Result |
| --- | --- |
| `pnpm typecheck` | 6/6 packages |
| `pnpm --filter @mms/shared test` | 2 393 tests |
| `pnpm --filter mms-backend exec vitest run src/__tests__/finance` | 190 tests (26 files) |
| `financeService.test.ts`, `financePaymentUpdateGuards.test.ts`, `financePaymentArchiveDeltas.test.ts` | 7 + 11 + 5 |
| `sessionCompletionGateDues.test.ts` | 5 tests |
| `node scripts/check-money-safety.mjs`, `check-code-norms.mjs`, `check-docs.mjs`, `pnpm check:i18n` | held |

**Verified later on a live database:** `sessionCompletionDb` (with the new dues expression) passes 3/3 and `financePaymentConcurrencyDb` 2/2, in addition to the source assertion on the gate SQL.

## 7. Assumptions

1. Rejecting multi-invoice allocations is safe: no client sends them and the balance path never supported them (D7 to add it properly).
2. Rejecting `invoiceLineId` is safe: no writer sets it and nothing reads it.
3. The late-fee omission was a defect, not policy — the same repository already counts late fees for reminders and aging, so the gate was the outlier.
4. No migration is created; nothing in this change set needs a live database to accept.
