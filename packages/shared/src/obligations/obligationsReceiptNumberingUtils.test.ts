import { describe, expect, it } from "vitest";
import {
  formatObligationReceiptNumber,
  computeNextObligationReceiptNo,
  type ObligationCollectionReceiptRecord,
} from "./obligationsReceiptNumberingUtils.js";

describe("obligationsReceiptNumberingUtils", () => {
  describe("formatObligationReceiptNumber", () => {
    it("formats sequence with default settings", () => {
      expect(formatObligationReceiptNumber(1, undefined, new Date(2026, 0, 1))).toBe(
        "OBL-2026-00001",
      );
    });

    it("formats custom prefix, delimiter and digits", () => {
      expect(
        formatObligationReceiptNumber(
          42,
          {
            receiptPrefix: "REC",
            receiptDelimiter: "/",
            receiptYearFormat: "YY",
            receiptSequenceDigits: 4,
          },
          new Date(2026, 5, 15),
        ),
      ).toBe("REC/26/0042");
    });
  });

  describe("computeNextObligationReceiptNo", () => {
    it("formats deterministic sequence with default settings and empty list", () => {
      const result = computeNextObligationReceiptNo([]);
      expect(result).toMatch(/^OBL-\d{4}-00001$/);
    });

    it("increments sequence from existing collection receipt numbers", () => {
      const collections: ObligationCollectionReceiptRecord[] = [
        { receipt_no: "OBL-2026-00001" },
        { receipt_no: "OBL-2026-00005" },
      ];
      const result = computeNextObligationReceiptNo(collections, undefined, "2026-06-15");
      expect(result).toBe("OBL-2026-00006");
    });

    it("respects startingSequence setting when existing collections are below start", () => {
      const collections: ObligationCollectionReceiptRecord[] = [{ receipt_no: "OBL-2026-00002" }];
      const result = computeNextObligationReceiptNo(
        collections,
        { receiptStartingSequence: 100 },
        "2026-06-15",
      );
      expect(result).toBe("OBL-2026-00100");
    });

    it("returns empty string when autoGenerateReceipt is false", () => {
      const result = computeNextObligationReceiptNo([], { autoGenerateReceipt: false });
      expect(result).toBe("");
    });
  });
});
