import { describe, expect, it } from "vitest";
import type { Invoice, Payment } from "../finance/financeModuleManifest.js";
import { paginateFinanceInvoices, paginateFinancePayments } from "../finance/financeListQuery.js";

const invoice: Invoice = {
  id: "inv-1",
  studentId: "student-1",
  studentName: "Student One",
  class: "Class A",
  session: "2026",
  baseFee: 100,
  discountType: null,
  discountValue: 0,
  discountAmt: 0,
  finalAmt: 100,
  status: "pending",
  dueDate: "2026-08-01",
  paidDate: null,
  method: null,
  paidAmt: 0,
};

const payment: Payment = {
  id: "pay-1",
  invoiceId: invoice.id,
  studentName: invoice.studentName,
  amount: 50,
  date: "2026-07-27",
  method: "Cash",
  note: "First installment",
};

describe("finance list pagination", () => {
  it("filters invoices across student and class fields", () => {
    expect(paginateFinanceInvoices([invoice], { search: "class a" }).invoices).toEqual([invoice]);
  });

  it("filters payments and clamps page size", () => {
    const result = paginateFinancePayments([payment], { search: "installment", limit: 999 });
    expect(result.payments).toEqual([payment]);
    expect(result.limit).toBe(100);
  });
});
