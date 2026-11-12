import { describe, expect, it, vi } from "vitest";
import { createWorkshopsUseCases } from "../workshops/use-cases/workshopsUseCases.js";
import type { WorkshopsRepository } from "../workshops/repository/workshopsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { ConflictError, NotFoundError } from "../lib/httpErrors.js";
import type { WorkshopDetail, WorkshopEvent } from "@mms/shared";

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
}));

function createFakeWorkshopRepo(): WorkshopsRepository {
  return {
    listWorkshopsPage: vi.fn().mockResolvedValue({
      workshops: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    }),
    findWorkshopById: vi.fn().mockResolvedValue(null),
    loadWorkshopDetail: vi.fn().mockResolvedValue(null),
    insertWorkshop: vi.fn().mockResolvedValue({
      id: "ws-1",
      title: "Test Workshop",
      status: "open",
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      registrationDeadline: null,
      capacity: 25,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as unknown as WorkshopEvent),
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
    loadCompletionInputs: vi.fn().mockResolvedValue({} as any),
    loadReportFacts: vi.fn().mockResolvedValue([]),
    loadWorkshopPreferences: vi.fn().mockResolvedValue({} as any),
    saveWorkshopPreferences: vi.fn().mockResolvedValue({} as any),
  };
}

describe("workshopsUseCases (DI with fake repository)", () => {
  it("listWorkshops delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeWorkshopRepo();
    const useCases = createWorkshopsUseCases(repo);

    await runWithTenant("alpha", async () => {
      const result = await useCases.listWorkshops({ page: 2, limit: 10 });
      expect(repo.listWorkshopsPage).toHaveBeenCalledWith("alpha", { page: 2, limit: 10 });
      expect(result.total).toBe(0);
    });
  });

  it("getWorkshop masks participant and waitlist contact phones when includeContactDetails is false", async () => {
    const repo = createFakeWorkshopRepo();
    const mockDetail: WorkshopDetail = {
      workshop: { id: "ws-1", title: "Test" } as any,
      participants: [{ id: "p-1", contactName: "Alice", contactPhone: "+1234567890" } as any],
      waitlisted: [{ id: "w-1", contactName: "Bob", contactPhone: "+1987654321" } as any],
      attendance: [],
      waitlistCount: 1,
      scores: [],
    };
    (repo.loadWorkshopDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockDetail);

    const useCases = createWorkshopsUseCases(repo);
    await runWithTenant("alpha", async () => {
      const detail = await useCases.getWorkshop("ws-1", { includeContactDetails: false });
      expect(detail.participants[0].contactPhone).toBe("");
      expect(detail.waitlisted[0].contactPhone).toBe("");
    });
  });

  it("getWorkshop throws NotFoundError when workshop detail does not exist", async () => {
    const repo = createFakeWorkshopRepo();
    const useCases = createWorkshopsUseCases(repo);

    await runWithTenant("alpha", async () => {
      await expect(useCases.getWorkshop("non-existent")).rejects.toThrow(NotFoundError);
    });
  });

  it("ensureWorkshop throws NotFoundError when workshop not found", async () => {
    const repo = createFakeWorkshopRepo();
    const useCases = createWorkshopsUseCases(repo);

    await runWithTenant("alpha", async () => {
      await expect(useCases.ensureWorkshop("ws-404")).rejects.toThrow(NotFoundError);
    });
  });

  it("createWorkshop wraps unique violation into typed ConflictError", async () => {
    const repo = createFakeWorkshopRepo();
    const pgUniqueError = new Error("duplicate key value violates unique constraint");
    (pgUniqueError as any).code = "23505";
    (repo.insertWorkshop as ReturnType<typeof vi.fn>).mockRejectedValue(pgUniqueError);

    const useCases = createWorkshopsUseCases(repo);
    await runWithTenant("alpha", async () => {
      await expect(
        useCases.createWorkshop({
          title: "Duplicate Workshop",
          startDate: "2026-05-01",
          endDate: "2026-05-02",
        } as any),
      ).rejects.toThrow(ConflictError);
    });
  });

  it("updateWorkshop throws NotFoundError when workshop to update does not exist", async () => {
    const repo = createFakeWorkshopRepo();
    (repo.updateWorkshop as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCases = createWorkshopsUseCases(repo);
    await runWithTenant("alpha", async () => {
      await expect(useCases.updateWorkshop("ws-missing", { title: "New" })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  it("deleteWorkshop throws NotFoundError when succeeded count is 0", async () => {
    const repo = createFakeWorkshopRepo();
    (repo.softDeleteWorkshops as ReturnType<typeof vi.fn>).mockResolvedValue({
      succeeded: 0,
      failed: 1,
    });

    const useCases = createWorkshopsUseCases(repo);
    await runWithTenant("alpha", async () => {
      await expect(useCases.deleteWorkshop("ws-1", "user-1", "Archive test")).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
