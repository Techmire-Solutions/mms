import crypto from "node:crypto";
import {
  type FeeEntryInput,
  type SalaryEntryInput,
  type SpecializedEntryInput,
  type SpecializedEntryResult,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { withTenant } from "../../db/tenant-context.js";
import { financeUseCases } from "../../finance/use-cases/financeUseCases.js";
import { findEntryIdBySource } from "../../db/repositories/accountingRepository.js";
import { accountingUseCases } from "./accountingUseCases.js";

/**
 * Deterministic id derived from the entry's own business identity.
 *
 * Every write in these pipelines is an upsert keyed by id, and `createPayment`
 * returns the existing row when its id is already present — so a replayed
 * submit (double click, retry, refresh) lands on the same rows instead of
 * billing the student or paying the staff member twice. The trade-off is
 * deliberate: two genuinely identical entries on the same date collapse into
 * one, which is the duplicate this guards against.
 */
function stableId(prefix: string, parts: readonly string[]): string {
  return `${prefix}-${crypto.hash("sha256", parts.join("|"), "hex").slice(0, 24)}`;
}

async function processFeeEntry(input: FeeEntryInput): Promise<SpecializedEntryResult> {
  const tenant = getRequestTenant() as string;
  const amount = Number(input.amount);
  const identity = [input.studentId, input.feePeriod, input.amount, input.date] as const;

  const invoice = await financeUseCases.createInvoice({
    id: stableId("inv", identity),
    studentId: input.studentId,
    studentName: input.studentName,
    class: "",
    session: "",
    dueDate: input.date,
    baseFee: amount,
    discountValue: 0,
    discountAmt: 0,
    finalAmt: amount,
    billingPeriod: input.feePeriod,
    status: "pending",
  });
  const payment = await financeUseCases.createPayment({
    id: stableId("pay", identity),
    invoiceId: invoice.id,
    studentId: input.studentId,
    studentName: input.studentName,
    amount,
    date: input.date,
    method: input.paymentMethod,
    note: input.note,
  });

  // `tryPostInvoiceJournal` / `tryPostPaymentJournal` skip silently when the
  // workspace has no posting rules, so ask the ledger directly rather than
  // reporting a posting that never happened.
  const [invoiceEntryId, paymentEntryId] = await Promise.all([
    findEntryIdBySource(tenant, "invoice", invoice.id),
    findEntryIdBySource(tenant, "payment", payment.id),
  ]);

  return {
    type: "fee",
    invoiceId: invoice.id,
    paymentId: payment.id,
    ledgerPosted: Boolean(invoiceEntryId && paymentEntryId),
  };
}

async function processSalaryEntry(
  input: SalaryEntryInput,
  preparerName: string,
): Promise<SpecializedEntryResult> {
  const amount = Number(input.amount);
  const description = `Salary payment — staff ${input.staffId} (${input.payPeriod})`;
  const entry = await accountingUseCases.createJournalEntry({
    id: stableId("je", [input.staffId, input.payPeriod, input.amount, input.date]),
    date: input.date,
    ref: `SAL-${input.payPeriod}-${input.staffId}`,
    description: input.note || description,
    status: "posted",
    created_by: preparerName,
    tags: ["Payroll"],
    attachments: [],
    fiscal_year: "",
    transaction_type: "salary",
    simple_mode: true,
    lines: [
      { id: "l1", account_id: input.expenseAccountId, debit: amount, credit: 0, description },
      { id: "l2", account_id: input.paymentAccountId, debit: 0, credit: amount, description },
    ],
  });
  // A salary entry is written straight to the ledger, so it is always posted.
  return { type: "salary", entryId: entry.id, ledgerPosted: true };
}

/**
 * Cross-module specialized-entry pipeline for the Accounting General Entries
 * quick actions (Fee, Salary). The whole pipeline runs inside one `withTenant`
 * transaction: `createInvoice` / `createPayment` / `createJournalEntry` open no
 * transaction of their own and join this one (nested `withTenant` /
 * `runInTransaction` calls reuse the active transaction), so a failure at any
 * step — including the ledger posting each of those already performs
 * internally via `tryPostInvoiceJournal` / `tryPostPaymentJournal` — rolls back
 * every write made so far.
 */
export async function processSpecializedEntryUseCase(
  input: SpecializedEntryInput,
  actor: { name: string },
): Promise<SpecializedEntryResult> {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  const preparerName = (actor.name.trim() || "system").slice(0, 120);
  return withTenant(tenant, () =>
    input.type === "fee" ? processFeeEntry(input) : processSalaryEntry(input, preparerName),
  );
}
