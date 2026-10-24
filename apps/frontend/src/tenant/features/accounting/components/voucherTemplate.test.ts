import { describe, expect, it } from "vitest";
import { PAGE_SIZES } from "@mms/shared";
import {
  buildVoucherTemplate,
  voucherLayoutCopy,
} from "@/tenant/features/accounting/lib/voucherTemplateLayout";
import { buildVoucherTemplateHtml } from "@/tenant/features/accounting/lib/voucherTemplateHtml";
import {
  voucherTableLines,
  type VoucherPrintPayload,
} from "@/tenant/features/accounting/lib/voucherTemplateModel";
import type { PaymentVoucherModel } from "@/tenant/features/accounting/lib/paymentVoucherModel";

const copy = voucherLayoutCopy((key) => key);

function blankPayload(overrides: Partial<VoucherPrintPayload> = {}): VoucherPrintPayload {
  return {
    title: "Payment Voucher",
    institution: "Dar Ul Quran",
    contactLine: "",
    voucherNo: "JE-1",
    date: "09/10/2026",
    fiscalYear: "2025-2026",
    partyLabel: "Paid To",
    partyName: "",
    employeeIdLabel: "",
    employeeId: "",
    designationLabel: "",
    designation: "",
    payPeriodLabel: "",
    payPeriod: "",
    purpose: "Salary",
    sourceLabel: "Paid From",
    sourceValue: "Cash",
    lines: [],
    amount: "19500",
    netPaid: "19000",
    amountInWords: "Nineteen thousand",
    preparedBy: "Amina",
    receiverName: "",
    receiverId: "",
    receiverSign: "",
    receiverDate: "",
    ...overrides,
  };
}

describe("voucher template", () => {
  it("keeps every A6 element inside the A6 page and scales the same fields onto A5", () => {
    const a6 = buildVoucherTemplate("A6", copy);
    const a5 = buildVoucherTemplate("A5", copy);
    const a6No = a6.elements.find((el) => el.field === "voucherNo");
    const a5No = a5.elements.find((el) => el.field === "voucherNo");
    expect(a6.pageSize).toBe("A6");
    expect(a5.pageSize).toBe("A5");
    expect(a6No).toBeDefined();
    expect(a5No && a6No && a5No.x).toBeGreaterThan(a6No?.x ?? 0);
    for (const el of a6.elements) {
      expect(el.x + el.w).toBeLessThanOrEqual(PAGE_SIZES.A6.width);
      expect(el.y + el.h).toBeLessThanOrEqual(PAGE_SIZES.A6.height);
    }
    for (const el of a5.elements) {
      expect(el.x + el.w).toBeLessThanOrEqual(PAGE_SIZES.A5.width);
      expect(el.y + el.h).toBeLessThanOrEqual(PAGE_SIZES.A5.height);
    }
  });

  it("escapes untrusted voucher text and prints a deduction on its own row", () => {
    const template = buildVoucherTemplate("A6", copy);
    const html = buildVoucherTemplateHtml({
      template,
      logoUrl: "",
      direction: "ltr",
      data: blankPayload({
        voucherNo: "JE <1>",
        lines: [{ account: "Less: Late", debit: "", credit: "500", amount: "500" }],
      }),
    });
    expect(html).toContain("JE &lt;1&gt;");
    expect(html).toContain("Less: Late");
    expect(html).toContain(`width:${PAGE_SIZES.A6.width}px`);
    expect(html).not.toContain("JE <1>");
  });

  it("puts salary deductions on a credit line and journal rows on debit and credit", () => {
    const payment: PaymentVoucherModel = {
      kind: "payment",
      layout: "payment",
      amount: 19500,
      netAmount: 19000,
      particulars: [{ account: "Salaries payable", amount: 19500 }],
      deductions: [{ account: "Staff Late Deduction", amount: 500 }],
      paidFrom: ["Cash"],
      journalLines: [],
      salary: { staffId: "1", payPeriod: "2026-09" },
    };
    expect(
      voucherTableLines(payment, (amount) => String(amount), "Less").map((row) => row.account),
    ).toEqual(["Salaries payable", "Less: Staff Late Deduction"]);

    const journal: PaymentVoucherModel = {
      ...payment,
      kind: "journal",
      layout: "journal",
      particulars: [],
      deductions: [],
      journalLines: [
        { account: "Cash", debit: 1000, credit: 0 },
        { account: "Capital", debit: 0, credit: 1000 },
      ],
    };
    expect(voucherTableLines(journal, (amount) => String(amount), "Less")).toEqual([
      { account: "Cash", debit: "1000", credit: "", amount: "" },
      { account: "Capital", debit: "", credit: "1000", amount: "" },
    ]);
  });
});
