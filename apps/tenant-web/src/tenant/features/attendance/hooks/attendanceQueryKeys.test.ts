import { describe, expect, it } from "vitest";
import { attendanceQueryKeys } from "./attendanceQueryKeys";

/**
 * The factory exists so no hook invents a key the invalidator cannot see: every derived key must live
 * under `["attendance"]`, otherwise invalidating the root leaves that cache stale (which is exactly how
 * the roster and the report aggregates went stale before).
 */
describe("attendanceQueryKeys", () => {
  const derived = [
    attendanceQueryKeys.list,
    attendanceQueryKeys.listPage({ page: 1 }),
    attendanceQueryKeys.roster({ classId: "c1", date: "2026-03-02" }),
    attendanceQueryKeys.roster({ classId: "c1", date: "2026-03-02", sectionId: "s1" }),
    attendanceQueryKeys.metrics,
    attendanceQueryKeys.reportAggregates,
    attendanceQueryKeys.lifecycle,
    attendanceQueryKeys.leaves,
    attendanceQueryKeys.alerts,
    attendanceQueryKeys.markedDates,
    attendanceQueryKeys.lookups,
    attendanceQueryKeys.preferences,
    attendanceQueryKeys.daySubmission("c1", "2026-03-02"),
  ];

  it("roots every attendance key at the shared prefix", () => {
    for (const key of derived) {
      expect(key[0]).toBe(attendanceQueryKeys.all[0]);
    }
  });

  it("separates roster snapshots by class, date and section", () => {
    const a = attendanceQueryKeys.roster({ classId: "c1", date: "2026-03-02" });
    const b = attendanceQueryKeys.roster({ classId: "c1", date: "2026-03-02", sectionId: "s1" });
    const c = attendanceQueryKeys.roster({ classId: "c1", date: "2026-03-03" });
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("normalises whitespace so an unchanged filter reuses the cache entry", () => {
    expect(attendanceQueryKeys.roster({ classId: " c1 ", date: " 2026-03-02 " })).toEqual(
      attendanceQueryKeys.roster({ classId: "c1", date: "2026-03-02" }),
    );
  });
});
