import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";
import type { ContactsRepository } from "../repository/index.js";
import { runWithTenant } from "@mms/be-core/http";

const mockReconcile = vi.fn();
const mockAssertContactUniqueFields = vi.fn();
const mockPrepareContactRecord = vi.fn();
const mockInvalidateCache = vi.fn();
const mockInvalidateDuplicateScanCache = vi.fn();

vi.mock("../systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcile(...args),
}));
vi.mock("../use-cases/contactValidationUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../use-cases/index.js")>();
  return {
    ...actual,
    assertContactUniqueFields: (...args: unknown[]) => mockAssertContactUniqueFields(...args),
    prepareContactRecord: (...args: unknown[]) => mockPrepareContactRecord(...args),
  };
});
vi.mock("../use-cases/contactAttachmentUrls.js", () => ({
  assertContactAttachmentUrls: vi.fn(),
}));
vi.mock("../use-cases/contactInferenceUseCases.js", () => ({
  applyContactRelationshipInference: vi.fn().mockImplementation((c) => c),
}));
vi.mock("../use-cases/contactWriteContext.js", () => ({
  loadContactWriteContext: vi.fn().mockResolvedValue({
    fieldConfig: null,
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

vi.mock("@mms/be-core/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/be-core/audit")>();
  return {
    ...actual,
    recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
    sanitizeAuditState: (value: unknown) => value,
  };
});
vi.mock("@mms/be-core/cache", () => ({
  invalidateMultiTierCache: (...args: unknown[]) => mockInvalidateCache(...args),
}));
vi.mock("../use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: (...args: unknown[]) => mockInvalidateDuplicateScanCache(...args),
}));

const { upsertContact, updateContactById } = await import("../use-cases/index.js");

const makeContact = (id: string, relationshipId?: string): Contact =>
  ({
    id,
    firstName: "Test",
    lastName: "Contact",
    name: "Test Contact",
    phones: [],
    relationshipContacts: relationshipId
      ? [{ contactId: relationshipId, relationship: "Parent" }]
      : [],
  }) as Contact;

describe("contactWriteUseCases", () => {
  beforeEach(() => {
    mockReconcile.mockReset().mockResolvedValue(0);
    mockAssertContactUniqueFields.mockReset().mockResolvedValue(undefined);
    mockPrepareContactRecord.mockReset().mockImplementation((c) => c);
    mockInvalidateCache.mockReset().mockResolvedValue(undefined);
    mockInvalidateDuplicateScanCache.mockReset().mockResolvedValue(undefined);
  });

  describe("upsertContact", () => {
    it("upserts contact and reconciles target and related contact ids", async () => {
      const existing = makeContact("c-1", "rel-old");
      const next = makeContact("c-1", "rel-new");
      const persistedAt = "2026-02-01T10:00:00.000Z";

      const repo = {
        findById: vi.fn().mockResolvedValue(existing),
        save: vi.fn().mockResolvedValue(persistedAt),
      } as unknown as ContactsRepository;

      const result = await runWithTenant("demo", () =>
        upsertContact(next, { actorId: "user-1" }, repo),
      );

      expect(result.contact.id).toBe("c-1");
      // The response carries the token the database actually stored, so the client
      // can present it as `x-expected-updated-at` on the next save.
      expect(result.contact.updatedAt).toBe(persistedAt);
      expect(mockReconcile).toHaveBeenCalledWith(
        "demo",
        expect.arrayContaining(["c-1", "rel-old", "rel-new"]),
        { actorId: "user-1" },
      );
    });
  });

  describe("updateContactById", () => {
    it("updates contact by id and reconciles target and related contact ids", async () => {
      const existing = makeContact("c-1", "rel-old");
      const next = makeContact("c-1", "rel-new");
      const persistedAt = "2026-02-01T11:00:00.000Z";

      const repo = {
        findById: vi.fn().mockResolvedValue(existing),
        save: vi.fn().mockResolvedValue(persistedAt),
      } as unknown as ContactsRepository;

      const updated = await runWithTenant("demo", () =>
        updateContactById("c-1", next, { actorId: "user-1" }, repo),
      );

      expect(updated).not.toBeNull();
      expect(updated?.id).toBe("c-1");
      expect(updated?.updatedAt).toBe(persistedAt);
      expect(mockReconcile).toHaveBeenCalledWith(
        "demo",
        expect.arrayContaining(["c-1", "rel-old", "rel-new"]),
        { actorId: "user-1" },
      );
    });

    it("returns the new token from the conditional UPDATE, not the pre-write one", async () => {
      const existing = makeContact("c-1");
      existing.updatedAt = "2026-02-01T09:00:00.000Z";
      const next = makeContact("c-1");
      const persistedAt = "2026-02-01T12:00:00.000Z";

      const repo = {
        findById: vi.fn().mockResolvedValue(existing),
        saveIfVersionMatches: vi.fn().mockResolvedValue(persistedAt),
      } as unknown as ContactsRepository;

      const updated = await runWithTenant("demo", () =>
        updateContactById(
          "c-1",
          next,
          { actorId: "user-1", expectedUpdatedAt: "2026-02-01T09:00:00.000Z" },
          repo,
        ),
      );

      expect(updated?.updatedAt).toBe(persistedAt);
    });
  });
});
