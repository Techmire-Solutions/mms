import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  create: vi.fn(),
  load: vi.fn(),
  registered: undefined as
    | {
        importBatch: (
          rows: unknown[],
          ctx: {
            tenant: string;
            userId: string;
            jobId: string;
            viewerRole: string;
            updateProgress: (current: number, total: number) => Promise<void>;
          },
        ) => Promise<{
          imported: number;
          failed?: number;
          errors?: Array<{ row: number; reason: string }>;
        }>;
      }
    | undefined,
}));

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: (options: unknown) => {
    h.registered = options as typeof h.registered;
  },
}));
vi.mock("../sessions/use-cases/sessionsUseCases.js", () => ({
  sessionsUseCases: {
    createSession: h.create,
    loadSessionById: (...args: unknown[]) => h.load(...args),
  },
}));
vi.mock("../lib/tenantContext.js", () => ({
  runWithTenant: (_tenant: string, fn: () => unknown) => fn(),
}));

import { registerSessionImportJobRunner } from "../sessions/use-cases/sessionImportJob.js";

describe("sessions CSV import runner", () => {
  beforeEach(() => {
    h.create.mockReset().mockResolvedValue(undefined);
    h.load.mockReset().mockResolvedValue(null);
  });

  it("creates a session per valid row and reports invalid rows", async () => {
    // Arrange
    registerSessionImportJobRunner();
    const runner = h.registered;
    expect(runner).toBeDefined();
    const updateProgress = vi.fn().mockResolvedValue(undefined);

    // Act
    const result = await runner!.importBatch(
      [
        {
          name: "Hifz 2027",
          type: "Hifz",
          status: "open",
          startDate: "2027-01-01",
          endDate: "2027-06-30",
          baseFee: "1500",
          currency: "PKR",
          description: "Annual program",
        },
        { name: "   ", type: "Hifz" },
      ],
      { tenant: "demo", userId: "u1", jobId: "job-1", viewerRole: "admin", updateProgress },
    );

    // Assert
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors?.[0]).toMatchObject({ row: 2 });
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Hifz 2027",
        type: "Hifz",
        status: "open",
        startDate: "2027-01-01",
        endDate: "2027-06-30",
        baseFee: 1500,
        classes: [],
        faculty: [],
      }),
    );
    expect(updateProgress).toHaveBeenCalledTimes(2);
  });

  it("re-running the same job after a retry does not create duplicate sessions", async () => {
    // Arrange — model the persisted rows created by the first attempt.
    registerSessionImportJobRunner();
    const runner = h.registered!;
    const createdIds: string[] = [];
    h.create.mockImplementation(async (record: { id?: string }) => {
      if (record.id) createdIds.push(record.id);
      return undefined;
    });
    h.load.mockImplementation(async (id: string) =>
      createdIds.includes(id) ? { id, deletedAt: null } : null,
    );
    const ctx = {
      tenant: "demo",
      userId: "u1",
      jobId: "job-retry",
      viewerRole: "admin",
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };
    const rows = [{ name: "Hifz 2027", status: "draft" }];

    // Act — the same BullMQ job is replayed after a timeout.
    await runner.importBatch(rows, ctx);
    const second = await runner.importBatch(rows, ctx);

    // Assert — deterministic row id + existing-row skip keep the retry idempotent.
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(second.imported).toBe(1);
    expect(new Set(createdIds).size).toBe(1);
  });
});
