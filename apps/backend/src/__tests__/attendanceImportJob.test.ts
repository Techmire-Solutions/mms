import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  importBatch: undefined as
    ((rows: unknown[], ctx: Record<string, unknown>) => Promise<unknown>) | undefined,
  findStudentsByNames: vi.fn(),
  loadSessions: vi.fn(),
  upsertAttendanceRecords: vi.fn(),
  resolveCurrentTenantRole: vi.fn(),
}));

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: (o: { importBatch: unknown }) => {
    h.importBatch = o.importBatch as typeof h.importBatch;
  },
}));
vi.mock("../db/repositories/hasanatBatchRepository.js", () => ({
  findStudentsByNames: h.findStudentsByNames,
}));
vi.mock("../sessions/use-cases/sessionsUseCases.js", () => ({
  sessionsUseCases: { loadSessions: h.loadSessions },
}));
vi.mock("../attendance/use-cases/attendanceUseCases.js", () => ({
  attendanceUseCases: { upsertAttendanceRecords: h.upsertAttendanceRecords },
}));
vi.mock("../lib/currentTenantRole.js", () => ({
  resolveCurrentTenantRole: h.resolveCurrentTenantRole,
}));

import { registerAttendanceImportJobRunner } from "../attendance/use-cases/attendanceImportJob.js";

describe("attendance import runner", () => {
  beforeEach(() => {
    h.findStudentsByNames
      .mockReset()
      .mockResolvedValue([{ studentId: "st1", studentName: "Ali ibn Husayn" }]);
    h.loadSessions
      .mockReset()
      .mockResolvedValue([
        { id: "sess1", name: "Academic Year 2026", classes: [{ id: "cls1", name: "Hifz A" }] },
      ]);
    h.upsertAttendanceRecords.mockReset().mockResolvedValue([]);
    h.resolveCurrentTenantRole.mockReset().mockResolvedValue("admin");
  });

  it("resolves person/session/class names to ids and reports unresolved rows", async () => {
    registerAttendanceImportJobRunner();

    const result = (await h.importBatch!(
      [
        {
          date: "2026-09-02",
          personName: "Ali ibn Husayn",
          sessionName: "Academic Year 2026",
          className: "Hifz A",
          status: "present",
        },
        {
          date: "2026-09-02",
          personName: "Missing Student",
          sessionName: "Academic Year 2026",
          className: "Hifz A",
          status: "present",
        },
      ],
      {
        tenant: "demo",
        userId: "u1",
        jobId: "job-1",
        viewerRole: "admin",
        updateProgress: vi.fn().mockResolvedValue(undefined),
      },
    )) as { imported: number; failed: number; errors?: Array<{ row: number; reason: string }> };

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors?.[0]).toMatchObject({
      row: 2,
      reason: expect.stringContaining("Missing Student"),
    });
    expect(h.upsertAttendanceRecords).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ classId: "cls1", studentId: "st1", status: "present" }),
      ]),
      expect.objectContaining({ id: "u1" }),
    );
  });
});
