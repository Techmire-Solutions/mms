import { describe, expect, it } from "vitest";
import type { AttendanceRecord } from "../lib/attendanceData";
import { patchAttendanceCachedRecords } from "./useAttendanceMutations";

const record = { id: "r1", studentId: "s1", status: "absent" } as AttendanceRecord;

describe("patchAttendanceCachedRecords", () => {
  it("patches ts-rest page bodies and unwrapped collections", () => {
    const page = { status: 200, body: { records: [record] } };
    const collection = { records: [record] };
    expect(
      patchAttendanceCachedRecords(page, (rows) => rows.map((r) => ({ ...r, status: "present" }))),
    ).toEqual({
      status: 200,
      body: { records: [{ ...record, status: "present" }] },
    });
    expect(
      patchAttendanceCachedRecords(collection, (rows) =>
        rows.map((r) => ({ ...r, status: "late" })),
      ),
    ).toEqual({
      records: [{ ...record, status: "late" }],
    });
  });

  it("leaves unrelated cache entries untouched", () => {
    const metrics = { overallRate: 85 };
    expect(patchAttendanceCachedRecords(metrics, (rows) => rows)).toBe(metrics);
  });
});
