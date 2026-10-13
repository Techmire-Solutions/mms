import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "./rfc8785CanonicalJson.js";

describe("rfc8785CanonicalJson (JSON Canonicalization Scheme)", () => {
  it("canonicalizes primitives accurately", () => {
    expect(canonicalizeJson(null)).toBe("null");
    expect(canonicalizeJson(true)).toBe("true");
    expect(canonicalizeJson(false)).toBe("false");
    expect(canonicalizeJson(42)).toBe("42");
    expect(canonicalizeJson(-42)).toBe("-42");
    expect(canonicalizeJson(0)).toBe("0");
    expect(canonicalizeJson(-0)).toBe("0");
    expect(canonicalizeJson(3.14159)).toBe("3.14159");
    expect(canonicalizeJson("hello")).toBe('"hello"');
    expect(canonicalizeJson("")).toBe('""');
  });

  it("escapes control characters and quotes strictly per RFC 8785", () => {
    expect(canonicalizeJson('quote: " and backslash: \\')).toBe('"quote: \\" and backslash: \\\\"');
    expect(canonicalizeJson("line\nbreak\tand\rreturn")).toBe('"line\\nbreak\\tand\\rreturn"');
    expect(canonicalizeJson("formfeed\fbackspace\b")).toBe('"formfeed\\fbackspace\\b"');
    expect(canonicalizeJson("\u0000\u001f")).toBe('"\\u0000\\u001f"');
    // Forward slash is NOT escaped in RFC 8785
    expect(canonicalizeJson("https://example.com/api/test")).toBe('"https://example.com/api/test"');
    // Unicode characters beyond 0x1F are preserved directly
    expect(canonicalizeJson("مرحبا بالعالم - سلام")).toBe('"مرحبا بالعالم - سلام"');
  });

  it("sorts object keys strictly by UTF-16 code units", () => {
    const unordered = {
      z: 1,
      a: 2,
      m: 3,
      _hidden: 4,
      10: 5,
      2: 6,
    };
    // Expected sorted order: "10", "2", "_hidden", "a", "m", "z"
    expect(canonicalizeJson(unordered)).toBe('{"10":5,"2":6,"_hidden":4,"a":2,"m":3,"z":1}');
  });

  it("handles nested structures deterministically regardless of insertion order", () => {
    const objA = {
      name: "Alice",
      profile: {
        role: "admin",
        age: 30,
        active: true,
      },
      tags: ["security", "audit"],
    };

    const objB = {
      tags: ["security", "audit"],
      profile: {
        active: true,
        age: 30,
        role: "admin",
      },
      name: "Alice",
    };

    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
    expect(canonicalizeJson(objA)).toBe(
      '{"name":"Alice","profile":{"active":true,"age":30,"role":"admin"},"tags":["security","audit"]}',
    );
  });

  it("omits undefined properties and converts undefined in arrays to null", () => {
    const input = {
      valid: 123,
      absent: undefined,
      items: [1, undefined, 2],
    };
    expect(canonicalizeJson(input)).toBe('{"items":[1,null,2],"valid":123}');
  });

  it("throws on non-finite numbers", () => {
    expect(() => canonicalizeJson(NaN)).toThrow(TypeError);
    expect(() => canonicalizeJson(Infinity)).toThrow(TypeError);
    expect(() => canonicalizeJson(-Infinity)).toThrow(TypeError);
  });
});
