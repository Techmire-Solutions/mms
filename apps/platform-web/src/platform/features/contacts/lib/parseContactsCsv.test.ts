import { describe, expect, it } from "vitest";
import { parseContactsCsv } from "@/platform/features/contacts/lib/parseContactsCsv";

describe("parseContactsCsv", () => {
  it("parses valid rows with default kind", () => {
    const csv = "name,email,phone,kind\nJane Doe,jane@example.com,+15550001111,\n";
    const { rows, errors } = parseContactsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+15550001111",
        kind: "external",
        tags: [],
        notes: null,
      },
    ]);
  });

  it("reports missing-name rows and unknown kinds", () => {
    const csv = "name,email,phone,kind\n,someone@example.com,+1,bogus\n";
    const { rows, errors } = parseContactsCsv(csv);
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 2, error: "Missing name" }]);
  });

  it("reports a missing name header", () => {
    const { rows, errors } = parseContactsCsv("email,phone\nx@y.com,+1\n");
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ row: 1, error: "Missing required 'name' header" }]);
  });
});
