import { describe, expect, it, vi } from "vitest";
import { createWorkshopsCompletionUseCases } from "../workshops/use-cases/workshopsCompletionUseCases.js";
import type { WorkshopsRepository } from "../workshops/repository/workshopsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";
import type { WorkshopPreferences } from "@mms/shared";

function createFakeWorkshopRepo(): WorkshopsRepository {
  return {
    listWorkshopsPage: vi.fn().mockResolvedValue({} as any),
    findWorkshopById: vi.fn().mockResolvedValue(null),
    loadWorkshopDetail: vi.fn().mockResolvedValue(null),
    insertWorkshop: vi.fn().mockResolvedValue({} as any),
    updateWorkshop: vi.fn().mockResolvedValue(null),
    softDeleteWorkshops: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    restoreWorkshop: vi.fn().mockResolvedValue(false),
    registerParticipant: vi.fn().mockResolvedValue({} as any),
    registerParticipants: vi.fn().mockResolvedValue({ added: [], waitlisted: [] }),
    withdrawParticipant: vi.fn().mockResolvedValue({ removed: false, promoted: null }),
    saveAttendanceDay: vi.fn().mockResolvedValue([]),
    saveScores: vi.fn().mockResolvedValue([]),
    aggregateWorkshopsMetrics: vi.fn().mockResolvedValue({} as any),
    findWorkspaceTimezone: vi.fn().mockResolvedValue("UTC"),
    loadCompletionInputs: vi.fn().mockResolvedValue({
      workshop: {
        id: "ws-1",
        title: "Test",
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        status: "open",
        deletedAt: null,
      },
      participants: [],
      days: [],
      scores: [],
    }),
    loadReportFacts: vi.fn().mockResolvedValue([]),
    loadWorkshopPreferences: vi.fn().mockResolvedValue({
      defaultMinAttendancePct: 80,
      defaultMinScorePct: 75,
    } as unknown as WorkshopPreferences),
    saveWorkshopPreferences: vi.fn().mockImplementation((_tenant, prefs) => Promise.resolve(prefs)),
  };
}

describe("workshopsCompletionUseCases (DI with fake repository)", () => {
  it("getPreferences delegates to repository with tenant context", async () => {
    const repo = createFakeWorkshopRepo();
    const useCases = createWorkshopsCompletionUseCases(repo);

    await runWithTenant("alpha", async () => {
      const prefs = await useCases.getPreferences();
      expect(repo.loadWorkshopPreferences).toHaveBeenCalledWith("alpha");
      expect(prefs.defaultMinAttendancePct).toBe(80);
    });
  });

  it("savePreferences validates input schema and delegates to repository", async () => {
    const repo = createFakeWorkshopRepo();
    const useCases = createWorkshopsCompletionUseCases(repo);

    await runWithTenant("alpha", async () => {
      const saved = await useCases.savePreferences({
        defaultMinAttendancePct: 80,
        defaultMinScorePct: 75,
      });
      expect(repo.saveWorkshopPreferences).toHaveBeenCalled();
      expect(saved.defaultMinAttendancePct).toBe(80);
    });
  });

  it("getReport computes aggregated percentages correctly", async () => {
    const repo = createFakeWorkshopRepo();
    (repo.loadReportFacts as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workshop: {
          id: "ws-1",
          title: "Full Workshop",
          startDate: "2026-01-01",
          endDate: "2026-01-02",
          participantCount: 20,
          capacity: 20,
        },
        presentMarks: 36,
        completed: 18,
        certificates: 15,
      },
    ]);

    const useCases = createWorkshopsCompletionUseCases(repo);
    await runWithTenant("alpha", async () => {
      const report = await useCases.getReport();
      expect(report).toHaveLength(1);
      expect(report[0].workshopId).toBe("ws-1");
      expect(report[0].seatUtilizationPct).toBe(100);
      expect(report[0].completionPct).toBe(90);
      expect(report[0].attendancePct).toBe(90);
    });
  });

  it("getCompletion loads inputs and computes completion rows", async () => {
    const repo = createFakeWorkshopRepo();
    const useCases = createWorkshopsCompletionUseCases(repo);

    await runWithTenant("alpha", async () => {
      const rows = await useCases.getCompletion("ws-1");
      expect(repo.loadCompletionInputs).toHaveBeenCalledWith("alpha", "ws-1", expect.any(String));
      expect(rows).toEqual([]);
    });
  });
});
