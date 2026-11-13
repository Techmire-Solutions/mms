import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_ENTRIES_BULK_CAP,
  journalEntryWriteListSchema,
  journalEntryWriteSchema,
} from "./accountingRecordLists.js";
import { feeEntrySchema, salaryEntrySchema } from "./accountingSpecializedEntries.js";
import type { JournalEntry } from "./accountingModuleManifest.js";

const line = (id: string, account: string, debit: number, credit: number) => ({
  id,
  account_id: account,
  debit,
  credit,
  description: "",
});

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  id: "je-1",
  date: "2026-11-01",
  ref: "JE-1",
  description: "Test",
  status: "posted",
  created_by: "u1",
  tags: [],
  attachments: [],
  fiscal_year: "2026",
  lines: [line("l1", "cash", 0.1, 0), line("l2", "cash", 0.2, 0), line("l3", "fees", 0, 0.3)],
  ...overrides,
});

const issueMessages = (result: ReturnType<typeof journalEntryWriteSchema.safeParse>): string[] =>
  result.success ? [] : result.error.issues.map((issue) => issue.message);

describe("journal entry write schema", () => {
  it("accepts a balanced posted voucher", () => {
    expect(journalEntryWriteSchema.safeParse(entry()).success).toBe(true);
  });

  it("rejects an unbalanced posted voucher with a lines path", () => {
    const result = journalEntryWriteSchema.safeParse(
      entry({ lines: [line("l1", "cash", 10, 0), line("l2", "fees", 0, 9)] }),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["lines"]);
    expect(issueMessages(result)).toContain("accounting.voucher.unbalanced");
  });

  it("rejects a posted voucher with a two-sided line", () => {
    const result = journalEntryWriteSchema.safeParse(
      entry({ lines: [line("l1", "cash", 10, 10), line("l2", "fees", 0, 0)] }),
    );

    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain("accounting.voucher.unbalanced");
  });

  it("rejects a posted voucher that does not balance in its transaction currency", () => {
    const result = journalEntryWriteSchema.safeParse(
      entry({
        lines: [
          {
            ...line("l1", "cash", 2800, 0),
            txn_currency: "USD",
            txn_debit: "10.00",
            txn_credit: "0",
          },
          {
            ...line("l2", "fees", 0, 2800),
            txn_currency: "USD",
            txn_debit: "0",
            txn_credit: "9.00",
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain("accounting.voucher.unbalanced");
  });

  it("allows an unbalanced draft", () => {
    const result = journalEntryWriteSchema.safeParse(
      entry({ status: "draft", lines: [line("l1", "cash", 10, 0)] }),
    );
    expect(result.success).toBe(true);
  });

  it("caps the bulk body", () => {
    expect(ACCOUNTING_ENTRIES_BULK_CAP).toBe(2000);
    const body = Array.from({ length: ACCOUNTING_ENTRIES_BULK_CAP + 1 }, (_, index) =>
      entry({ id: `je-${index}` }),
    );
    expect(journalEntryWriteListSchema.safeParse(body).success).toBe(false);
  });
});

describe("specialized entry money validation", () => {
  const fee = (amount: string) => ({
    type: "fee",
    date: "2026-11-01",
    note: "",
    studentId: "s1",
    studentName: "Student",
    feePeriod: "2026-11",
    amount,
    paymentMethod: "cash",
  });

  const salary = (amount: string) => ({
    type: "salary",
    date: "2026-11-01",
    note: "",
    staffId: "st1",
    payPeriod: "2026-11",
    amount,
    expenseAccountId: "exp",
    paymentAccountId: "cash",
  });

  it("accepts 2-dp decimal strings", () => {
    expect(feeEntrySchema.safeParse(fee("12.5")).success).toBe(true);
    expect(salaryEntrySchema.safeParse(salary("0")).success).toBe(true);
  });

  it("rejects more than four storage decimals and oversized integers", () => {
    // The canonical decimal schema bounds the integer part (15) and decimals (4).
    expect(feeEntrySchema.safeParse(fee("12.345678")).success).toBe(false);
    expect(salaryEntrySchema.safeParse(salary("1234567890123456")).success).toBe(false);
    expect(feeEntrySchema.safeParse(fee("-5")).success).toBe(false);
  });
});
