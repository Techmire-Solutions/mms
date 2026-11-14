import { describe, expect, it } from "vitest";
import {
  obligationsImportBodySchema,
  obligationsImportRowSchema,
} from "../schemas/opsModuleImport.dto.js";

/**
 * The import blueprint must describe the same document the dialog asks for.
 *
 * The dialog builds its columns from `obligationsTransferSchema` (the SSOT: receiptNo, receivedDate,
 * donorName, representative, amount, currency, paymentMode, reference). The endpoint's row schema
 * used to be a copy of the tasks blueprint — `title`/`status`/`dueDate`, no receipt field required,
 * `.passthrough()` — so a real row passed unvalidated and the declared fields did not exist on an
 * obligation (audit T5).
 */

const receiptRow = {
  receiptNo: "OB-2026-0001",
  receivedDate: "2026-10-24",
  donorName: "Haji Ghulam",
  representative: "Sayyid Ja'far",
  amount: "50000.00",
  currency: "PKR",
  paymentMode: "Cash",
  reference: "Bank slip 88213",
};

describe("obligations import blueprint", () => {
  it("accepts a receipt row shaped like the SSOT transfer columns", () => {
    expect(obligationsImportRowSchema.parse(receiptRow)).toMatchObject({
      receiptNo: "OB-2026-0001",
      receivedDate: "2026-10-24",
      amount: "50000.00",
    });
  });

  it("accepts a number amount and normalises it to its decimal string", () => {
    const parsed = obligationsImportRowSchema.parse({ ...receiptRow, amount: 50000 });
    expect(parsed.amount).toBe("50000");
  });

  it.each(["receiptNo", "receivedDate", "donorName", "representative", "amount"])(
    "rejects a row without %s",
    (field) => {
      const row: Record<string, unknown> = { ...receiptRow };
      delete row[field];
      expect(obligationsImportRowSchema.safeParse(row).success).toBe(false);
    },
  );

  it("rejects the old tasks shape instead of silently carrying it", () => {
    // `title`, `status` and `dueDate` do not exist on an obligation receipt; `.strict()` reports
    // them so the operator learns the file is the wrong document.
    const result = obligationsImportRowSchema.safeParse({
      title: "Khums",
      status: "Pending",
      dueDate: "2026-11-01",
      donorName: "Haji Ghulam",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payment mode the receipt DTO cannot store", () => {
    expect(
      obligationsImportRowSchema.safeParse({ ...receiptRow, paymentMode: "Cheque" }).success,
    ).toBe(false);
  });

  it("rejects an amount with more than two decimals", () => {
    expect(
      obligationsImportRowSchema.safeParse({ ...receiptRow, amount: "50000.001" }).success,
    ).toBe(false);
  });

  it("rejects a malformed received date", () => {
    expect(
      obligationsImportRowSchema.safeParse({ ...receiptRow, receivedDate: "24/10/2026" }).success,
    ).toBe(false);
  });

  it("wraps rows in the import envelope and caps the batch", () => {
    const body = obligationsImportBodySchema.parse({ rows: [receiptRow] });
    expect(body.rows).toHaveLength(1);
    expect(obligationsImportBodySchema.safeParse({ rows: [] }).success).toBe(false);
  });
});
