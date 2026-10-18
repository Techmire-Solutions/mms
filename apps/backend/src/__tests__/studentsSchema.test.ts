import { describe, expect, it } from "vitest";
import { studentRecordSchema } from "@mms/shared";

describe("studentRecordSchema write strip", () => {
  it("strips soft-delete keys on parse", () => {
    const parsed = studentRecordSchema.parse({
      contactId: "c-1",
      status: "active",
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedBy: "u-1",
      deletionReason: "x",
      grNumber: "GR-1",
    }) as Record<string, unknown>;
    expect(parsed.deletedAt).toBeUndefined();
    expect(parsed.deletedBy).toBeUndefined();
    expect(parsed.deletionReason).toBeUndefined();
    expect(parsed.grNumber).toBe("GR-1");
  });
});
