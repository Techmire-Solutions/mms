import { describe, expect, it } from "vitest";
import { extractEmployeeId } from "../lib/facultyFormDraft";

describe("extractEmployeeId", () => {
  it("returns trimmed string when input is a string", () => {
    expect(extractEmployeeId("EMP-001")).toBe("EMP-001");
    expect(extractEmployeeId("  EMP-002  ")).toBe("EMP-002");
  });

  it("extracts employeeId from a simple object", () => {
    expect(extractEmployeeId({ employeeId: "EMP-003" })).toBe("EMP-003");
  });

  it("extracts employeeId from nested body wrapper (tsrClient / apiContract format)", () => {
    expect(extractEmployeeId({ status: 200, body: { employeeId: "EMP-004" } })).toBe("EMP-004");
  });

  it("extracts employeeId from nested data wrapper", () => {
    expect(extractEmployeeId({ data: { employeeId: "EMP-005" } })).toBe("EMP-005");
  });

  it("returns empty string for null, undefined, and non-employeeId values", () => {
    expect(extractEmployeeId(null)).toBe("");
    expect(extractEmployeeId(undefined)).toBe("");
    expect(extractEmployeeId({})).toBe("");
    expect(extractEmployeeId(123)).toBe("");
  });
});
