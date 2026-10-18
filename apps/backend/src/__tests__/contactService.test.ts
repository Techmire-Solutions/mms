import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";

const mockFindContactById = vi.fn();
const mockFindContactsByIds = vi.fn();
const mockListContactsByWorkspace = vi.fn();
const mockListContactsPage = vi.fn();
const mockSaveContact = vi.fn();
const mockBulkSaveContacts = vi.fn();
const mockBulkSoftDeleteContactsSql = vi.fn();
const mockBulkRestoreContactsSql = vi.fn();
const mockGetRequestTenant = vi.fn();
const mockInvalidateDuplicateScanCache = vi.fn();

const mockAssertContactUniqueFields = vi.fn();

vi.mock("../db/repositories/contactRepository.js", () => ({
  listContactsByWorkspace: (...args: unknown[]) => mockListContactsByWorkspace(...args),
  listContactsPage: (...args: unknown[]) => mockListContactsPage(...args),
  findContactById: (...args: unknown[]) => mockFindContactById(...args),
  saveContact: (...args: unknown[]) => mockSaveContact(...args),
  findContactsByIds: (...args: unknown[]) => mockFindContactsByIds(...args),
  bulkSaveContacts: (...args: unknown[]) => mockBulkSaveContacts(...args),
  bulkSoftDeleteContactsSql: (...args: unknown[]) => mockBulkSoftDeleteContactsSql(...args),
  bulkRestoreContactsSql: (...args: unknown[]) => mockBulkRestoreContactsSql(...args),
}));

vi.mock("../contacts/use-cases/contactValidationUseCases.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../contacts/use-cases/contactValidationUseCases.js")>();
  return {
    ...actual,
    assertContactUniqueFields: (...args: unknown[]) => mockAssertContactUniqueFields(...args),
  };
});

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
}));

vi.mock("../contacts/use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: (...args: unknown[]) => mockInvalidateDuplicateScanCache(...args),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: vi.fn().mockResolvedValue(null),
}));

vi.mock("../contacts/use-cases/contactLookupsService.js", () => ({
  loadContactLookupKind: vi.fn().mockResolvedValue([]),
}));

const mockLoadContactPreferences = vi.fn();
vi.mock("../contacts/use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: (...args: unknown[]) => mockLoadContactPreferences(...args),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    id: 1,
    hashPrevious: "0".repeat(64),
    hashCurrent: "a".repeat(64),
    canonicalPayload: "{}",
  }),
  sanitizeAuditState: (v: unknown) => v,
}));

import {
  loadContactsPage,
  updateContactById,
  ContactUniqueFieldError,
} from "../services/contactService.js";
import { contactUseCases } from "../contacts/use-cases/contactUseCases.js";
import { upsertContact } from "../contacts/use-cases/contactWriteUseCases.js";
import {
  restoreContactById,
  bulkRestoreContacts,
  bulkSoftDeleteContacts,
} from "../contacts/use-cases/contactSoftDeleteUseCases.js";
import { applyContactRelationshipInference } from "../contacts/use-cases/contactInferenceUseCases.js";

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: "contact-1",
    name: "Contact One",
    firstName: "Contact",
    lastName: "One",
    relationshipContacts: [],
    relationships: [],
    ...overrides,
  };
}

function link(contactId: string, relationship: string) {
  return expect.objectContaining({ contactId, relationship });
}

function inferredLink(contactId: string, relationship: string, inferenceDepth?: number) {
  return expect.objectContaining({
    contactId,
    relationship,
    inferred: true,
    ...(inferenceDepth ? { inferenceDepth } : {}),
  });
}

/** Pair fixtures for reciprocal depth-1 tests only (no depth-2/3 ontology). */
const DEFAULT_TEST_RELATIONSHIP_PAIRS = [
  { id: "parent_child", forward: "Parent", inverse: "Child" },
  { id: "husband_wife", forward: "Husband", inverse: "Wife" },
  { id: "guardian_dependent", forward: "Guardian", inverse: "Dependent" },
];

describe("contactService relationship reciprocal mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
    mockLoadContactPreferences.mockImplementation(async () => ({
      relationshipPairs: DEFAULT_TEST_RELATIONSHIP_PAIRS,
    }));
    mockListContactsByWorkspace.mockResolvedValue([]);
    mockListContactsPage.mockResolvedValue({
      contacts: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    mockFindContactById.mockResolvedValue(null);
    mockFindContactsByIds.mockResolvedValue([]);
    mockSaveContact.mockResolvedValue(undefined);
    mockBulkSaveContacts.mockResolvedValue(undefined);
    mockInvalidateDuplicateScanCache.mockResolvedValue(undefined);
    mockAssertContactUniqueFields.mockReset().mockResolvedValue(undefined);
  });

  it("returns only deleted contacts for trash pages", async () => {
    mockListContactsPage.mockResolvedValue({
      contacts: [contact({ id: "deleted", deletedAt: "2026-07-27T00:00:00.000Z" })],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    });

    const page = await loadContactsPage({ page: 1, limit: 50, includeDeleted: true });

    expect(mockListContactsPage).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ page: 1, limit: 50, includeDeleted: true }),
    );
    expect(page.contacts.map((entry) => entry.id)).toEqual(["deleted"]);
    expect(page.total).toBe(1);
  });

  it("excludeLinkedModules is forwarded to SQL listContactsPage", async () => {
    mockListContactsPage.mockResolvedValue({
      contacts: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });

    await loadContactsPage({
      page: 1,
      limit: 50,
      excludeLinkedModules: ["students", "faculty"],
    });

    expect(mockListContactsPage).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        page: 1,
        limit: 50,
        excludeLinkedModules: ["students", "faculty"],
      }),
    );
  });

  it("restoreContactById asserts uniqueness before clearing soft-delete", async () => {
    const deleted = contact({
      id: "c1",
      deletedAt: "2026-07-27T00:00:00.000Z",
      phones: [{ label: "Mobile", number: "3001112233", countryCode: "+92" }],
    });
    mockFindContactById.mockResolvedValue(deleted);

    const restored = await restoreContactById("c1");

    expect(mockAssertContactUniqueFields).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "c1", deletedAt: undefined }),
      "en",
      [],
      expect.anything(),
    );
    expect(mockSaveContact).toHaveBeenCalled();
    expect(restored?.deletedAt).toBeUndefined();
  });

  it("restoreContactById surfaces unique conflicts", async () => {
    mockFindContactById.mockResolvedValue(
      contact({ id: "c1", deletedAt: "2026-07-27T00:00:00.000Z" }),
    );
    mockAssertContactUniqueFields.mockRejectedValue(
      new ContactUniqueFieldError([
        { fieldId: "number", tabId: "phones", message: "must be unique" },
      ]),
    );

    await expect(restoreContactById("c1")).rejects.toBeInstanceOf(ContactUniqueFieldError);
    expect(mockSaveContact).not.toHaveBeenCalled();
  });

  it("bulkRestoreContacts skips unique conflicts", async () => {
    mockFindContactsByIds.mockResolvedValue([
      contact({ id: "c1", deletedAt: "2026-07-27T00:00:00.000Z" }),
      contact({ id: "c2", deletedAt: "2026-07-27T00:00:00.000Z" }),
    ]);
    mockAssertContactUniqueFields
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ContactUniqueFieldError([
          { fieldId: "number", tabId: "phones", message: "must be unique" },
        ]),
      );

    const result = await bulkRestoreContacts(["c1", "c2"]);

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.conflicts).toEqual([expect.objectContaining({ id: "c2" })]);
    expect(mockBulkSaveContacts).toHaveBeenCalledWith("demo", [
      expect.objectContaining({ id: "c1", deletedAt: undefined }),
    ]);
  });

  it("adds a reciprocal relationship link when creating a new contact", async () => {
    const source = contact({
      id: "a",
      name: "Aisha Khan",
      firstName: "Aisha",
      gender: "Female",
      relationshipContacts: [{ contactId: "b", relationship: "Parent" }],
    });
    const target = contact({
      id: "b",
      name: "Bilal Khan",
      firstName: "Bilal",
      gender: "Male",
      relationshipContacts: [],
    });
    mockFindContactsByIds.mockResolvedValue([target]);

    await upsertContact(source);

    expect(mockSaveContact).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "a" }));
    expect(mockFindContactsByIds).toHaveBeenCalledWith("demo", ["b"]);
    expect(mockBulkSaveContacts).toHaveBeenCalledWith("demo", [
      expect.objectContaining({
        id: "b",
        relationshipContacts: expect.arrayContaining([inferredLink("a", "Child", 1)]),
      }),
    ]);
    expect(mockInvalidateDuplicateScanCache).toHaveBeenCalled();
  });

  it("creates reciprocal links for Husband/Wife system pairs", async () => {
    const source = contact({
      id: "a",
      name: "Dr. Tariq",
      firstName: "Tariq",
      gender: "Male",
      relationshipContacts: [{ contactId: "b", relationship: "Husband" }],
    });
    const target = contact({
      id: "b",
      name: "Zayn Ahmad",
      firstName: "Zayn",
      gender: "Female",
      relationshipContacts: [],
    });
    mockFindContactsByIds.mockResolvedValue([target]);

    await upsertContact(source);

    expect(mockBulkSaveContacts).toHaveBeenCalledWith("demo", [
      expect.objectContaining({
        id: "b",
        relationshipContacts: expect.arrayContaining([inferredLink("a", "Wife", 1)]),
      }),
    ]);
  });

  it("uses explicit custom pairs override for reciprocal link creation in tests", async () => {
    const source = contact({
      id: "a",
      name: "Dr. Tariq",
      firstName: "Tariq",
      gender: "Male",
      relationshipContacts: [{ contactId: "b", relationship: "Mentor" }],
    });
    const target = contact({
      id: "b",
      name: "Zayn Ahmad",
      firstName: "Zayn",
      gender: "Male",
      relationshipContacts: [],
    });
    mockFindContactsByIds.mockResolvedValue([target]);

    await applyContactRelationshipInference("demo", source, [
      { id: "m1", forward: "Mentor", inverse: "Mentee" },
    ]);

    expect(mockBulkSaveContacts).toHaveBeenCalledWith("demo", [
      expect.objectContaining({
        id: "b",
        relationshipContacts: expect.arrayContaining([inferredLink("a", "Mentee", 1)]),
      }),
    ]);
  });

  it("updates the reciprocal relationship link when editing an existing contact", async () => {
    const existingSource = contact({
      id: "a",
      name: "Ahmed Khan",
      firstName: "Ahmed",
      gender: "Male",
    });
    const target = contact({
      id: "b",
      name: "Sara Khan",
      firstName: "Sara",
      gender: "Female",
      relationshipContacts: [
        { contactId: "a", relationship: "Other" },
        { contactId: "c", relationship: "Sister" },
      ],
    });
    mockFindContactById.mockResolvedValue(existingSource);
    mockFindContactsByIds.mockResolvedValue([target]);

    await updateContactById("a", {
      ...existingSource,
      relationshipContacts: [{ contactId: "b", relationship: "Child" }],
    });

    expect(mockBulkSaveContacts).toHaveBeenCalledWith("demo", [
      expect.objectContaining({
        id: "b",
        relationshipContacts: expect.arrayContaining([
          inferredLink("a", "Parent", 1),
          link("c", "Sister"),
        ]),
      }),
    ]);
  });

  it("maps guardian and husband reciprocal terms from the system catalog", async () => {
    const source = contact({
      id: "a",
      name: "Ahmed Khan",
      firstName: "Ahmed",
      gender: "Male",
      relationshipContacts: [
        { contactId: "c", relationship: "Husband" },
        { contactId: "d", relationship: "Guardian" },
      ],
    });
    mockFindContactsByIds.mockResolvedValue([
      contact({ id: "c", name: "Spouse One", firstName: "Spouse", gender: "Female" }),
      contact({ id: "d", name: "Guardian", firstName: "Guardian" }),
    ]);

    await upsertContact(source);

    expect(mockBulkSaveContacts).toHaveBeenCalledWith("demo", [
      expect.objectContaining({
        id: "c",
        relationshipContacts: expect.arrayContaining([inferredLink("a", "Wife", 1)]),
      }),
      expect.objectContaining({
        id: "d",
        relationshipContacts: expect.arrayContaining([inferredLink("a", "Dependent", 1)]),
      }),
    ]);
  });

  it("skips reciprocal inference for labels outside the system catalog", async () => {
    mockLoadContactPreferences.mockResolvedValue({ relationshipPairs: [] });
    const source = contact({
      id: "a",
      name: "Aisha Khan",
      firstName: "Aisha",
      gender: "Female",
      relationshipContacts: [{ contactId: "b", relationship: "Father" }],
    });
    mockFindContactsByIds.mockResolvedValue([
      contact({ id: "b", name: "Bilal Khan", firstName: "Bilal", gender: "Male" }),
    ]);

    await upsertContact(source);

    expect(mockBulkSaveContacts).not.toHaveBeenCalled();
  });

  it("writes reciprocal links from legacy relationships[] as well as relationshipContacts", async () => {
    const source = contact({
      id: "a",
      name: "Aisha Khan",
      firstName: "Aisha",
      gender: "Female",
      relationships: [{ contactId: "b", relationship: "Parent" }],
    });
    mockFindContactsByIds.mockResolvedValue([
      contact({ id: "b", name: "Bilal Khan", firstName: "Bilal", gender: "Male" }),
    ]);

    await upsertContact(source);

    expect(mockBulkSaveContacts).toHaveBeenCalledWith("demo", [
      expect.objectContaining({
        id: "b",
        relationshipContacts: expect.arrayContaining([inferredLink("a", "Child", 1)]),
      }),
    ]);
  });

  it("merges PUT updates onto the existing contact without wiping collections", async () => {
    mockFindContactById.mockResolvedValue(
      contact({
        id: "a",
        firstName: "Ahmed",
        phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92", isPrimary: true }],
        emails: [{ label: "Home", address: "ahmed@example.com" }],
        notes: "Keep me",
      }),
    );

    await updateContactById("a", {
      id: "a",
      firstName: "Ali",
      name: "Ali",
      lastName: "",
      relationshipContacts: [],
      relationships: [],
    } as Contact);

    expect(mockSaveContact).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        id: "a",
        firstName: "Ali",
        phones: [expect.objectContaining({ countryCode: "+92", number: "3001234567" })],
        emails: [expect.objectContaining({ label: "Home", address: "ahmed@example.com" })],
        notes: "Keep Me",
      }),
    );
  });

  it("persists an explicit empty phones array and clears the legacy phone scalar", async () => {
    mockFindContactById.mockResolvedValue(
      contact({
        id: "a",
        firstName: "Ahmed",
        phone: "+923001234567",
        phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92", isPrimary: true }],
      }),
    );

    await updateContactById("a", {
      id: "a",
      firstName: "Ahmed",
      name: "Ahmed",
      lastName: "",
      phones: [],
      phone: "",
      relationshipContacts: [],
      relationships: [],
    } as Contact);

    expect(mockSaveContact).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        id: "a",
        phones: [],
        phone: "",
      }),
    );
  });

  it("persists empty emails/addresses/socials and clears legacy scalars + relationships", async () => {
    mockFindContactById.mockResolvedValue(
      contact({
        id: "a",
        firstName: "Ahmed",
        email: "old@example.com",
        emails: [{ label: "Home", address: "old@example.com", isPrimary: true }],
        line1: "1 Main",
        city: "Lahore",
        address: "1 Main",
        addresses: [{ label: "Home", line1: "1 Main", city: "Lahore", isPrimary: true }],
        socials: [{ platform: "Instagram", url: "https://instagram.com/a" }],
        relationshipContacts: [{ relationship: "Father", contactId: "b" }],
        relationships: [{ contactId: "b", relationship: "father" }],
      }),
    );

    await updateContactById("a", {
      id: "a",
      firstName: "Ahmed",
      name: "Ahmed",
      lastName: "",
      emails: [],
      addresses: [],
      socials: [],
      relationshipContacts: [],
      relationships: [],
    } as Contact);

    expect(mockSaveContact).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        id: "a",
        emails: [],
        email: "",
        addresses: [],
        line1: "",
        city: "",
        address: "",
        socials: [],
        relationshipContacts: [],
        relationships: [],
      }),
    );
  });

  it("strips client soft-delete fields from prepare/upsert payloads", async () => {
    mockFindContactById.mockResolvedValue(null);

    await upsertContact(
      contact({
        id: "a",
        firstName: "Ahmed",
        deletedAt: "2026-01-01T00:00:00.000Z",
        deletedBy: "attacker",
        deletionReason: "forged",
      }),
    );

    expect(mockSaveContact).toHaveBeenCalledWith(
      "demo",
      expect.not.objectContaining({
        deletedAt: "2026-01-01T00:00:00.000Z",
        deletedBy: "attacker",
        deletionReason: "forged",
      }),
    );
  });

  it("soft-delete bulkSoftDelete includes deletedBy and deletionReason for column sync", async () => {
    mockBulkSoftDeleteContactsSql.mockResolvedValue({ succeeded: 1, failed: 0 });

    const result = await bulkSoftDeleteContacts(["a"], "u-admin", "Duplicate entry");

    expect(result).toEqual({ succeeded: 1, failed: 0 });
    expect(mockBulkSoftDeleteContactsSql).toHaveBeenCalledWith(
      "demo",
      ["a"],
      "u-admin",
      "Duplicate entry",
    );
  });
});

describe("contactService composition-root shim", () => {
  it("exposes the wrapped composition-root methods, not raw barrel functions", () => {
    expect(loadContactsPage).toBe(contactUseCases.loadContactsPage);
    expect(updateContactById).toBe(contactUseCases.updateContactById);
  });
});
