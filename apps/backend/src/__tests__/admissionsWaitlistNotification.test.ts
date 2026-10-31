import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flag: vi.fn(),
  notify: vi.fn(),
  broadcast: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../enrollments/repository/admissionsRepositoryAdapter.js", () => ({
  admissionsRepository: { flagOldestWaitlistedApplication: mocks.flag },
}));
vi.mock("../notifications/use-cases/notificationsUseCases.js", () => ({
  notificationsUseCases: { notify: mocks.notify },
}));
vi.mock("../lib/livePush.js", () => ({ broadcastTenantUpdate: mocks.broadcast }));
vi.mock("../lib/logger.js", () => ({ logger: { warn: mocks.warn } }));

const { offerFreedSeat } = await import("../enrollments/use-cases/admissionsWaitlistUseCases.js");

describe("offerFreedSeat", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.notify.mockResolvedValue(undefined);
  });

  it("given a waitlisted applicant, should flag them and notify admissions staff", async () => {
    // Arrange
    mocks.flag.mockResolvedValue({
      id: "app-1",
      reference: "APP-7K2QX9MD",
      fullName: "Amina Khan",
      className: "Hifz A",
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
});
