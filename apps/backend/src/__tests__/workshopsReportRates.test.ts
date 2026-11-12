import { describe, expect, it, vi } from "vitest";
import type { WorkshopEvent } from "@mms/shared";
import { createWorkshopsCompletionUseCases } from "../workshops/use-cases/workshopsCompletionUseCases.js";
import type { WorkshopsRepository } from "../workshops/repository/workshopsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const workshop = (fields: Partial<WorkshopEvent> = {}): WorkshopEvent => ({
  id: "w1",
  title: "Calligraphy",
  description: "",
  startDate: "2000-01-01",
  endDate: "2000-01-02",
  registrationDeadline: null,
  capacity: 20,
  fee: null,
  programId: null,
  subjectId: null,
  minAttendancePct: null,
  minScorePct: null,
  participantCount: 5,
  waitlistEnabled: false,
  status: "open",
  phase: "ongoing",
  ...fields,
});

function useCases(
  facts: Array<{
    workshop: WorkshopEvent;
    presentMarks: number;
    completed: number;
    certificates: number;
  }>,
) {
  const repo = {
    findWorkspaceTimezone: vi.fn().mockResolvedValue("UTC"),
    loadReportFacts: vi.fn().mockResolvedValue(facts),
  } as unknown as WorkshopsRepository;
  return createWorkshopsCompletionUseCases(repo);
}

describe("workshop report rates", () => {
  it("computes seat utilization and completion percentage with one decimal", async () => {
    const rows = await runWithTenant("demo", () =>
      useCases([
        { workshop: workshop(), presentMarks: 4, completed: 3, certificates: 2 },
      ]).getReport(),
    );
    expect(rows[0]).toMatchObject({
      participants: 5,
      seatUtilizationPct: 25,
      completionPct: 60,
      attendancePct: 40,
    });
  });

  it("returns null when capacity or the roster is zero", async () => {
    const rows = await runWithTenant("demo", () =>
      useCases([
        {
          workshop: workshop({ capacity: null, participantCount: 0 }),
          presentMarks: 0,
          completed: 0,
          certificates: 0,
        },
      ]).getReport(),
    );
    expect(rows[0]?.seatUtilizationPct).toBeNull();
    expect(rows[0]?.completionPct).toBeNull();
  });
});
