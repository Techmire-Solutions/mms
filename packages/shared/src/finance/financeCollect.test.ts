import { describe, expect, it } from "vitest";
import {
  canApplyLateFee,
  canCancelInvoice,
  canCreditInvoice,
  canMarkInvoiceOverdue,
  computeLateFee,
  invoiceOpenBalance,
  isInvoiceDueForReminder,
  isInvoicePastDue,
  resolveFamilyContactId,
  wasRemindedRecently,
} from "./financeCollect.js";

const open = {
  status: "pending" as const,
  dueDate: "2026-08-01",
  finalAmt: 100,
  paidAmt: 0,
  lateFeeAmt: 0,
  creditedAmt: 0,
};

describe("financeCollect", () => {
  it("computes a percent late fee to cents", () => {
    expect(computeLateFee(200, 5)).toBe(10);
    expect(computeLateFee(100, 0)).toBe(0);
  });

  it("marks overdue and applies a late fee only once after the due date", () => {
    expect(isInvoicePastDue("2026-08-01", "2026-09-01")).toBe(true);
    expect(canMarkInvoiceOverdue(open, "2026-09-01")).toBe(true);
    expect(canApplyLateFee(open, 5, "2026-09-01")).toBe(true);
    expect(canApplyLateFee({ ...open, lateFeeAmt: 10 }, 5, "2026-09-01")).toBe(false);
  });

  it("opens a reminder window before the due date and cooldown after a send", () => {
    expect(isInvoiceDueForReminder("2026-09-10", 3, "2026-09-08")).toBe(true);
    expect(isInvoiceDueForReminder("2026-09-10", 3, "2026-09-06")).toBe(false);
    expect(wasRemindedRecently(new Date().toISOString())).toBe(true);
    expect(wasRemindedRecently(null)).toBe(false);
  });

  it("nets late fees and credit notes into the open balance", () => {
    expect(invoiceOpenBalance({ ...open, lateFeeAmt: 10, creditedAmt: 20, paidAmt: 15 })).toBe(75);
    expect(invoiceOpenBalance({ ...open, status: "cancelled" })).toBe(0);
    expect(canCreditInvoice({ ...open, lateFeeAmt: 10 }, 50)).toBe(true);
    expect(canCreditInvoice(open, 200)).toBe(false);
    expect(canCancelInvoice(open)).toBe(true);
    expect(canCancelInvoice({ ...open, paidAmt: 10 })).toBe(false);
    // A credit note posts its own Dr Income / Cr AR entry, and cancelling an
    // invoice reverses only the invoice entry — so a partially credited invoice
    // left behind a credit AR balance and negative revenue.
    expect(canCancelInvoice({ ...open, creditedAmt: 30 })).toBe(false);
    expect(canCancelInvoice({ ...open, creditedAmt: 0 })).toBe(true);
  });

  it("prefers guardian, then father, then the student contact", () => {
    expect(
      resolveFamilyContactId({ guardianContactId: "g1", fatherContactId: "f1", contactId: "s1" }),
    ).toBe("g1");
    expect(resolveFamilyContactId({ fatherContactId: "f1", contactId: "s1" })).toBe("f1");
    expect(resolveFamilyContactId({ contactId: "s1" })).toBe("s1");
    expect(resolveFamilyContactId(null)).toBeNull();
  });
});
