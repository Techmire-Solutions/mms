import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const mockReconcile = vi.fn();
const mockRemoveSystemTags = vi.fn();
const mockInvalidateCache = vi.fn();
const mockInvalidateDuplicateScanCache = vi.fn();
const mockAuditMerged = vi.fn();
const mockAuditBulkTagged = vi.fn();
const mockPrepareContactRecord = vi.fn();
const mockValidateContactDynamic = vi.fn();

vi.mock("../contacts/systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: (...args: unknown[]) => mockReconcile(...args),
  removeSystemTagsForContacts: (...args: unknown[]) => mockRemoveSystemTags(...args),
}));
vi.mock("../contacts/use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: (...args: unknown[]) => mockInvalidateDuplicateScanCache(...args),
}));
vi.mock("../contacts/use-cases/contactInferenceUseCases.js", () => ({
  applyContactRelationshipInference: vi.fn(),
}));
vi.mock("../contacts/use-cases/contactValidationUseCases.js", () => ({
  assertContactUniqueFields: vi.fn(),
  prepareContactRecord: (...args: unknown[]) => mockPrepareContactRecord(...args),
  validateContactDynamic: (...args: unknown[]) => mockValidateContactDynamic(...args),
  mergeContactPatch: (existing: Contact, patch: Partial<Contact>) => ({ ...existing, ...patch }),
}));
vi.mock("../contacts/use-cases/contactAttachmentUrls.js", () => ({
  assertContactAttachmentUrls: vi.fn(),
}));
vi.mock("../contacts/use-cases/contactWriteContext.js", () => ({
  loadContactWriteContext: vi.fn().mockResolvedValue({
    runtimeDefaults: {},
    countryCodes: [],
    fieldConfig: null,
  }),
}));
vi.mock("../contacts/use-cases/contactWriteAudit.js", () => ({
  auditContactMerged: (...args: unknown[]) => mockAuditMerged(...args),
  auditContactBulkTagged: (...args: unknown[]) => mockAuditBulkTagged(...args),
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

const { bulkSaveContacts, bulkTagContacts, mergeContactsById } =
  await import("../contacts/use-cases/contactBulkWriteUseCases.js");

const contact = (id: string, relationshipContactId?: string): Contact =>
  ({
    id,
    firstName: "Ali",
    lastName: "Khan",
    name: "Ali Khan",
    ...(relationshipContactId
      ? { relationshipContacts: [{ contactId: relationshipContactId, relationship: "Guardian" }] }
      : { relationshipContacts: [] }),
  }) as Contact;

describe("bulkSaveContacts", () => {
  beforeEach(() => {
    mockReconcile.mockReset().mockResolvedValue(0);
    mockRemoveSystemTags.mockReset().mockResolvedValue(undefined);
    mockInvalidateCache.mockReset().mockResolvedValue(undefined);
    mockInvalidateDuplicateScanCache.mockReset().mockResolvedValue(undefined);
  });

  it("reconciles the relationship targets the batch replaces", async () => {
    const repo = {
      bulkSave: vi.fn().mockResolvedValue(undefined),
      findSummaryByIds: vi.fn().mockResolvedValue([contact("c-1", "g-1")]),
    } as unknown as ContactsRepository;

    await runWithTenant("demo", () => bulkSaveContacts([contact("c-1")], repo));

    expect(repo.findSummaryByIds).toHaveBeenCalledWith("demo", ["c-1"]);
    expect(mockReconcile).toHaveBeenCalledWith("demo", ["c-1", "g-1"]);
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [contact("c-1")]);
    expect(mockInvalidateCache).toHaveBeenCalledWith({ tenantId: "demo", domain: "contacts" });
  });

  it("still writes when the adapter cannot load prior relationships", async () => {
    const repo = {
      bulkSave: vi.fn().mockResolvedValue(undefined),
    } as unknown as ContactsRepository;

    await runWithTenant("demo", () => bulkSaveContacts([contact("c-1")], repo));

    expect(repo.bulkSave).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith("demo", ["c-1"]);
  });
});

describe("mergeContactsById", () => {
  beforeEach(() => {
    mockReconcile.mockReset().mockResolvedValue(0);
    mockRemoveSystemTags.mockReset().mockResolvedValue(undefined);
    mockInvalidateCache.mockReset().mockResolvedValue(undefined);
    mockInvalidateDuplicateScanCache.mockReset().mockResolvedValue(undefined);
    mockAuditMerged.mockReset().mockResolvedValue(undefined);
    mockPrepareContactRecord.mockReset().mockImplementation(async (record: Contact) => record);
    mockValidateContactDynamic.mockReset().mockResolvedValue(undefined);
  });

  function createMergeRepo() {
    const keep = contact("c-keep", "c-delete");
    const other = contact("c-delete", "c-keep");
    return {
      keep,
      other,
      repo: {
        findById: vi.fn(async (_tenant: string, id: string) =>
          id === "c-keep" ? keep : id === "c-delete" ? other : null,
        ),
        save: vi.fn().mockResolvedValue("2026-04-01T09:00:00.000Z"),
        saveIfVersionMatches: vi.fn().mockResolvedValue("2026-04-01T10:00:00.000Z"),
        reparentContactReferences: vi.fn().mockResolvedValue(undefined),
        bulkSave: vi.fn().mockResolvedValue(undefined),
      } as unknown as ContactsRepository,
    };
  }

  it("appends the merge audit inside the write transaction", async () => {
    const { repo } = createMergeRepo();
    const order: string[] = [];
    vi.mocked(repo.save).mockImplementation(async () => {
      order.push("save");
      return "2026-04-01T11:00:00.000Z";
    });
    mockAuditMerged.mockImplementation(async () => {
      order.push("audit");
    });

    await runWithTenant("demo", () =>
      mergeContactsById("c-keep", "c-delete", undefined, "u-admin", repo),
    );

    expect(mockAuditMerged).toHaveBeenCalledWith({
      tenant: "demo",
      keepId: "c-keep",
      deleteId: "c-delete",
      actorId: "u-admin",
    });
    // Committed save first, then the audit row — both before the cache/broadcast steps.
    expect(order).toEqual(["save", "save", "audit"]);
  });
});

describe("bulkTagContacts", () => {
  beforeEach(() => {
    mockReconcile.mockReset().mockResolvedValue(0);
    mockInvalidateCache.mockReset().mockResolvedValue(undefined);
    mockInvalidateDuplicateScanCache.mockReset().mockResolvedValue(undefined);
    mockAuditBulkTagged.mockReset().mockResolvedValue(undefined);
  });

  it("audits every changed contact inside the transaction with its tag diff", async () => {
    const alpha = { ...contact("c-1"), tags: ["Maths"] } as Contact;
    const beta = { ...contact("c-2"), tags: ["Science"] } as Contact;
    const repo = {
      findByIds: vi.fn().mockResolvedValue([alpha, beta]),
      replaceContactTags: vi.fn().mockResolvedValue(2),
    } as unknown as ContactsRepository;

    const result = await runWithTenant("demo", () =>
      bulkTagContacts(
        ["c-1", "c-2"],
        {
          addTags: ["English"],
          removeTags: ["Science"],
          actorId: "u-admin",
        },
        repo,
      ),
    );

    expect(result).toEqual({ updatedCount: 2 });
    expect(mockAuditBulkTagged).toHaveBeenCalledTimes(2);
    expect(mockAuditBulkTagged).toHaveBeenCalledWith({
      tenant: "demo",
      contactId: "c-1",
      actorId: "u-admin",
      addedTags: ["English"],
      removedTags: [],
    });
    expect(mockAuditBulkTagged).toHaveBeenCalledWith({
      tenant: "demo",
      contactId: "c-2",
      actorId: "u-admin",
      addedTags: ["English"],
      removedTags: ["Science"],
    });
  });
});
