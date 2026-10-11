import { describe, expect, it } from "vitest";
import { sanitizeUnicode } from "./sanitize.js";

describe("sanitizeUnicode", () => {
  it("strips RTL override characters", () => {
    // U+202E is Right-To-Left Override
    const malicious = "Hello\u202EWorld";
    const sanitized = sanitizeUnicode(malicious);
    expect(sanitized).toBe("HelloWorld");
    expect(sanitized).not.toContain("\u202E");
  });

  it("strips LTR override characters", () => {
    // U+202D is Left-To-Right Override
    const malicious = "Hello\u202DWorld";
    const sanitized = sanitizeUnicode(malicious);
    expect(sanitized).toBe("HelloWorld");
  });

  it("leaves normal text untouched", () => {
    const normal = "Hello World 123 !@#";
    expect(sanitizeUnicode(normal)).toBe(normal);
  });

  it("leaves normal Arabic/Urdu text untouched", () => {
    const normal = "مرحبا بالعالم";
    expect(sanitizeUnicode(normal)).toBe(normal);
  });

  it("handles non-strings gracefully", () => {
    // At runtime it could get passed other types if not strictly validated yet
    expect(sanitizeUnicode(null as any)).toBe(null);
    expect(sanitizeUnicode(123 as any)).toBe(123);
  });
});

describe("deepSanitizeStrings", () => {
  it("sanitizes strings nested in objects and arrays", async () => {
    const malicious = {
      name: "Hello\u202EWorld",
      tags: ["\u202DTest", "Safe"],
      nested: {
        value: "Malicious\u202ERune",
        num: 42,
      },
    };

    const { deepSanitizeStrings } = await import("./sanitize.js");
    const sanitized = deepSanitizeStrings(malicious);

    expect(sanitized).toEqual({
      name: "HelloWorld",
      tags: ["Test", "Safe"],
      nested: {
        value: "MaliciousRune",
        num: 42,
      },
    });
  });
});
