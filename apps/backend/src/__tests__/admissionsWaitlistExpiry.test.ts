import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revertExpired: vi.fn(),
  classHasFreeSeat: vi.fn(),
  revertOffersForClass: vi.fn(),
  broadcast: vi.fn(),
  audit: vi.fn(),
  withTenant: vi.fn((_tenant, cb) => cb({})),
  hasActiveTransaction: vi.fn(() => false),
  runAfterCommit: vi.fn((cb) => cb()),
}));

vi.mock("../enrollments/repository/admissionsRepositoryAdapter.js", () => ({
  admissionsRepository: {
    revertExpiredWaitlistOffers: mocks.revertExpired,
    classHasFreeSeat: mocks.classHasFreeSeat,
    revertSeatOffersForClass: mocks.revertOffersForClass,
  },
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: mocks.withTenant,
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: mocks.broadcast,
}));

vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: mocks.audit,
}));

vi.mock("@mms/db/client", async (importOriginal) => ({
  ...(await importOriginal()),
  runAfterCommit: mocks.runAfterCommit,
  hasActiveTransaction: mocks.hasActiveTransaction,
}));

const { expireWaitlistOffers, releaseOffersIfClassFull, releaseOffersIfClassFullPostCommit } =
  await import("../enrollments/use-cases/admissionsWaitlistExpiry.js");

describe("admissionsWaitlistExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTenant.mockImplementation((_tenant, cb) => cb({}));
    mocks.hasActiveTransaction.mockReturnValue(false);
  });

  describe("expireWaitlistOffers", () => {
    it("reverts expired waitlist offers and broadcasts to unique workspaces", async () => {
      mocks.revertExpired.mockResolvedValue([
        { workspace: "tenant-a", id: "app-1" },
        { workspace: "tenant-a", id: "app-2" },
        { workspace: "tenant-b", id: "app-3" },
      ]);

      const result = await expireWaitlistOffers(50);
      expect(mocks.revertExpired).toHaveBeenCalledWith(50);
      expect(result).toEqual({ reverted: 3, workspaces: ["tenant-a", "tenant-b"] });
      expect(mocks.broadcast).toHaveBeenCalledTimes(2);
      expect(mocks.broadcast).toHaveBeenCalledWith(
        "tenant-a",
        "collection",
        "registration_applications",
      );
      expect(mocks.broadcast).toHaveBeenCalledWith(
        "tenant-b",
        "collection",
        "registration_applications",
      );
    });

    it("handles empty reverted list cleanly", async () => {
      mocks.revertExpired.mockResolvedValue([]);
      const result = await expireWaitlistOffers();
      expect(result).toEqual({ reverted: 0, workspaces: [] });
      expect(mocks.broadcast).not.toHaveBeenCalled();
    });
  });

  describe("releaseOffersIfClassFull", () => {
    it("returns 0 and does not revert if class still has free seats", async () => {
      mocks.classHasFreeSeat.mockResolvedValue(true);
      const count = await releaseOffersIfClassFull("demo", "class-1");
      expect(count).toBe(0);
      expect(mocks.revertOffersForClass).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
      expect(mocks.broadcast).not.toHaveBeenCalled();
    });

    it("reverts offers and appends modern audit rows when class is full", async () => {
      mocks.classHasFreeSeat.mockResolvedValue(false);
      mocks.revertOffersForClass.mockResolvedValue(["app-1", "app-2"]);

      const count = await releaseOffersIfClassFull("demo", "class-1");
      expect(count).toBe(2);
      expect(mocks.revertOffersForClass).toHaveBeenCalledWith("demo", "class-1");
      expect(mocks.audit).toHaveBeenCalledTimes(2);
      expect(mocks.audit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          workspaceSubdomain: "demo",
          recordId: "app-1",
          tableName: "registration_applications",
          actionType: "UPDATE",
          newState: expect.objectContaining({ operation: "waitlist_offer_revoked" }),
        }),
      );
      expect(mocks.broadcast).toHaveBeenCalledWith(
        "demo",
        "collection",
        "registration_applications",
      );
    });
  });

  describe("releaseOffersIfClassFullPostCommit", () => {
    it("awaits release directly when no active transaction", async () => {
      mocks.hasActiveTransaction.mockReturnValue(false);
      mocks.classHasFreeSeat.mockResolvedValue(true);

      await releaseOffersIfClassFullPostCommit("demo", "class-1");
      expect(mocks.classHasFreeSeat).toHaveBeenCalledWith("demo", "class-1");
      expect(mocks.runAfterCommit).not.toHaveBeenCalled();
    });

    it("queues release through runAfterCommit when active transaction is present", async () => {
      mocks.hasActiveTransaction.mockReturnValue(true);

      await releaseOffersIfClassFullPostCommit("demo", "class-1");
      expect(mocks.runAfterCommit).toHaveBeenCalledTimes(1);
    });
  });
});
