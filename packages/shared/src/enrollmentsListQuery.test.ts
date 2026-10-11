import { describe, expect, it } from "vitest";
import type { Enrollment } from "./enrollmentsModuleManifest.js";
import { enrollmentsListQuerySchema, filterEnrollmentsForQuery } from "./enrollmentsListQuery.js";

describe("enrollmentsListQuery", () => {
  it("retains session and class filters in the API query schema", () => {
    expect(
      enrollmentsListQuerySchema.parse({
        page: "1",
        limit: "100",
        sessionId: "ses-1",
        classId: "cls-1",
      }),
    ).toEqual({
      page: 1,
      limit: 100,
      sessionId: "ses-1",
      classId: "cls-1",
    });
  });

  it("filters enrollment rosters by session and class", () => {
    const enrollments = [
      { id: "enr-1", sessionId: "ses-1", classId: "cls-1" },
      { id: "enr-2", sessionId: "ses-1", classId: "cls-2" },
      { id: "enr-3", sessionId: "ses-2", classId: "cls-1" },
    ] as Enrollment[];

    expect(
      filterEnrollmentsForQuery(enrollments, {
        sessionId: "ses-1",
        classId: "cls-1",
      }),
    ).toEqual([enrollments[0]]);
  });
});
