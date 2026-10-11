import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import { upsertAttendanceRecords } from "../services/attendanceService.js";

const { bulkSaveAttendanceRecords, replaceAttendanceRecordsForWorkspace } = vi.hoisted(() => ({
  bulkSaveAttendanceRecords: vi.fn(),
  replaceAttendanceRecordsForWorkspace: vi.fn(),
}));

vi.mock("../db/repositories/attendanceRepository.js", () => ({
  listAttendanceRecordsByWorkspace: vi.fn().mockResolvedValue([]),
  findAttendanceRecordById: vi.fn(),
  findAttendanceRecordsByIds: vi.fn().mockResolvedValue([]),
  saveAttendanceRecord: vi.fn(),
  bulkSaveAttendanceRecords,
  replaceAttendanceRecordsForWorkspace,
  bulkSoftDeleteAttendanceRecords: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
  bulkRestoreAttendanceRecords: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
}));

vi.mock("../services/websocketService.js", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../db/repositories/studentRepository.js", () => ({
  findStudentsByIds: vi.fn().mockResolvedValue([{ id: "student-1", deletedAt: null }]),
  findStudentById: vi.fn().mockResolvedValue({ id: "student-1", deletedAt: null }),
}));

vi.mock("../db/repositories/sessionRepositoryHydrate.js", () => ({
  findSessionsByIds: vi.fn().mockResolvedValue([{ id: "class-a", deletedAt: null }]),
  findSessionById: vi.fn().mockResolvedValue({ id: "class-a", deletedAt: null }),
  findClassesOrSessionsByIds: vi.fn().mockResolvedValue([{ id: "class-a", deletedAt: null }]),
  findClassOrSessionById: vi.fn().mockResolvedValue({ id: "class-a", deletedAt: null }),
}));

describe("attendanceService bulk upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bulk saves supplied records without replacing the workspace collection", async () => {
    const record = {
      id: "class-a-2026-07-27-student-1",
      classId: "class-a",
      date: "2026-07-27",
      studentId: "student-1",
      studentName: "Amina Ali",
      rollNo: "001",
      status: "present" as const,
      timeIn: "07:00",
      timeOut: "08:30",
      notes: "",
    };

    const result = await runWithTenant("demo", () => upsertAttendanceRecords([record]));

    expect(result).toEqual([record]);
    expect(bulkSaveAttendanceRecords).toHaveBeenCalledWith("demo", [record]);
    expect(replaceAttendanceRecordsForWorkspace).not.toHaveBeenCalled();
  });
});
