import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

const mockReconcile = vi.fn();
const mockRemoveSystemTags = vi.fn();
const mockInvalidateCache = vi.fn();
const mockInvalidateDuplicateScanCache = vi.fn();

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
  prepareContactRecord: vi.fn(),
}));
vi.mock("../contacts/use-cases/contactAttachmentUrls.js", () => ({
  assertContactAttachmentUrls: vi.fn(),
}));
vi.mock("../contacts/use-cases/contactWriteContext.js", () => ({
  loadContactWriteContext: vi.fn(),
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

const { bulkSaveContacts } = await import("../contacts/use-cases/contactBulkWriteUseCases.js");

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
