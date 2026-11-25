import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  importBatch: undefined as
    ((rows: unknown[], ctx: Record<string, unknown>) => Promise<unknown>) | undefined,
  save: vi.fn(),
}));

vi.mock("../lib/registerModuleCsvImportJobRunner.js", () => ({
  registerModuleCsvImportJobRunner: (o: { importBatch: unknown }) => {
    h.importBatch = o.importBatch as typeof h.importBatch;
  },
}));
vi.mock("../attendance/use-cases/academicCalendarUseCases.js", () => ({
  academicCalendarUseCases: { save: h.save },
}));

import { registerAcademicCalendarImportJobRunner } from "../attendance/use-cases/academicCalendarImportJob.js";

describe("academic calendar import runner", () => {
  beforeEach(() => {
    h.save.mockReset().mockResolvedValue({});
  });

  it("saves events per row and reports failing rows", async () => {
    registerAcademicCalendarImportJobRunner();
    h.save.mockImplementation(async (_tenant, _id, row: { title?: string }) => {
      if (row.title === "Bad") throw new Error("End date must be on or after the start date");
      return {};
    });

    const result = (await h.importBatch!(
      [
        {
          title: "Eid Holiday",
          kind: "holiday",
          startOn: "2025-03-30",
          endOn: "2025-04-01",
          scope: "workspace",
        },
        {
          title: "Bad",
          kind: "holiday",
          startOn: "2025-04-01",
          endOn: "2025-03-30",
          scope: "workspace",
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
    expect(result.errors?.[0]).toMatchObject({ row: 2 });
    expect(h.save).toHaveBeenCalledWith(
      "demo",
      expect.any(String),
      expect.objectContaining({ title: "Eid Holiday" }),
      "u1",
    );
  });
});
