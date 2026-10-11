import { describe, it, expect } from "vitest";
import { stripUndefinedFields } from "../lib/payloadTrimmer.js";

describe("payloadTrimmer", () => {
  it("strips undefined properties from objects", () => {
    const input = {
      id: "123",
      name: "Test",
      missing: undefined,
      nested: {
        a: 1,
        b: undefined,
      },
    };
    const output = stripUndefinedFields(input);
    expect(output).toEqual({
      id: "123",
      name: "Test",
      nested: {
        a: 1,
      },
    });
    expect("missing" in (output as Record<string, unknown>)).toBe(false);
    expect("b" in ((output as Record<string, unknown>).nested as Record<string, unknown>)).toBe(
      false,
    );
  });

  it("preserves explicit null values for schema contract backwards compatibility", () => {
    const input = {
      user: null,
      reason: null,
      count: 0,
      active: false,
    };
    const output = stripUndefinedFields(input);
    expect(output).toEqual({
      user: null,
      reason: null,
      count: 0,
      active: false,
    });
  });

  it("handles arrays and primitives correctly", () => {
    const input = [
      { id: "1", opt: undefined },
      { id: "2", opt: "present" },
    ];
    const output = stripUndefinedFields(input);
    expect(output).toEqual([{ id: "1" }, { id: "2", opt: "present" }]);
  });
});
