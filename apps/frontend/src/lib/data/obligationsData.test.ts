import { describe, expect, it } from "vitest";
import { generateReceiptNo } from "./obligationsData";
import type { ObligationCollection } from "@mms/shared";

describe("generateReceiptNo", () => {
  it("formats deterministic sequence with default settings and empty list", () => {
    const result = generateReceiptNo([]);
    expect(result).toMatch(/^OBL-\d{4}-00001$/);
  });

  it("increments sequence from existing collection receipt numbers", () => {
    const collections = [
      { receipt_no: "OBL-2026-00001" },
      { receipt_no: "OBL-2026-00005" },
    ] as ObligationCollection[];

    const result = generateReceiptNo(collections, undefined, "2026-06-15");
    expect(result).toBe("OBL-2026-00006");
  });

  it("supports yearless receipt format when configured", () => {
    const collections = [{ receipt_no: "REC-00042" }] as ObligationCollection[];
    const result = generateReceiptNo(
      collections,
      {
        receiptPrefix: "REC",
        receiptYearFormat: "NONE",
        receiptSequenceDigits: 5,
        receiptDelimiter: "-",
      },
      "2026-06-15",
    );
    expect(result).toBe("REC-00043");
  });

  it("returns empty string when autoGenerateReceipt is false", () => {
    const result = generateReceiptNo([], { autoGenerateReceipt: false });
    expect(result).toBe("");
  });
});
