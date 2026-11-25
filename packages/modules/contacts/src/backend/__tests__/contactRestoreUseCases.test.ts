import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";
import type { ContactsRepository } from "../repository/index.js";
import { runWithTenant } from "@mms/be-core/http";
import { ConflictError } from "@mms/be-core/http/errors";

const mockReconcile = vi.fn();
const mockInvalidateCache = vi.fn();

vi.mock("../systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcile(...args),
}));
vi.mock("../use-cases/contactAttachmentUrls.js", () => ({
  assertContactAttachmentUrls: vi.fn(),
}));
vi.mock("../use-cases/contactWriteContext.js", () => ({
  loadContactWriteContext: vi.fn().mockResolvedValue({
    runtimeDefaults: { defaultPhoneCountryCode: "+92" },
    countryCodes: [],
    fieldConfig: {
      version: 1,
      fields: {
        emails: [
          {
            key: "address",
            label: "Email",
            type: "email",
            enabled: true,
            unique: true,
            order: 0,
            required: false,
            permissions: [],
            defaultValue: "",
          },
        ],
      },
      formTabs: [],
      enabledTabs: ["emails"],
    },
    lookups: {},
    preferences: null,
  }),
}));
vi.mock("@mms/db/client", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  runInTransaction: (callback: () => unknown) => callback(),
}));
vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: vi.fn(),
}));
vi.mock("@mms/be-core/cache", () => ({
  invalidateMultiTierCache: (...args: unknown[]) => mockInvalidateCache(...args),
}));
vi.mock("../use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
  emitOutboxEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({}),
}));

const { restoreContactById, bulkRestoreContacts } = await import("../use-cases/index.js");

const makeDeletedContact = (id: string): Contact =>
  ({
    id,
    firstName: "Deleted",
    lastName: "Contact",
    name: "Deleted Contact",
    deletedAt: "2026-01-01T00:00:00.000Z",
    phones: [],
    relationshipContacts: [],
  }) as Contact;

function createFakeContactsRepo(): ContactsRepository {
  return {
    countByWorkspace: vi.fn().mockResolvedValue(0),
    listPage: vi
      .fn()
      .mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 12, hasMore: false }),
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    bulkSave: vi.fn().mockResolvedValue(undefined),
    bulkSoftDelete: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    bulkRestore: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
    findExistingNormalizedContactNames: vi.fn().mockResolvedValue(new Set()),
    findActiveContactsMatchingUniqueValues: vi.fn().mockResolvedValue([]),
    findContactDuplicateCandidateIds: vi.fn().mockResolvedValue([]),
    findContactDuplicateBlockedIds: vi.fn().mockResolvedValue([]),
    acquireUniqueValueLocks: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContactsRepository;
}

const archivedContactWithEmail = (id = "c-archived") => ({
  ...makeDeletedContact(id),
  email: "zayd@example.com",
});

describe("contactRestoreUseCases", () => {
  beforeEach(() => {
    mockReconcile.mockReset().mockResolvedValue(0);
    mockInvalidateCache.mockReset().mockResolvedValue(undefined);
  });

  describe("restoreContactById", () => {
    it("restores contact and reconciles system tags without touchContacts option", async () => {
      const persistedAt = "2026-03-01T09:00:00.000Z";
      const repo = {
        findById: vi.fn().mockResolvedValue(makeDeletedContact("c-1")),
        save: vi.fn().mockResolvedValue(persistedAt),
      } as unknown as ContactsRepository;

      const restored = await runWithTenant("demo", () =>
        restoreContactById("c-1", "user-admin", repo),
      );

      expect(restored).not.toBeNull();
      expect(restored?.deletedAt).toBeUndefined();
      expect(restored?.updatedAt).toBe(persistedAt);
      expect(mockReconcile).toHaveBeenCalledWith("demo", ["c-1"], { actorId: "user-admin" });
    });
  });

  it("throws ConflictError with field details when an active contact owns the same email", async () => {
    const repo = createFakeContactsRepo();
    vi.mocked(repo.findById).mockResolvedValue(archivedContactWithEmail());
    vi.mocked(repo.findActiveContactsMatchingUniqueValues).mockResolvedValue([
      {
        id: "c-active-conflict",
        firstName: "Zayd",
        lastName: "Hassan",
        email: "zayd@example.com",
      } as any,
    ]);

    await expect(
      runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
    ).rejects.toThrow(ConflictError);

    await expect(
      runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
    ).rejects.toMatchObject({
      errors: [{ fieldId: "address", tabId: "emails" }],
    });
  });

  it("traps a 23505 unique violation from save and throws ConflictError", async () => {
    const repo = createFakeContactsRepo();
    vi.mocked(repo.findById).mockResolvedValue(archivedContactWithEmail());
    const pgError = new Error("duplicate key value violates unique constraint");
    (pgError as any).code = "23505";
    vi.mocked(repo.save).mockRejectedValue(pgError);

    await expect(
      runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
    ).rejects.toThrow(ConflictError);

    await expect(
      runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
    ).rejects.toThrow(
      "Cannot restore contact: active record with this unique identifier already exists",
    );
  });

  describe("bulkRestoreContacts", () => {
    it("bulk restores contacts and reconciles system tags without touchContacts option", async () => {
      const repo = {
        findByIds: vi
          .fn()
          .mockResolvedValue([makeDeletedContact("c-1"), makeDeletedContact("c-2")]),
        bulkSave: vi.fn().mockResolvedValue(undefined),
      } as unknown as ContactsRepository;

      const result = await runWithTenant("demo", () =>
        bulkRestoreContacts(["c-1", "c-2"], "user-admin", repo),
      );

      expect(result.succeeded).toBe(2);
      expect(mockReconcile).toHaveBeenCalledWith("demo", ["c-1", "c-2"], {
        actorId: "user-admin",
      });
    });

    it("traps a 23505 unique violation from bulkSave and throws ConflictError", async () => {
      const repo = createFakeContactsRepo();
      vi.mocked(repo.findByIds).mockResolvedValue([archivedContactWithEmail()]);
      const pgError = new Error("duplicate key value violates unique constraint");
      (pgError as any).code = "23505";
      vi.mocked(repo.bulkSave).mockRejectedValue(pgError);

      await expect(
        runWithTenant("demo", () => bulkRestoreContacts(["c-archived"], "u-admin", repo)),
      ).rejects.toThrow(ConflictError);

      await expect(
        runWithTenant("demo", () => bulkRestoreContacts(["c-archived"], "u-admin", repo)),
      ).rejects.toThrow(
        "Cannot restore contact: active record with this unique identifier already exists",
      );
    });
  });
});
