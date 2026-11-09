import { describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";
import {
  assertAttendanceDayEditable,
  currentTimeInTimeZone,
} from "../attendance/use-cases/attendanceDayEditGuard.js";
import type { AttendancePolicyStore } from "../attendance/use-cases/attendancePolicyTypes.js";

/** Delete/restore gate: lock + cut-off, overridable only by delete-level staff with a reason. */

const TEACHER = { id: "u-teacher", role: "teacher" } as unknown as User;
const ADMIN = { id: "u-admin", role: "admin" } as unknown as User;

function store(overrides: Partial<Record<string, unknown>> = {}): AttendancePolicyStore {
  return {
    getAttendanceModulePreferences: vi.fn().mockResolvedValue({
      cutoffTime: "09:30",
      lockAfterSubmit: true,
      allowManualOverride: true,
    }),
    findWorkspaceTimezone: vi.fn().mockResolvedValue("UTC"),
    listApprovedLeavesFor: vi.fn().mockResolvedValue([]),
    listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set<string>()),
    lockAttendanceStudents: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AttendancePolicyStore;
}

const record = { classId: "cls-1", date: "2026-03-02", status: "present" } as never;
const LATE = new Date("2026-03-02T11:00:00.000Z");
const EARLY = new Date("2026-03-02T08:00:00.000Z");

describe("assertAttendanceDayEditable", () => {
  it("allows a same-day delete before the cut-off", async () => {
    await expect(
      assertAttendanceDayEditable({
        tenant: "demo",
        actor: TEACHER,
        records: [record],
        now: EARLY,
        store: store(),
      }),
    ).resolves.toEqual({ overridden: false, codes: [] });
  });

  it("refuses a teacher after the cut-off even with the switch on", async () => {
    await expect(
      assertAttendanceDayEditable({
        tenant: "demo",
        actor: TEACHER,
        records: [record],
        overrideReason: "Teacher tries",
        now: LATE,
        store: store(),
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_cutoff_passed" });
  });

  it("refuses a locked day for a teacher", async () => {
    await expect(
      assertAttendanceDayEditable({
        tenant: "demo",
        actor: TEACHER,
        records: [record],
        now: EARLY,
        store: store({
          listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set(["cls-1|2026-03-02"])),
        }),
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_day_locked" });
  });

  it("lets an administrator override with a reason and reports the codes", async () => {
    await expect(
      assertAttendanceDayEditable({
        tenant: "demo",
        actor: ADMIN,
        records: [record],
        overrideReason: "Duplicate mark",
        now: LATE,
        store: store({
          listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set(["cls-1|2026-03-02"])),
        }),
      }),
    ).resolves.toEqual({
      overridden: true,
      codes: ["attendance_day_locked", "attendance_cutoff_passed"],
    });
  });

  it("returns immediately for an empty batch", async () => {
    await expect(
      assertAttendanceDayEditable({ tenant: "demo", actor: ADMIN, records: [] }),
    ).resolves.toEqual({ overridden: false, codes: [] });
  });
});

describe("currentTimeInTimeZone", () => {
  it("renders a 24-hour clock and survives an invalid timezone", () => {
    expect(currentTimeInTimeZone("UTC", LATE)).toBe("11:00");
    expect(currentTimeInTimeZone("Not/AZone", LATE)).toBe("11:00");
  });
});
