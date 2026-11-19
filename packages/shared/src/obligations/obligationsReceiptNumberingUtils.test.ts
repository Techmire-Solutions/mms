import { describe, expect, it } from "vitest";
import {
  formatObligationReceiptNumber,
  computeNextObligationReceiptNo,
  obligationReceiptNumberingIsUnambiguous,
  obligationReceiptFormatKey,
  obligationReceiptSequencePattern,
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

  describe("obligationReceiptNumberingIsUnambiguous", () => {
    it("allows restart that never occurs regardless of year format", () => {
      expect(
        obligationReceiptNumberingIsUnambiguous({ rolloverPolicy: "never", yearFormat: "NONE" }),
      ).toBe(true);
    });

    it("allows an annual restart that prints the year", () => {
      expect(
        obligationReceiptNumberingIsUnambiguous({
          rolloverPolicy: "annual_calendar",
          yearFormat: "YYYY",
        }),
      ).toBe(true);
    });

    it("rejects an annual restart with no year segment", () => {
      expect(
        obligationReceiptNumberingIsUnambiguous({
          rolloverPolicy: "annual_calendar",
          yearFormat: "NONE",
        }),
      ).toBe(false);
    });
  });

  describe("obligationReceiptFormatKey", () => {
    it("composes year format, delimiter and prefix into a stable counter identity", () => {
      expect(
        obligationReceiptFormatKey({ prefix: "OBL", delimiter: "-", yearFormat: "YYYY" }),
      ).toBe("YYYY|-|OBL");
    });
  });

  describe("obligationReceiptSequencePattern", () => {
    it("matches a four-digit-year receipt for the calendar period", () => {
      expect(
        obligationReceiptSequencePattern(
          { prefix: "OBL", delimiter: "-", yearFormat: "YYYY" },
          2026,
        ),
      ).toBe("^OBL-2026-(\\d{1,9})$");
    });

    it("matches a two-digit-year receipt for the calendar period", () => {
      expect(
        obligationReceiptSequencePattern({ prefix: "OBL", delimiter: "-", yearFormat: "YY" }, 2026),
      ).toBe("^OBL-26-(\\d{1,9})$");
    });

    it("matches a yearless receipt when numbering never restarts", () => {
      expect(
        obligationReceiptSequencePattern({ prefix: "OBL", delimiter: "-", yearFormat: "NONE" }, 0),
      ).toBe("^OBL-(\\d{1,9})$");
    });

    it("escapes regex metacharacters in the delimiter and prefix", () => {
      expect(
        obligationReceiptSequencePattern(
          { prefix: "REC.1", delimiter: "/", yearFormat: "YYYY" },
          2026,
        ),
      ).toBe("^REC\\.1/2026/(\\d{1,9})$");
    });
  });
});
