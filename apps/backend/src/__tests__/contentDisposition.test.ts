import { validateHeaderValue } from "node:http";
import { describe, expect, it } from "vitest";
import { buildContentDisposition } from "../lib/contentDisposition.js";

describe("buildContentDisposition", () => {
  it("keeps a plain ASCII filename as both filename and filename*", () => {
    const header = buildContentDisposition("students.csv");
    expect(header).toBe(`attachment; filename="students.csv"; filename*=UTF-8''students.csv`);
  });

  it("encodes a localized filename into an ASCII-only header", () => {
    const header = buildContentDisposition("سجل_الرسائل.csv");
    expect(header).toContain(`filename*=UTF-8''`);
    expect(header).toContain(encodeURIComponent("سجل_الرسائل.csv"));
    // The whole header must be Latin-1 safe or Node rejects it at send time.
    expect(() => validateHeaderValue("Content-Disposition", header)).not.toThrow();
    expect(/^[\t\x20-\x7e]*$/.test(header)).toBe(true);
  });

  it("does not let quotes or backslashes break out of the quoted parameter", () => {
    const header = buildContentDisposition('a"b\\c.csv');
    expect(header).toContain(`filename="a_b_c.csv"`);
    expect(() => validateHeaderValue("Content-Disposition", header)).not.toThrow();
  });

  it("encodes apostrophes, parentheses and asterisks per RFC 5987", () => {
    const header = buildContentDisposition("it's (final)*.csv");
    expect(header).toContain("it%27s%20%28final%29%2A.csv");
  });

  it("falls back to a stable name when the filename is empty", () => {
    expect(buildContentDisposition("")).toContain(`filename="download"`);
  });
});
