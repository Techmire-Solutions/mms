import { describe, expect, it } from "vitest";
import { sessionsReportAggregatesSchema } from "./sessionsReportAggregates.js";

describe("sessionsReportAggregatesSchema", () => {
  it("parses a valid aggregates payload", () => {
    const parsed = sessionsReportAggregatesSchema.parse({
      capacity: [
        {
          sessionId: "sess-1",
          classId: "c1",
          session: "Morning",
          class: "A",
          enrolled: 10,
          capacity: 20,
          rate: 50,
          status: "active",
        },
      ],
      enrollmentTrends: [{ monthKey: "2026-01", students: 4, sessionName: "Morning" }],
      todaysSessions: [
        {
          id: "sess-1-c1",
          name: "Morning – A",
          teacher: "Ali",
          time: "09:00 - 10:00",
          room: "R1",
          students: 10,
          status: "live",
        },
      ],
    });
    expect(parsed.capacity).toHaveLength(1);
    expect(parsed.enrollmentTrends[0]?.monthKey).toBe("2026-01");
    expect(parsed.todaysSessions[0]?.status).toBe("live");
  });
});
