import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const mockReconcile = vi.fn();
const mockAssertContactUniqueFields = vi.fn();
const mockInvalidateCache = vi.fn();

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcile(...args),
}));
vi.mock("../contacts/use-cases/contactValidationUseCases.js", () => ({
  assertContactUniqueFields: (...args: unknown[]) => mockAssertContactUniqueFields(...args),
}));
vi.mock("../contacts/use-cases/contactAttachmentUrls.js", () => ({
  assertContactAttachmentUrls: vi.fn(),
}));
vi.mock("../contacts/use-cases/contactWriteContext.js", () => ({
  loadContactWriteContext: vi.fn().mockResolvedValue({
    fieldConfig: null,
    lookups: {},
    preferences: null,
  }),
}));
vi.mock("../db/database.js", () => ({
  runInTransaction: (callback: () => unknown) => callback(),
}));
vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
}));
vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: (...args: unknown[]) => mockInvalidateCache(...args),
}));
vi.mock("../contacts/use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
  emitOutboxEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({}),
}));

const { restoreContactById, bulkRestoreContacts } =
  await import("../contacts/use-cases/contactRestoreUseCases.js");

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

describe("contactRestoreUseCases", () => {
  beforeEach(() => {
    mockReconcile.mockReset().mockResolvedValue(0);
    mockAssertContactUniqueFields.mockReset().mockResolvedValue(undefined);
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
  });
});
