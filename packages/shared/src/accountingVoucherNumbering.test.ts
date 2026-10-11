import { describe, expect, it } from "vitest";
import {
  DEFAULT_VOUCHER_NUMBERING,
  formatVoucherNumber,
  voucherCalendarYear,
  voucherFormatKey,
  voucherNumberingUpdateSchema,
  voucherSequencePattern,
  type VoucherNumberingUpdate,
} from "./accountingVoucherNumbering.js";

const yearly: VoucherNumberingUpdate = {
  ...DEFAULT_VOUCHER_NUMBERING,
  prefix: "JV",
  delimiter: "/",
  yearFormat: "YYYY",
  rolloverPolicy: "annual_fiscal",
};

describe("voucher numbering", () => {
  it("defaults to the legacy JE-0001 format", () => {
    expect(formatVoucherNumber(7, DEFAULT_VOUCHER_NUMBERING, 2026)).toBe("JE-0007");
    expect(formatVoucherNumber(12345, DEFAULT_VOUCHER_NUMBERING, 2026)).toBe("JE-12345");
  });

  it("prints the given period year through the shared sequence engine", () => {
    expect(formatVoucherNumber(3, yearly, 2025)).toBe("JV/2025/0003");
    expect(formatVoucherNumber(3, { ...yearly, yearFormat: "YY", delimiter: "" }, 2025)).toBe(
      "JV250003",
    );
  });

  it("reads the calendar year of a voucher date", () => {
    expect(voucherCalendarYear("2026-03-01", 2000)).toBe(2026);
    expect(voucherCalendarYear(undefined, 2000)).toBe(2000);
  });

  it("builds a pattern that matches only its own counter period", () => {
    const plain = new RegExp(voucherSequencePattern(DEFAULT_VOUCHER_NUMBERING, 0));
    expect("JE-10000".match(plain)?.[1]).toBe("10000");
    expect(plain.test("JE-2026-0001")).toBe(false);

    const period = new RegExp(voucherSequencePattern(yearly, 2025));
    expect("JV/2025/0042".match(period)?.[1]).toBe("0042");
    expect(period.test("JV/2026/0042")).toBe(false);

    const anyYear = new RegExp(voucherSequencePattern({ ...yearly, rolloverPolicy: "never" }, 0));
    expect("JV/2024/0009".match(anyYear)?.[1]).toBe("0009");
  });

  it("escapes a dot delimiter", () => {
    const pattern = new RegExp(
      voucherSequencePattern({ ...DEFAULT_VOUCHER_NUMBERING, delimiter: "." }, 0),
    );
    expect(pattern.test("JE.0001")).toBe(true);
    expect(pattern.test("JEx0001")).toBe(false);
  });

  it("keys counters by the printed format", () => {
    expect(voucherFormatKey(yearly)).not.toBe(voucherFormatKey({ ...yearly, delimiter: "-" }));
  });

  it("rejects restarting numbering without a year and non-alphanumeric prefixes", () => {
    expect(voucherNumberingUpdateSchema.safeParse({ ...yearly, yearFormat: "NONE" }).success).toBe(
      false,
    );
    expect(voucherNumberingUpdateSchema.safeParse({ ...yearly, prefix: "J.V" }).success).toBe(
      false,
    );
    expect(voucherNumberingUpdateSchema.safeParse({ ...yearly, prefix: "" }).success).toBe(true);
    expect(voucherNumberingUpdateSchema.safeParse(yearly).success).toBe(true);
  });
});
