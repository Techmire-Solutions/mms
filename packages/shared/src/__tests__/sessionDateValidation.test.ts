import { describe, expect, it } from "vitest";
import { SessionInsertSchema } from "../sessions/sessionTypes.js";
import {
  SessionClassRefreshmentInsertSchema,
  SessionClassScheduleInsertSchema,
} from "../sessions/sessionSubEntityTypes.js";

describe("session calendar-date validation", () => {
  it("rejects impossible and malformed session dates", () => {
    for (const startDate of ["2026-02-31", "2026-13-01", "banana", "2026-1-1"]) {
      const result = SessionInsertSchema.safeParse({ name: "Term", startDate });
      expect(result.success, `startDate=${startDate}`).toBe(false);
    }
  });

  it("accepts a real date and the empty-string 'no date' form", () => {
    expect(SessionInsertSchema.safeParse({ name: "Term", startDate: "2026-03-01" }).success).toBe(
      true,
    );
    const empty = SessionInsertSchema.parse({ name: "Term" });
    expect(empty.startDate).toBe("");
    expect(empty.endDate).toBe("");
  });

  it("rejects an impossible end date even when start is valid", () => {
    const result = SessionInsertSchema.safeParse({
      name: "Term",
      startDate: "2026-03-01",
      endDate: "2026-02-31",
    });
    expect(result.success).toBe(false);
  });

  it("validates class schedule and refreshment dates", () => {
    expect(
      SessionClassScheduleInsertSchema.safeParse({
        scheduleType: "daily",
        startDate: "2026-02-31",
        endDate: "2026-03-01",
      }).success,
    ).toBe(false);
    expect(
      SessionClassRefreshmentInsertSchema.safeParse({
        date: "not-a-date",
        item: "Tea",
      }).success,
    ).toBe(false);
    expect(
      SessionClassRefreshmentInsertSchema.safeParse({
        date: "2026-02-28",
        item: "Tea",
      }).success,
    ).toBe(true);
  });
});
