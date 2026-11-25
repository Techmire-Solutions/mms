import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flag: vi.fn(),
  notify: vi.fn(),
  broadcast: vi.fn(),
  warn: vi.fn(),
  prefs: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@mms/mod-enrollments/backend/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-enrollments/backend/repository")>()),
  admissionsRepository: {
    flagOldestWaitlistedApplication: mocks.flag,
    getEnrollmentModulePreferencesByWorkspace: mocks.prefs,
  },
}));
vi.mock("@mms/mod-enrollments/backend/deps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/mod-enrollments/backend/deps")>()),
  notificationsUseCases: { notify: mocks.notify },
}));
vi.mock("@mms/mod-notifications/backend/use-cases", () => ({
  notificationsUseCases: { notify: mocks.notify },
}));
vi.mock("@mms/be-core/realtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/realtime")>()),
  broadcastTenantUpdate: mocks.broadcast,
}));
vi.mock("@mms/be-core/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/be-core/logger")>()),
  logger: { warn: mocks.warn, info: vi.fn(), error: vi.fn() },
}));
vi.mock("@mms/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/client")>()),
  hasActiveTransaction: () => false,
}));
vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),
  withTenant: async (_tenant: string, cb: (tx: unknown) => Promise<unknown>) => cb({}),
}));
vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: mocks.audit,
}));

const { offerFreedSeat } = await import("@mms/mod-enrollments/backend/use-cases");

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
      expect.anything(),
      expect.objectContaining({
        tableName: "registration_applications",
        recordId: "app-2",
        newState: expect.objectContaining({ operation: "waitlist_offer" }),
      }),
    );
  });
});
