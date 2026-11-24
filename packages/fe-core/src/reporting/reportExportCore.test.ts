import { describe, expect, it } from "vitest";
import { sanitizeExportValue } from "./reportExportCore";

describe("sanitizeExportValue", () => {
  it("neutralises formula-looking cells", () => {
    for (const value of ["=SUM(A1)", "+1+1", "@cmd", "|calc", "%calc", "\t=1", "\r=1", "  =2"]) {
      expect(sanitizeExportValue(value)).toBe(`'${value}`);
    }
  });

  it("keeps plain negative numbers numeric", () => {
    for (const value of ["-100", "-100.50", "-.5", "-1e3"]) {
      expect(sanitizeExportValue(value)).toBe(value);
    }
    expect(sanitizeExportValue(-100.5)).toBe(-100.5);
  });

  it("leaves ordinary text unchanged", () => {
    expect(sanitizeExportValue("Tuition fees")).toBe("Tuition fees");
    expect(sanitizeExportValue(null)).toBe("");
    expect(sanitizeExportValue(100)).toBe(100);
  });
});
