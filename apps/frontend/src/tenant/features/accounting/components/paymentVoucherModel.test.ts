import { describe, expect, it } from "vitest";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import {
  isVoucherPrintable,
  resolveVoucherPrintKind,
  voucherPreparerName,
} from "@/tenant/features/accounting/components/paymentVoucherKind";
import {
  buildPaymentVoucherModel,
  parseSalaryVoucherRef,
} from "@/tenant/features/accounting/components/paymentVoucherModel";
import {
  PAYMENT_VOUCHER_LABEL_KEYS,
  buildPaymentVoucherBody,
} from "@/tenant/features/accounting/components/paymentVoucherHtml";

const account = (id: string, type: Account["type"], name: string): Account => ({
  id,
  code: id.toUpperCase(),
  name,
  type,
  subtype: "",
  description: "",
  isActive: true,
});
const accounts = [
  account("cash", "Asset", "Cash"),
  account("petty", "Asset", "Petty Cash"),
  account("bank", "Asset", "Bank Account"),
  account("sal", "Expense", "Salaries"),
  account("late", "Expense", "Staff Late Deduction"),
  account("fee", "Revenue", "Fees"),
  account("payable", "Liability", "Accounts Payable"),
  account("capital", "Equity", "Capital"),
];
const twoLines = (debitId: string, creditId: string, amount = 500) => [
  { id: "d", account_id: debitId, debit: amount, credit: 0, description: "" },
  { id: "c", account_id: creditId, debit: 0, credit: amount, description: "" },
];

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "je-1",
  date: "2026-09-30",
  ref: "JV-1",
  description: "",
  status: "posted",
  created_by: "",
  tags: [],
  attachments: [],
  fiscal_year: "2026",
  lines: [],
  ...overrides,
});

const salaryLines = [
  {
    id: "l1",
    account_id: "sal",
    debit: 25000,
    credit: 0,
    description: "Salary payment — staff fac-42 (2026-09)",
  },
  {
    id: "l2",
    account_id: "cash",
    debit: 0,
    credit: 25000,
    description: "Salary payment — staff fac-42 (2026-09)",
  },
];

describe("parseSalaryVoucherRef", () => {
  it("given a salary entry with a custom note, should read staff id and pay period from the line description", () => {
    const salary = entry({
      transaction_type: "salary",
      description: "September pay",
      lines: salaryLines,
    });
    expect(parseSalaryVoucherRef(salary)).toEqual({ staffId: "fac-42", payPeriod: "2026-09" });
  });

  it("given no parsable line description, should fall back to the SAL- reference", () => {
    const salary = entry({ transaction_type: "salary", ref: "SAL-2026-08-fac-7", lines: [] });
    expect(parseSalaryVoucherRef(salary)).toEqual({ staffId: "fac-7", payPeriod: "2026-08" });
  });

  it("given a non-salary entry, should return null", () => {
    expect(parseSalaryVoucherRef(entry({ lines: salaryLines }))).toBeNull();
  });
});

describe("resolveVoucherPrintKind", () => {
  it("given a posted expense paid from cash, should print as a cash payment", () => {
    expect(resolveVoucherPrintKind(entry({ lines: salaryLines }), accounts)).toBe("cash_payment");
    expect(isVoucherPrintable(entry({ lines: salaryLines }), accounts)).toBe(true);
  });

  it("given a salary payment, should keep the payment voucher", () => {
    expect(
      resolveVoucherPrintKind(entry({ transaction_type: "salary", lines: salaryLines }), accounts),
    ).toBe("payment");
  });

  it("given petty cash or a bank payment, should name that voucher", () => {
    expect(resolveVoucherPrintKind(entry({ lines: twoLines("sal", "petty") }), accounts)).toBe(
      "petty_cash",
    );
    expect(resolveVoucherPrintKind(entry({ lines: twoLines("payable", "bank") }), accounts)).toBe(
      "bank_payment",
    );
  });

  it("given a draft or archived entry, should not print", () => {
    expect(isVoucherPrintable(entry({ status: "draft", lines: salaryLines }), accounts)).toBe(
      false,
    );
    expect(
      isVoucherPrintable(entry({ deletedAt: "2026-10-01", lines: salaryLines }), accounts),
    ).toBe(false);
  });

  it("given a fee receipt, a transfer, or a non-cash journal, should still print", () => {
    const feeIn = entry({
      lines: [
        { id: "a", account_id: "cash", debit: 500, credit: 0, description: "" },
        { id: "b", account_id: "fee", debit: 0, credit: 500, description: "" },
      ],
    });
    expect(resolveVoucherPrintKind(feeIn, accounts)).toBe("cash_receipt");
    expect(resolveVoucherPrintKind(entry({ lines: twoLines("bank", "fee") }), accounts)).toBe(
      "bank_receipt",
    );
    expect(resolveVoucherPrintKind(entry({ lines: twoLines("bank", "cash") }), accounts)).toBe(
      "journal",
    );
    expect(
      resolveVoucherPrintKind(
        entry({ tags: ["Payroll"], lines: twoLines("capital", "fee") }),
        accounts,
      ),
    ).toBe("journal");
  });
});

describe("voucherPreparerName", () => {
  it("given a recorded entrant, should use that name", () => {
    expect(voucherPreparerName("Amina", "Other")).toBe("Amina");
  });

  it("given a system stamp, should use the signed-in user", () => {
    expect(voucherPreparerName("system", "Amina")).toBe("Amina");
    expect(voucherPreparerName("", "Amina")).toBe("Amina");
  });
});

describe("buildPaymentVoucherModel", () => {
  it("given a salary entry, should total the debits and list the paying account", () => {
    const model = buildPaymentVoucherModel(
      entry({ transaction_type: "salary", lines: salaryLines }),
      accounts,
    );
    expect(model.amount).toBe(25000);
    expect(model.kind).toBe("payment");
    expect(model.particulars).toEqual([{ account: "SAL — Salaries", amount: 25000 }]);
    expect(model.paidFrom).toEqual(["CASH — Cash"]);
    expect(model.deductions).toEqual([]);
    expect(model.netAmount).toBe(25000);
    expect(model.salary?.staffId).toBe("fac-42");
  });

  it("given a salary settled partly by a deduction, should list that deduction and the net cash", () => {
    const model = buildPaymentVoucherModel(
      entry({
        lines: [
          { id: "d", account_id: "payable", debit: 19500, credit: 0, description: "" },
          { id: "c1", account_id: "late", debit: 0, credit: 500, description: "" },
          { id: "c2", account_id: "cash", debit: 0, credit: 19000, description: "" },
        ],
      }),
      accounts,
    );

    expect(model.amount).toBe(19500);
    expect(model.particulars).toEqual([{ account: "PAYABLE — Accounts Payable", amount: 19500 }]);
    expect(model.deductions).toEqual([{ account: "LATE — Staff Late Deduction", amount: 500 }]);
    expect(model.paidFrom).toEqual(["CASH — Cash"]);
    expect(model.netAmount).toBe(19000);
  });

  it("given a cash receipt, should list the income account and the cash account that received it", () => {
    const feeIn = entry({
      lines: [
        { id: "a", account_id: "cash", debit: 500, credit: 0, description: "" },
        { id: "b", account_id: "fee", debit: 0, credit: 500, description: "" },
      ],
    });
    const model = buildPaymentVoucherModel(feeIn, accounts);
    expect(model.layout).toBe("receipt");
    expect(model.particulars).toEqual([{ account: "FEE — Fees", amount: 500 }]);
    expect(model.paidFrom).toEqual(["CASH — Cash"]);
  });
});

describe("buildPaymentVoucherBody", () => {
  it("given untrusted text and no payee, should escape it and render blank receiver signature lines", () => {
    const labels = Object.fromEntries(
      PAYMENT_VOUCHER_LABEL_KEYS.map((key) => [key, key]),
    ) as Record<(typeof PAYMENT_VOUCHER_LABEL_KEYS)[number], string>;
    const html = buildPaymentVoucherBody({
      labels,
      institution: { name: "Madrasa <script>", logoUrl: "", contactLine: "" },
      primaryColor: "#0369a1",
      voucherNo: "JV-1",
      date: "30 Sep 2026",
      fiscalYear: "2026",
      narration: "Electricity & gas",
      payee: null,
      payPeriod: null,
      paidFrom: ["Cash"],
      particulars: [{ account: "Utilities", amount: "Rs 1,000" }],
      deductions: [{ account: "Staff Late Deduction", amount: "Rs 500" }],
      netPaid: "Rs 500",
      journalLines: [],
      amount: "Rs 1,000",
      amountInWords: "One Thousand PKR Only",
      layout: "payment",
      preparedByName: "Amina <script>",
    });
    expect(html).toContain("Madrasa &lt;script&gt;");
    expect(html).toContain("Electricity &amp; gas");
    expect(html).toContain("Amina &lt;script&gt;");
    expect(html).toContain("receivedBy");
    expect(html).toContain("thumbImpression");
    expect(html).toContain("deduction: Staff Late Deduction");
    expect(html).toContain("netPaid");
    expect(html).not.toContain("employeeId");
  });

  it("given a journal voucher, should print debit and credit columns without the receiver block", () => {
    const labels = Object.fromEntries(
      PAYMENT_VOUCHER_LABEL_KEYS.map((key) => [key, key]),
    ) as Record<(typeof PAYMENT_VOUCHER_LABEL_KEYS)[number], string>;
    const html = buildPaymentVoucherBody({
      labels,
      institution: { name: "Madrasa", logoUrl: "", contactLine: "" },
      primaryColor: "#0369a1",
      voucherNo: "JV-2",
      date: "30 Sep 2026",
      fiscalYear: "2026",
      narration: "Opening",
      payee: null,
      payPeriod: null,
      paidFrom: [],
      particulars: [],
      deductions: [],
      netPaid: "",
      journalLines: [
        { account: "Capital", debit: "", credit: "Rs 1,000" },
        { account: "Cash", debit: "Rs 1,000", credit: "" },
      ],
      amount: "Rs 1,000",
      amountInWords: "One Thousand PKR Only",
      layout: "journal",
      preparedByName: "Amina",
    });
    expect(html).toContain("debit");
    expect(html).toContain("credit");
    expect(html).toContain("Amina");
    expect(html).toContain("approvedBy");
    expect(html).toContain("paidBy");
    expect(html).not.toContain("checkedBy");
    expect(html).not.toContain("thumbImpression");
  });
});
