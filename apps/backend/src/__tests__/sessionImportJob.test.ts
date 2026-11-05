import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  create: vi.fn(),
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
  sessionsUseCases: { createSession: h.create },
}));
vi.mock("../lib/tenantContext.js", () => ({
  runWithTenant: (_tenant: string, fn: () => unknown) => fn(),
}));

import { registerSessionImportJobRunner } from "../sessions/use-cases/sessionImportJob.js";

describe("sessions CSV import runner", () => {
  beforeEach(() => {
    h.create.mockReset().mockResolvedValue(undefined);
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
});
