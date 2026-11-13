import { describe, expect, it, vi } from "vitest";
import type { WorkshopDetail } from "@mms/shared";
import { createWorkshopsUseCases } from "../workshops/use-cases/workshopsUseCases.js";
import type { WorkshopsRepository } from "../workshops/repository/workshopsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const detail = (): WorkshopDetail => ({
  workshop: {
    id: "w1",
    title: "Calligraphy",
    description: "",
    startDate: "2099-03-01",
    endDate: "2099-03-02",
    registrationDeadline: null,
    capacity: null,
    fee: null,
    programId: null,
    subjectId: null,
    minAttendancePct: null,
    minScorePct: null,
    participantCount: 1,
    waitlistEnabled: false,
    status: "open",
    phase: "registration_open",
  },
  participants: [
    {
      id: "p1",
      workshopId: "w1",
      contactId: "c1",
      contactName: "Contact",
      contactPhone: "+920000000001",
      status: "registered",
      completedAt: null,
      certificateIssuedAt: null,
      waitlistedAt: null,
      createdAt: "2026-03-01T10:00:00.000Z",
    },
  ],
  waitlisted: [
    {
      id: "p2",
      workshopId: "w1",
      contactId: "c2",
      contactName: "Queued",
      contactPhone: "+920000000002",
      status: "registered",
      completedAt: null,
      certificateIssuedAt: null,
      waitlistedAt: "2026-03-01T10:00:00.000Z",
      createdAt: "2026-03-01T10:00:00.000Z",
    },
  ],
  waitlistCount: 1,
  attendance: [],
  scores: [],
});

const repo = {
  loadWorkshopDetail: vi.fn().mockImplementation(() => Promise.resolve(detail())),
} as unknown as WorkshopsRepository;

describe("workshop detail contact-detail projection", () => {
  it("masks participant and waitlist phones when contact details are not requested", async () => {
    const useCases = createWorkshopsUseCases(repo);
    const masked = await runWithTenant("demo", () =>
      useCases.getWorkshop("w1", { includeContactDetails: false }),
    );
    expect(masked.participants[0]?.contactPhone).toBe("");
    expect(masked.waitlisted[0]?.contactPhone).toBe("");
    expect(masked.participants[0]?.contactName).toBe("Contact");
  });

  it("keeps phones for callers who may write participants", async () => {
    const useCases = createWorkshopsUseCases(repo);
    const full = await runWithTenant("demo", () => useCases.getWorkshop("w1"));
    expect(full.participants[0]?.contactPhone).toBe("+920000000001");
    expect(full.waitlisted[0]?.contactPhone).toBe("+920000000002");
  });
});
