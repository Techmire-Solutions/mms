import { describe, expect, it } from "vitest";
import {
  attendanceContract,
  attendanceListQuerySchema,
  attendanceListPageResponseSchema,
  attendanceRecordSchema,
  attendanceLeaveSchema,
  type AttendanceListQuery,
  type AttendanceListPageResult,
  type AttendanceRecord,
  type AttendanceLeave,
} from "@mms/shared";

/**
 * DTO parity: every shared attendance DTO is inferred from its wire schema, so the client and the
 * server cannot drift. These assertions are compile-time where possible and shape-level otherwise.
 */

describe("attendance list DTOs derive from the wire schemas", () => {
  it("exposes every filter the repository reads", () => {
    const keys = Object.keys(attendanceListQuerySchema.shape);
    for (const key of [
      "page",
      "limit",
      "search",
      "sessionId",
      "classId",
      "sectionId",
      "facultyId",
      "date",
      "dateFrom",
      "dateTo",
      "status",
      "sortField",
      "sortDir",
      "includeDeleted",
      "afterId",
      "skipCount",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("types the page result with nextCursor", () => {
    const page: AttendanceListPageResult = {
      records: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
      nextCursor: "att-1",
    };
    expect(attendanceListPageResponseSchema.safeParse(page).success).toBe(true);
    const keys = Object.keys(attendanceListPageResponseSchema.shape);
    expect(keys).toContain("nextCursor");
  });

  it("keeps the list query type aligned with the schema (compile-time check)", () => {
    const query: AttendanceListQuery = {
      sectionId: "sec-1",
      afterId: "att-9",
      skipCount: true,
      sortField: "studentName",
    };
    expect(attendanceListQuerySchema.safeParse(query).success).toBe(true);
  });
});

describe("record/leave DTOs mirror their schemas", () => {
  it("accepts a record that carries the version token", () => {
    const record: AttendanceRecord = {
      id: "att-1",
      classId: "cls-1",
      studentId: "std-1",
      studentName: "Amina",
      rollNo: "1",
      date: "2026-03-02",
      status: "half_day",
      timeIn: "08:00",
      timeOut: "10:00",
      notes: "",
      version: 3,
    };
    expect(attendanceRecordSchema.safeParse(record).success).toBe(true);
  });

  it("types a leave with the canonical status/type enums", () => {
    const leave: AttendanceLeave = {
      id: "leave-1",
      studentId: "std-1",
      fromDate: "2026-03-02",
      toDate: "2026-03-03",
      reason: "Fever",
      status: "approved",
      leaveType: "medical",
    };
    expect(attendanceLeaveSchema.safeParse(leave).success).toBe(true);
  });

  it("declares a typed success response for every route", () => {
    for (const [key, route] of Object.entries(attendanceContract)) {
      const candidate = route as unknown as {
        method?: string;
        responses?: Record<string, { _def?: { typeName?: string } }>;
      };
      if (!candidate.method || !candidate.responses) continue;
      const responses = candidate.responses;
      const okKey = Object.keys(responses).find((status) => /^20[0-2]$/.test(status));
      expect(okKey, `${key} has no typed success response`).toBeDefined();
      expect(responses[okKey!]?._def?.typeName, `${key} is unconstrained`).not.toBe("ZodUnknown");
    }
  });
});
