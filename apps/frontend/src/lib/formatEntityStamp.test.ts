import { describe, expect, it } from "vitest";
import { formatEntityStamp } from "@/lib/formatEntityStamp";

describe("formatEntityStamp", () => {
  it("returns a non-empty string unchanged", () => {
    expect(formatEntityStamp("2024-01-15T10:00:00.000Z")).toBe("2024-01-15T10:00:00.000Z");
  });

  it("returns null for empty or whitespace-only strings", () => {
    expect(formatEntityStamp("")).toBeNull();
    expect(formatEntityStamp("   ")).toBeNull();
  });

  it("converts a valid Date to an ISO string", () => {
    const date = new Date("2024-06-01T12:30:00.000Z");
    expect(formatEntityStamp(date)).toBe("2024-06-01T12:30:00.000Z");
  });

  it("returns null for an invalid Date", () => {
    expect(formatEntityStamp(new Date("not-a-date"))).toBeNull();
  });

  it("returns null for non-string, non-Date values", () => {
    expect(formatEntityStamp(123)).toBeNull();
    expect(formatEntityStamp(null)).toBeNull();
    expect(formatEntityStamp(undefined)).toBeNull();
    expect(formatEntityStamp({})).toBeNull();
  });
});
