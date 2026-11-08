import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flag: vi.fn(),
  notify: vi.fn(),
  broadcast: vi.fn(),
  warn: vi.fn(),
  prefs: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../enrollments/repository/admissionsRepositoryAdapter.js", () => ({
  admissionsRepository: {
    flagOldestWaitlistedApplication: mocks.flag,
    getEnrollmentModulePreferencesByWorkspace: mocks.prefs,
  },
}));
vi.mock("../notifications/use-cases/notificationsUseCases.js", () => ({
  notificationsUseCases: { notify: mocks.notify },
}));
vi.mock("../lib/livePush.js", () => ({ broadcastTenantUpdate: mocks.broadcast }));
vi.mock("../lib/logger.js", () => ({ logger: { warn: mocks.warn } }));
vi.mock("../db/repositories/enrollmentModulePreferencesRepository.js", () => ({
  getEnrollmentModulePreferencesByWorkspace: mocks.prefs,
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.audit,
}));

const { offerFreedSeat } = await import("../enrollments/use-cases/admissionsWaitlistUseCases.js");

describe("offerFreedSeat", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.notify.mockResolvedValue(undefined);
    mocks.prefs.mockResolvedValue({ waitlistEnabled: true, waitlistOfferHours: "72" });
    mocks.audit.mockResolvedValue(undefined);
  });

  it("given a waitlisted applicant, should flag them and notify admissions staff", async () => {
    // Arrange
    mocks.flag.mockResolvedValue({
      id: "app-1",
      reference: "APP-7K2QX9MD",
      fullName: "Amina Khan",
      className: "Hifz A",
      expiresAt: "2026-11-11T00:00:00Z",
    });

    // Act
    const offered = await offerFreedSeat("demo", "class-1");

    // Assert
    expect(offered).toEqual({ id: "app-1", reference: "APP-7K2QX9MD" });
    expect(mocks.notify).toHaveBeenCalledWith("demo", {
      kind: "waitlist_seat_offered",
      audiencePermission: "enrollments.write",
      entityType: "registration_application",
      entityId: "app-1",
      subjectLabel: "Amina Khan (APP-7K2QX9MD)",
      contextLabel: "Hifz A",
    });
    expect(mocks.broadcast).toHaveBeenCalledTimes(1);
  });

  it("given nobody waiting, should notify no one", async () => {
    mocks.flag.mockResolvedValue(null);
    expect(await offerFreedSeat("demo", "class-1")).toBeNull();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("given a storage failure, should not throw", async () => {
    mocks.flag.mockRejectedValue(new Error("db down"));
    await expect(offerFreedSeat("demo", "class-1")).resolves.toBeNull();
    expect(mocks.warn).toHaveBeenCalledTimes(1);
  });

  it("does not offer when the waitlist is disabled", async () => {
    mocks.prefs.mockResolvedValue({ waitlistEnabled: false, waitlistOfferHours: "72" });

    expect(await offerFreedSeat("demo", "class-1")).toBeNull();
    expect(mocks.flag).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("passes the configured offer window to the flag query", async () => {
    mocks.prefs.mockResolvedValue({ waitlistEnabled: true, waitlistOfferHours: "24" });
    mocks.flag.mockResolvedValue({
      id: "app-2",
      reference: "APP-2",
      fullName: "Bilal",
      className: "Hifz A",
      expiresAt: "2026-11-09T00:00:00Z",
    });

    await offerFreedSeat("demo", "class-1");

    expect(mocks.flag).toHaveBeenCalledWith("demo", "class-1", 24);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "registration_applications",
        recordId: "app-2",
        newState: expect.objectContaining({ operation: "waitlist_offer" }),
      }),
    );
  });
});
