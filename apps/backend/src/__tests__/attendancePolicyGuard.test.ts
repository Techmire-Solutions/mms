import { describe, expect, it, vi } from "vitest";
import type { AttendanceRecord, User } from "@mms/shared";
import {
  assertAttendanceDayEditable,
  assertAttendanceWriteAllowed,
  currentTimeInTimeZone,
  type AttendancePolicyStore,
} from "../attendance/use-cases/attendancePolicyGuard.js";

/**
 * The guard resolves tenant preferences, approved leave and roster-day submission state once per
 * operation and turns them into the policy decision. These tests pin that resolution (the pure
 * rule matrix is covered separately by `attendancePolicy.test.ts`).
 */

const TEACHER = { id: "u-teacher", role: "teacher" } as unknown as User;
const ADMIN = { id: "u-admin", role: "admin" } as unknown as User;

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-1",
    classId: "class-a",
    studentId: "student-1",
    studentName: "Student",
    rollNo: "",
    date: "2026-03-02",
    status: "present",
    timeIn: "07:00",
    timeOut: "08:30",
    notes: "",
    ...overrides,
  } as AttendanceRecord;
}

function store(overrides: Partial<Record<string, unknown>> = {}): AttendancePolicyStore {
  return {
    getAttendanceModulePreferences: vi.fn().mockResolvedValue({
      cutoffTime: "09:30",
      lateThresholdMins: 15,
      autoAbsentAfterMins: 30,
      requireNoteForAbsent: true,
      lockAfterSubmit: true,
      allowManualOverride: false,
    }),
    findWorkspaceTimezone: vi.fn().mockResolvedValue("UTC"),
    listApprovedLeavesFor: vi.fn().mockResolvedValue([]),
    listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set<string>()),
    ...overrides,
  } as unknown as AttendancePolicyStore;
}

/** 2026-03-02T11:00Z — after the 09:30 cut-off on the same day. */
const LATE_IN_DAY = new Date("2026-03-02T11:00:00.000Z");
/** 2026-03-02T08:00Z — before the cut-off. */
const EARLY_IN_DAY = new Date("2026-03-02T08:00:00.000Z");

describe("currentTimeInTimeZone", () => {
  it("renders the workspace clock as 24-hour HH:mm", () => {
    expect(currentTimeInTimeZone("UTC", LATE_IN_DAY)).toBe("11:00");
    expect(currentTimeInTimeZone("Asia/Karachi", LATE_IN_DAY)).toBe("16:00");
    expect(currentTimeInTimeZone("not/a-zone", LATE_IN_DAY)).toBe("11:00");
  });
});

describe("assertAttendanceWriteAllowed", () => {
  it("passes a mark inside the cut-off window", async () => {
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: TEACHER,
        rows: [record()],
        now: EARLY_IN_DAY,
        store: store(),
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a teacher write after the cut-off when override is not allowed", async () => {
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: TEACHER,
        rows: [record()],
        now: LATE_IN_DAY,
        store: store(),
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_cutoff_passed" });
  });

  it("lets an administrator override the cut-off", async () => {
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: ADMIN,
        rows: [record()],
        now: LATE_IN_DAY,
        store: store(),
      }),
    ).resolves.toBeUndefined();
  });

  it("lets a teacher override when the school sets allowManualOverride", async () => {
    const permissive = store({
      getAttendanceModulePreferences: vi.fn().mockResolvedValue({
        cutoffTime: "09:30",
        lateThresholdMins: 15,
        autoAbsentAfterMins: 30,
        requireNoteForAbsent: false,
        lockAfterSubmit: true,
        allowManualOverride: true,
      }),
    });
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: TEACHER,
        rows: [record()],
        now: LATE_IN_DAY,
        store: permissive,
      }),
    ).resolves.toBeUndefined();
  });

  it("refuses a present mark when an approved leave covers the day", async () => {
    const onLeave = store({
      listApprovedLeavesFor: vi
        .fn()
        .mockResolvedValue([
          { studentId: "student-1", fromDate: "2026-03-01", toDate: "2026-03-05" },
        ]),
    });
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: TEACHER,
        rows: [record()],
        now: EARLY_IN_DAY,
        store: onLeave,
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_on_approved_leave" });
  });

  it("allows an excused mark with a note on that leave day", async () => {
    const onLeave = store({
      listApprovedLeavesFor: vi
        .fn()
        .mockResolvedValue([
          { studentId: "student-1", fromDate: "2026-03-01", toDate: "2026-03-05" },
        ]),
    });
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: TEACHER,
        rows: [record({ status: "excused", timeIn: "", timeOut: "", notes: "Fever" })],
        now: EARLY_IN_DAY,
        store: onLeave,
      }),
    ).resolves.toBeUndefined();
  });

  it("refuses a write on a submitted day", async () => {
    const submitted = store({
      listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set(["class-a|2026-03-02"])),
    });
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: TEACHER,
        rows: [record()],
        now: EARLY_IN_DAY,
        store: submitted,
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_day_locked" });
  });

  it("evaluates the batch and reports the first violation", async () => {
    await expect(
      assertAttendanceWriteAllowed({
        tenant: "demo",
        actor: TEACHER,
        rows: [
          record({ studentId: "ok" }),
          record({ studentId: "needs-note", status: "absent", timeIn: "", timeOut: "", notes: "" }),
        ],
        now: EARLY_IN_DAY,
        store: store(),
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_note_required" });
  });

  it("does nothing for an empty batch (no preference read)", async () => {
    const policyStore = store();
    await assertAttendanceWriteAllowed({
      tenant: "demo",
      actor: TEACHER,
      rows: [],
      store: policyStore,
    });
    expect(policyStore.getAttendanceModulePreferences).not.toHaveBeenCalled();
  });
});

describe("assertAttendanceDayEditable (delete / restore)", () => {
  it("refuses to delete a mark on a submitted day", async () => {
    const submitted = store({
      listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set(["class-a|2026-03-02"])),
    });
    await expect(
      assertAttendanceDayEditable({
        tenant: "demo",
        actor: TEACHER,
        records: [record()],
        now: EARLY_IN_DAY,
        store: submitted,
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_day_locked" });
  });

  it("refuses a teacher delete after the cut-off", async () => {
    await expect(
      assertAttendanceDayEditable({
        tenant: "demo",
        actor: TEACHER,
        records: [record()],
        now: LATE_IN_DAY,
        store: store(),
      }),
    ).rejects.toMatchObject({ statusCode: 409, type: "attendance_cutoff_passed" });
  });

  it("allows an administrator to reopen the same edit", async () => {
    const submitted = store({
      listLockedAttendanceDayKeys: vi.fn().mockResolvedValue(new Set(["class-a|2026-03-02"])),
    });
    await expect(
      assertAttendanceDayEditable({
        tenant: "demo",
        actor: ADMIN,
        records: [record()],
        now: LATE_IN_DAY,
        store: submitted,
      }),
    ).resolves.toBeUndefined();
  });
});
