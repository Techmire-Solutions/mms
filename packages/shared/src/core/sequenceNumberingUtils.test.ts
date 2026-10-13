import { describe, it, expect } from "vitest";
import {
  formatDeterministicSequence,
  buildSequenceFormulaTemplate,
  formatTemplateSequence,
  facultySettingsToSequenceConfig,
  studentSettingsToSequenceConfig,
  financeSettingsToSequenceConfig,
  obligationsSettingsToSequenceConfig,
} from "./sequenceNumberingUtils.js";

describe("sequenceNumberingUtils", () => {
  describe("formatTemplateSequence", () => {
    it("formats standard {seq}-{year} template", () => {
      const result = formatTemplateSequence("{seq}-{year}", 42, 4, new Date(2026, 0, 15));
      expect(result).toBe("0042-2026");
    });

    it("formats short year and prefix in template", () => {
      const result = formatTemplateSequence("GR{yy}{seq}", 1, 3, new Date(2026, 0, 15));
      expect(result).toBe("GR26001");
    });

    it("formats month {mm} in template", () => {
      const result = formatTemplateSequence(
        "{prefix}-{year}-{mm}-{seq}",
        7,
        3,
        new Date(2026, 4, 15),
        "DOC",
      );
      expect(result).toBe("DOC-2026-05-007");
    });
  });

  describe("formatDeterministicSequence", () => {
    it("formats standard employee ID with default options", () => {
      const result = formatDeterministicSequence(
        1,
        {
          prefix: "FAC",
          yearFormat: "YY",
          sequenceDigits: 3,
          delimiter: "",
        },
        new Date(2026, 0, 15),
      );
      expect(result).toBe("FAC26001");
    });

    it("formats student GR number with hyphen delimiter and 4 digits", () => {
      const result = formatDeterministicSequence(
        42,
        {
          prefix: "GR",
          yearFormat: "YYYY",
          sequenceDigits: 4,
          delimiter: "-",
        },
        new Date(2026, 5, 20),
      );
      expect(result).toBe("GR-2026-0042");
    });

    it("formats yearless accounting journal voucher reference", () => {
      const result = formatDeterministicSequence(1, {
        prefix: "JE",
        yearFormat: "NONE",
        sequenceDigits: 4,
        delimiter: "-",
      });
      expect(result).toBe("JE-0001");
    });

    it("handles empty prefix cleanly", () => {
      const result = formatDeterministicSequence(
        5,
        {
          prefix: "",
          yearFormat: "YYYY",
          sequenceDigits: 4,
          delimiter: "-",
        },
        new Date(2026, 1, 1),
      );
      expect(result).toBe("2026-0005");
    });
  });

  describe("buildSequenceFormulaTemplate", () => {
    it("builds template with year token", () => {
      const template = buildSequenceFormulaTemplate({
        delimiter: "",
        yearFormat: "YY",
      });
      expect(template).toBe("{PREFIX}{YY}{SEQ}");
    });

    it("builds template with hyphen delimiter", () => {
      const template = buildSequenceFormulaTemplate({
        delimiter: "-",
        yearFormat: "YYYY",
      });
      expect(template).toBe("{PREFIX}-{YYYY}-{SEQ}");
    });

    it("omits year token when yearFormat is NONE", () => {
      const template = buildSequenceFormulaTemplate({
        delimiter: "-",
        yearFormat: "NONE",
      });
      expect(template).toBe("{PREFIX}-{SEQ}");
    });
  });

  describe("module adapters", () => {
    it("adapts faculty settings accurately", () => {
      const config = facultySettingsToSequenceConfig({
        autoGenerateId: true,
        employeeIdPrefix: "FAC",
        employeeIdYearFormat: "YY",
        employeeIdSequenceDigits: 3,
        employeeIdDelimiter: "",
        idStartSeq: 10,
        idRestartAnnually: true,
        employeeIdCurrentSequence: 5,
        employeeIdLastYear: 2026,
      });
      expect(config.prefix).toBe("FAC");
      expect(config.yearFormat).toBe("YY");
      expect(config.sequenceDigits).toBe(3);
      expect(config.startingSequence).toBe(10);
      expect(config.currentSequence).toBe(5);
    });

    it("adapts student settings accurately", () => {
      const config = studentSettingsToSequenceConfig({
        autoGenerateId: true,
        grNumberTemplate: "GR-{seq}",
        grNumberDigits: 5,
        grNumberRestartAnnually: false,
      });
      expect(config.prefix).toBe("GR");
      expect(config.sequenceDigits).toBe(5);
      expect(config.yearFormat).toBe("NONE");
      expect(config.rolloverPolicy).toBe("never");
    });

    it("adapts finance settings accurately", () => {
      const config = financeSettingsToSequenceConfig({
        autoGenerateInvoice: true,
        invoicePrefix: "BILL",
        invoiceSequenceDigits: 6,
        invoiceDelimiter: "/",
        invoiceYearFormat: "YY",
      });
      expect(config.prefix).toBe("BILL");
      expect(config.sequenceDigits).toBe(6);
      expect(config.delimiter).toBe("/");
      expect(config.yearFormat).toBe("YY");
      expect(config.rolloverPolicy).toBe("annual_calendar");
    });

    it("adapts obligations settings accurately", () => {
      const config = obligationsSettingsToSequenceConfig({
        autoGenerateReceipt: true,
        receiptPrefix: "REC",
        receiptSequenceDigits: 5,
        receiptDelimiter: "-",
        receiptYearFormat: "YYYY",
      });
      expect(config.prefix).toBe("REC");
      expect(config.sequenceDigits).toBe(5);
      expect(config.delimiter).toBe("-");
      expect(config.yearFormat).toBe("YYYY");
      expect(config.rolloverPolicy).toBe("annual_calendar");
    });
  });
});
