import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_ATTENDED_STATUSES,
  ATTENDANCE_RECORD_STATUSES,
  ATTENDANCE_STATUS_TRANSITIONS,
  attendanceRecordStatusSchema,
  attendanceStatusSchema,
  DEFAULT_ATTENDANCE_STATUSES,
  defaultAttendanceLookupItems,
  isAttendedStatus,
} from "@mms/shared";
import { attendanceMatrixCellCode } from "@mms/shared";

/**
 * Status-domain parity.
 *
 * The shared enum, the zod enums, the lookup model, the matrix codes, the transitions table and the
 * database CHECK must all describe the same five statuses. Each of these had its own copy at some
 * point; this test is what makes a lone edit fail.
 */

const SRC = join(process.cwd(), "src");

describe("attendance status domain", () => {
  it("is exactly the documented five statuses", () => {
    expect([...ATTENDANCE_RECORD_STATUSES]).toEqual([
      "present",
      "absent",
      "late",
      "half_day",
      "excused",
    ]);
  });

  it("keeps the zod enum, the lookup schema and the lookup defaults in step", () => {
    expect(attendanceRecordStatusSchema.options).toEqual([...ATTENDANCE_RECORD_STATUSES]);
    expect(DEFAULT_ATTENDANCE_STATUSES.map((status) => status.id)).toEqual([
      ...ATTENDANCE_RECORD_STATUSES,
    ]);
    expect(defaultAttendanceLookupItems.statuses.map((status) => status.id)).toEqual([
      ...ATTENDANCE_RECORD_STATUSES,
    ]);
    // A lookup id outside the enum must not validate.
    expect(
      attendanceStatusSchema.safeParse({ ...DEFAULT_ATTENDANCE_STATUSES[0], id: "holiday" })
        .success,
    ).toBe(false);
  });

  it("declares an edge from every status and gives every status a matrix code", () => {
    for (const status of ATTENDANCE_RECORD_STATUSES) {
      expect(ATTENDANCE_STATUS_TRANSITIONS[status]?.length).toBe(ATTENDANCE_RECORD_STATUSES.length);
      expect(attendanceMatrixCellCode(status)).toMatch(/^[A-Z]$/);
    }
  });

  it("marks present, late and half_day as attended and nothing else", () => {
    expect([...ATTENDANCE_ATTENDED_STATUSES]).toEqual(["present", "late", "half_day"]);
    for (const status of ATTENDANCE_RECORD_STATUSES) {
      expect(isAttendedStatus(status)).toBe(
        status === "present" || status === "late" || status === "half_day",
      );
    }
  });

  it("matches the database CHECK declared in the Drizzle model", () => {
    const schemaSource = readFileSync(join(SRC, "db/schema/attendance.ts"), "utf8");
    const check = /attendance_status_check",\s*sql`\$\{table\.status\} IN \(([^)]+)\)`/s.exec(
      schemaSource,
    );
    expect(check, "attendance_status_check not found in the schema").not.toBeNull();
    const values = (check?.[1] ?? "")
      .split(",")
      .map((value) => value.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    expect(values).toEqual([...ATTENDANCE_RECORD_STATUSES]);
  });

  it("ships the half-day label in every locale", () => {
    for (const locale of ["En", "Ar", "Ur", "Fa"]) {
      const translations = readFileSync(
        join(process.cwd(), "../../packages/shared/src/i18n", `appTranslations${locale}.ts`),
        "utf8",
      );
      expect(translations).toContain('"attendance.status.half_day"');
      expect(translations).toContain('"attendance.status.half_day.short"');
    }
  });
});
