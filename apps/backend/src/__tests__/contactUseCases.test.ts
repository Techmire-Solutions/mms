import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact, ContactsListQuery, FieldConfig } from "@mms/shared";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";

const mockGetRequestTenant = vi.fn();
const mockBroadcastCollection = vi.fn();
const mockInvalidateDuplicateScanCache = vi.fn();
const mockLoadContactFieldConfig = vi.fn();
const mockGetDuplicateScanCache = vi.fn();
const mockLoadDuplicatePairsPage = vi.fn();
const mockCanDeleteContacts = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
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

vi.mock("../contacts/use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: (...args: unknown[]) => mockInvalidateDuplicateScanCache(...args),
  getDuplicateScanCache: (...args: unknown[]) => mockGetDuplicateScanCache(...args),
  loadDuplicatePairsPage: (...args: unknown[]) => mockLoadDuplicatePairsPage(...args),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: (...args: unknown[]) => mockLoadContactFieldConfig(...args),
}));

vi.mock("../contacts/use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: vi.fn().mockResolvedValue(null),
}));

vi.mock("../contacts/use-cases/contactLookupsService.js", () => ({
  loadContactLookupKind: vi.fn().mockResolvedValue([]),
}));

vi.mock("../lib/rbacCanHelpers.js", () => ({
  canDeleteContacts: (...args: unknown[]) => mockCanDeleteContacts(...args),
}));

import { createContactsUseCases } from "../contacts/use-cases/contactUseCases.js";
import { ContactUniqueFieldError } from "../contacts/use-cases/contactValidationUseCases.js";
import { ContactPermissionError } from "../contacts/use-cases/contactValidationUseCases.js";
import type { ContactDuplicateCandidateKeys } from "../contacts/repository/contactsRepository.js";
import { loadContactLookupKind } from "../contacts/use-cases/contactLookupsService.js";
import { loadContactPreferences } from "../contacts/use-cases/contactPreferencesService.js";

function fakeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name: `Contact ${id}`,
    firstName: `Contact`,
    lastName: id,
    relationshipContacts: [],
    relationships: [],
    ...overrides,
  };
}

/** In-memory fake repository — the DI seam the use cases are designed against. */
function createFakeRepo() {
  const store = new Map<string, Contact>();
  return {
    store,
    repo: {
      countByWorkspace: vi.fn(async (tenant: string) => {
        void tenant;
        return [...store.values()].filter((c) => c.deletedAt === undefined).length;
      }),
      listPage: vi.fn(async (tenant: string, query: ContactsListQuery) => {
        void tenant;
        const rows = [...store.values()].filter((c) => c.deletedAt === undefined);
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        const start = (page - 1) * limit;
        return {
          contacts: rows.slice(start, start + limit),
          total: rows.length,
          page,
          limit,
          hasMore: start + limit < rows.length,
        };
      }),
      findById: vi.fn(async (tenant: string, id: string) => {
        void tenant;
        return store.get(id) ?? null;
      }),
      findByIds: vi.fn(async (tenant: string, ids: string[]) => {
        void tenant;
        return ids.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c));
      }),
      save: vi.fn(async (tenant: string, contact: Contact) => {
        void tenant;
        store.set(String(contact.id), contact);
      }),
      bulkSave: vi.fn(async (tenant: string, contacts: Contact[]) => {
        void tenant;
        contacts.forEach((contact) => store.set(String(contact.id), contact));
      }),
      findExistingNormalizedContactNames: vi.fn(async () => new Set<string>()),
      findActiveContactsMatchingUniqueValues: vi.fn(async () => []),
      findContactDuplicateCandidateIds: vi.fn(
        async (tenant: string, keys: ContactDuplicateCandidateKeys) => {
          void tenant;
          const phoneSet = new Set(keys.phones);
          return [...store.values()]
            .filter((c) => c.deletedAt === undefined)
            .filter((c) => (c.phones ?? []).some((p) => phoneSet.has(p.number ?? "")))
            .map((c) => String(c.id));
        },
      ),
      findContactDuplicateBlockedIds: vi.fn(async () => []),
      reparentContactReferences: vi.fn(async () => undefined),
      acquireUniqueValueLocks: vi.fn(async () => undefined),
      aggregateCommandMetrics: vi.fn(
        async (_tenant: string, _config: unknown, extra?: { duplicatePairCount?: number }) => ({
          total: 0,
          newThisPeriod: 0,
          whatsappCount: 0,
          incompleteCount: 0,
          duplicatePairCount: extra?.duplicatePairCount ?? 0,
        }),
      ),
      aggregateReportAnalytics: vi.fn(async () => ({
        total: 0,
        activeCount: 0,
        whatsappCount: 0,
        whatsappRate: 0,
        missingInfoCount: 0,
        newLast30Days: 0,
        newPrior30Days: 0,
        newThisPeriod: 0,
        hasSignupDates: false,
        growthRecentSignups30d: 0,
        growthPriorSignups30d: 0,
      })),
      aggregateMonthlyCreatedCounts: vi.fn(async () => []),
      aggregateWidgetQueries: vi.fn(async () => ({})),
    } as unknown as ContactsRepository,
  };
}

/** Field config with one enabled unique email field — for unique-field conflict tests. */
function makeUniqueEmailFieldConfig(): FieldConfig {
  return {
    version: 1,
    enabledTabs: ["emails"],
    requiredTabs: [],
    fields: {
      emails: [
        { key: "address", label: "Email", type: "email", enabled: true, order: 0, unique: true },
      ],
    },
    formTabs: [],
  };
}

describe("createContactsUseCases (DI composition root)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
    mockBroadcastCollection.mockResolvedValue(undefined);
    mockInvalidateDuplicateScanCache.mockResolvedValue(undefined);
    mockLoadContactFieldConfig.mockResolvedValue(null);
    mockGetDuplicateScanCache.mockResolvedValue(null);
    mockCanDeleteContacts.mockReturnValue(true);
  });

  it("loadContactsPage returns paged rows from the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    store.set("b", fakeContact("b"));
    store.set("c", fakeContact("c"));
    const useCases = createContactsUseCases(repo);

    const page = await useCases.loadContactsPage({ page: 2, limit: 2 });
    expect(page.contacts.map((c) => c.id)).toEqual(["c"]);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(false);
  });

  it("upsertContact creates a record through the injected repo", async () => {
    const { repo } = createFakeRepo();
    const useCases = createContactsUseCases(repo);

    const { contact, created } = await useCases.upsertContact(
      fakeContact("new-1", { firstName: "Aisha" }),
    );
    expect(created).toBe(true);
    expect(contact.id).toBe("new-1");
    expect(repo.save).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "new-1" }));
    expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
  });

  it("upsertContact merges a patch onto an existing active record", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a", { firstName: "Old" }));
    const useCases = createContactsUseCases(repo);

    const { contact, created } = await useCases.upsertContact(
      fakeContact("a", { firstName: "New" }),
    );
    expect(created).toBe(false);
    expect(contact.firstName).toBe("New");
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "a", firstName: "New" }),
    );
  });

  it("upsertContact rejects restoring a deleted record when canRestore is false", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createContactsUseCases(repo);

    await expect(
      useCases.upsertContact(fakeContact("a"), { canRestore: false }),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("upsertContact rejects restoring a deleted record when the user lacks delete permission", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createContactsUseCases(repo);
    mockCanDeleteContacts.mockReturnValue(false);

    await expect(
      useCases.upsertContact(fakeContact("a"), {
        user: {
          id: "u-1",
          email: "t@mms.test",
          name: "T",
          role: "teacher",
          workspaceSubdomain: "demo",
        },
      }),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    expect(mockCanDeleteContacts).toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("updateContactById returns null for a missing id", async () => {
    const { repo } = createFakeRepo();
    const useCases = createContactsUseCases(repo);

    expect(await useCases.updateContactById("missing", fakeContact("missing"))).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("updateContactById returns null for a soft-deleted id", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createContactsUseCases(repo);

    expect(await useCases.updateContactById("a", fakeContact("a"))).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("updateContactById merges the patch and keeps soft-delete fields undefined for active records", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    const useCases = createContactsUseCases(repo);

    const updated = await useCases.updateContactById("a", fakeContact("a", { firstName: "New" }));
    expect(updated?.id).toBe("a");
    expect(updated?.firstName).toBe("New");
    expect(updated?.deletedAt).toBeUndefined();
    expect(repo.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "a", firstName: "New" }),
    );
  });

  it("updateContactById applies relationship inference by default", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    store.set("b", fakeContact("b"));
    const useCases = createContactsUseCases(repo);

    await useCases.updateContactById(
      "a",
      fakeContact("a", { relationshipContacts: [{ contactId: "b", relationship: "Parent" }] }),
    );
    expect(repo.bulkSave).toHaveBeenCalled();
  });

  it("updateContactById skips relationship inference when disabled", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    store.set("b", fakeContact("b"));
    const useCases = createContactsUseCases(repo);

    await useCases.updateContactById(
      "a",
      fakeContact("a", { relationshipContacts: [{ contactId: "b", relationship: "Parent" }] }),
      { applyRelationshipInference: false },
    );
    expect(repo.bulkSave).not.toHaveBeenCalled();
  });

  it("softDeleteContactById clears only active rows via the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    const useCases = createContactsUseCases(repo);

    const ok = await useCases.softDeleteContactById("a", "u-admin", "Duplicate");
    expect(ok).toBe(true);
    const saved = store.get("a");
    expect(saved?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(saved?.deletedBy).toBe("u-admin");
    expect(saved?.deletionReason).toBe("Duplicate");
  });

  it("softDeleteContactById reports failure for an already-deleted row", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createContactsUseCases(repo);

    const ok = await useCases.softDeleteContactById("a", "u-admin");
    expect(ok).toBe(false);
  });

  it("restoreContactById clears soft-delete fields on the stored record", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "a",
      fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z", deletedBy: "u-admin" }),
    );
    const useCases = createContactsUseCases(repo);

    const restored = await useCases.restoreContactById("a");
    expect(restored?.deletedAt).toBeUndefined();
    expect(store.get("a")?.deletedAt).toBeUndefined();
  });

  it("restoreContactById returns the existing active record unchanged", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    const useCases = createContactsUseCases(repo);

    const restored = await useCases.restoreContactById("a");
    expect(restored?.id).toBe("a");
    expect(restored?.deletedAt).toBeUndefined();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("getContactById hides deleted rows unless includeDeleted is set", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createContactsUseCases(repo);

    expect(await useCases.getContactById("a")).toBeNull();
    expect((await useCases.getContactById("a", true))?.id).toBe("a");
  });

  it("countContacts counts only active rows via the injected repo", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    store.set("b", fakeContact("b"));
    store.set("gone", fakeContact("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createContactsUseCases(repo);

    expect(await useCases.countContacts()).toBe(2);
    expect(repo.countByWorkspace).toHaveBeenCalledWith("demo", { deleted: "active" });
  });

  it("loadContactsByIds returns [] for empty input and filters deleted rows", async () => {
    const { repo, store } = createFakeRepo();
    const useCases = createContactsUseCases(repo);

    expect(await useCases.loadContactsByIds([])).toEqual([]);
    expect(repo.findByIds).not.toHaveBeenCalled();

    store.set("a", fakeContact("a"));
    store.set("gone", fakeContact("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const loaded = await useCases.loadContactsByIds(["a", "gone"]);
    expect(loaded.map((c) => c.id)).toEqual(["a"]);
    expect(repo.findByIds).toHaveBeenCalledWith("demo", ["a", "gone"]);
  });

  it("loadContactsCommandMetrics excludes name-only duplicate pairs from the count", async () => {
    const { repo } = createFakeRepo();
    mockGetDuplicateScanCache.mockResolvedValue({
      pairs: [{ reasonKey: "name" }, { reasonKey: "phone" }, { reasonKey: "email" }],
    } as never);
    const useCases = createContactsUseCases(repo);

    const metrics = await useCases.loadContactsCommandMetrics();
    expect(repo.aggregateCommandMetrics).toHaveBeenCalledWith("demo", expect.any(Object), {
      duplicatePairCount: 2,
    });
    expect(metrics.duplicatePairCount).toBe(2);
  });

  it("loadContactsReportAnalytics skips monthly counts when no compareYears are given", async () => {
    const { repo } = createFakeRepo();
    const useCases = createContactsUseCases(repo);

    const result = await useCases.loadContactsReportAnalytics();
    expect(repo.aggregateReportAnalytics).toHaveBeenCalledWith("demo");
    expect(repo.aggregateMonthlyCreatedCounts).not.toHaveBeenCalled();
    expect(result.monthlyByYear).toBeUndefined();
  });

  it("loadContactRuntimeDefaults resolves country code from preferences defaultCountry", async () => {
    const useCases = createContactsUseCases(createFakeRepo().repo);
    vi.mocked(loadContactLookupKind).mockImplementation(async (kind) => {
      if (kind === "countryCodes") {
        return [
          { country: "Pakistan", code: "+92" },
          { country: "Saudi Arabia", code: "+966" },
        ];
      }
      if (kind === "phoneLabels") return ["Work"];
      if (kind === "emailLabels") return ["Primary"];
      return [];
    });
    vi.mocked(loadContactPreferences).mockResolvedValue({ defaultCountry: "Pakistan" } as never);

    const defaults = await useCases.loadContactRuntimeDefaults();

    expect(defaults).toEqual({
      defaultPhoneCountryCode: "+92",
      phoneLabel: "Work",
      emailLabel: "Primary",
    });
    expect(loadContactLookupKind).toHaveBeenCalledWith("countryCodes");
    expect(loadContactLookupKind).toHaveBeenCalledWith("phoneLabels");
    expect(loadContactLookupKind).toHaveBeenCalledWith("emailLabels");
  });

  it("loadContactRuntimeDefaults falls back to first country code when defaultCountry is unset", async () => {
    const useCases = createContactsUseCases(createFakeRepo().repo);
    vi.mocked(loadContactLookupKind).mockResolvedValue([
      { country: "Saudi Arabia", code: "+966" },
      { country: "Pakistan", code: "+92" },
    ]);
    vi.mocked(loadContactPreferences).mockResolvedValue(null);

    const defaults = await useCases.loadContactRuntimeDefaults();

    expect(defaults.defaultPhoneCountryCode).toBe("+966");
  });

  it("loadContactRuntimeDefaults resolves phone/email labels from their lookup kinds", async () => {
    const useCases = createContactsUseCases(createFakeRepo().repo);
    vi.mocked(loadContactLookupKind).mockImplementation(async (kind) => {
      if (kind === "phoneLabels") return ["Mobile"];
      if (kind === "emailLabels") return ["Home"];
      return [];
    });
    vi.mocked(loadContactPreferences).mockResolvedValue(null);

    const defaults = await useCases.loadContactRuntimeDefaults();

    expect(defaults.phoneLabel).toBe("Mobile");
    expect(defaults.emailLabel).toBe("Home");
    expect(defaults.defaultPhoneCountryCode).toBe("");
  });

  it("loadContactsReportAnalytics adds monthly created counts for compareYears", async () => {
    const { repo } = createFakeRepo();
    const useCases = createContactsUseCases(repo);

    const result = await useCases.loadContactsReportAnalytics({
      compareYears: [2025, 2026],
      language: "ur",
    });
    expect(repo.aggregateMonthlyCreatedCounts).toHaveBeenCalledWith("demo", [2025, 2026], 6, "ur");
    expect(result.monthlyByYear).toEqual([]);
  });

  it("loadContactsWidgetAggregates passes queries to the injected repo", async () => {
    const { repo } = createFakeRepo();
    const useCases = createContactsUseCases(repo);

    await useCases.loadContactsWidgetAggregates([{ id: "w1", operation: "count" }]);
    expect(repo.aggregateWidgetQueries).toHaveBeenCalledWith("demo", [
      { id: "w1", operation: "count" },
    ]);
  });

  it("matchContactIdentityIndex normalizes inputs and collects matching values", async () => {
    const { repo } = createFakeRepo();
    vi.mocked(repo.findActiveContactsMatchingUniqueValues).mockResolvedValue([
      fakeContact("peer", {
        phones: [{ label: "Mobile", number: "+923001234567" }],
        emails: [{ label: "Primary", address: "Alice@Example.com" }],
      }),
    ]);
    vi.mocked(repo.findExistingNormalizedContactNames).mockResolvedValue(
      new Set(["alice", "charlie"]),
    );
    const useCases = createContactsUseCases(repo);

    const result = await useCases.matchContactIdentityIndex({
      phones: ["3001234567"],
      emails: ["Alice@Example.com"],
      names: ["  Alice  ", "Bob"],
    });

    expect(repo.findActiveContactsMatchingUniqueValues).toHaveBeenCalledWith("demo", {
      phoneDigits: ["3001234567"],
      emails: ["alice@example.com"],
      scalars: [],
    });
    expect(repo.findExistingNormalizedContactNames).toHaveBeenCalledWith("demo", ["alice", "bob"]);
    expect(result).toEqual({
      phones: ["3001234567"],
      emails: ["alice@example.com"],
      names: ["alice"],
    });
  });

  it("assertContactUniqueFields throws ContactUniqueFieldError on a colliding peer", async () => {
    const { repo } = createFakeRepo();
    mockLoadContactFieldConfig.mockResolvedValue(makeUniqueEmailFieldConfig());
    vi.mocked(repo.findActiveContactsMatchingUniqueValues).mockResolvedValue([
      fakeContact("peer", { emails: [{ label: "Primary", address: "same@example.com" }] }),
    ]);
    const useCases = createContactsUseCases(repo);

    await expect(
      useCases.assertContactUniqueFields(
        "demo",
        fakeContact("new-1", { emails: [{ label: "Primary", address: "same@example.com" }] }),
        { acquireLocks: false },
      ),
    ).rejects.toBeInstanceOf(ContactUniqueFieldError);
  });

  it("assertContactUniqueFields resolves for a clean unique value", async () => {
    const { repo } = createFakeRepo();
    mockLoadContactFieldConfig.mockResolvedValue(makeUniqueEmailFieldConfig());
    const useCases = createContactsUseCases(repo);

    await expect(
      useCases.assertContactUniqueFields(
        "demo",
        fakeContact("new-1", { emails: [{ label: "Primary", address: "new@example.com" }] }),
        { acquireLocks: false },
      ),
    ).resolves.toBeUndefined();
  });

  it("assertContactUniqueFields acquires advisory locks by default", async () => {
    const { repo } = createFakeRepo();
    mockLoadContactFieldConfig.mockResolvedValue(makeUniqueEmailFieldConfig());
    const useCases = createContactsUseCases(repo);

    await useCases.assertContactUniqueFields(
      "demo",
      fakeContact("new-1", { emails: [{ label: "Primary", address: "new@example.com" }] }),
    );

    expect(repo.acquireUniqueValueLocks).toHaveBeenCalledWith(
      "demo",
      expect.arrayContaining([expect.stringContaining("emails:address:")]),
    );
  });

  it("bulkSoftDeleteContacts splits succeeded and failed rows", async () => {
    const { repo, store } = createFakeRepo();
    store.set("a", fakeContact("a"));
    store.set("gone", fakeContact("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }));
    const useCases = createContactsUseCases(repo);

    const result = await useCases.bulkSoftDeleteContacts(["a", "gone"], "u-admin", "  Duplicate  ");
    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(store.get("a")?.deletedBy).toBe("u-admin");
    expect(store.get("a")?.deletionReason).toBe("Duplicate");
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [expect.objectContaining({ id: "a" })]);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
    expect(mockInvalidateDuplicateScanCache).toHaveBeenCalled();
  });

  it("bulkRestoreContacts restores deleted rows and reports active rows as failed", async () => {
    const { repo, store } = createFakeRepo();
    store.set(
      "a",
      fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z", deletedBy: "u-admin" }),
    );
    store.set("active", fakeContact("active"));
    const useCases = createContactsUseCases(repo);

    const result = await useCases.bulkRestoreContacts(["a", "active"]);
    expect(result).toEqual({ succeeded: 1, failed: 1, conflicts: [] });
    expect(store.get("a")?.deletedAt).toBeUndefined();
    expect(repo.bulkSave).toHaveBeenCalledWith("demo", [expect.objectContaining({ id: "a" })]);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
    expect(mockInvalidateDuplicateScanCache).toHaveBeenCalled();
  });

  it("bulkRestoreContacts collects conflicts when a restore collides with an accepted peer", async () => {
    const { repo, store } = createFakeRepo();
    mockLoadContactFieldConfig.mockResolvedValue(makeUniqueEmailFieldConfig());
    const sharedEmail = [{ label: "Primary", address: "same@example.com" }];
    store.set(
      "a",
      fakeContact("a", { deletedAt: "2026-07-27T00:00:00.000Z", emails: sharedEmail }),
    );
    store.set(
      "b",
      fakeContact("b", { deletedAt: "2026-07-27T00:00:00.000Z", emails: sharedEmail }),
    );
    const useCases = createContactsUseCases(repo);

    const result = await useCases.bulkRestoreContacts(["a", "b"]);

    expect(result).toMatchObject({ succeeded: 1, failed: 1 });
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts?.[0]?.id).toBe("b");
  });

  it("bulkRestoreContacts and bulkSoftDeleteContacts match numeric contact IDs", async () => {
    const { repo, store } = createFakeRepo();
    // Simulate contact having a numeric ID
    const numContact = {
      ...fakeContact("101"),
      id: 101 as unknown as string,
      deletedAt: "2026-07-27T00:00:00.000Z",
    };
    store.set("101", numContact);
    const useCases = createContactsUseCases(repo);

    const restoreResult = await useCases.bulkRestoreContacts(["101"]);
    expect(restoreResult).toEqual({ succeeded: 1, failed: 0, conflicts: [] });
    expect(store.get("101")?.deletedAt).toBeUndefined();

    const deleteResult = await useCases.bulkSoftDeleteContacts(["101"], "admin", "Testing");
    expect(deleteResult).toEqual({ succeeded: 1, failed: 0 });
    expect(store.get("101")?.deletedAt).toBeDefined();
  });

  describe("mergeContactsById", () => {
    it("merges the keep contact and soft-deletes the other record", async () => {
      const { repo, store } = createFakeRepo();
      store.set("c1", fakeContact("c1", { firstName: "Aisha" }));
      store.set("c2", fakeContact("c2", { firstName: "Bilal" }));
      const useCases = createContactsUseCases(repo);

      const merged = await useCases.mergeContactsById("c1", "c2", undefined, "u-admin");

      expect(merged.id).toBe("c1");
      expect(merged.deletedAt).toBeUndefined();
      expect(merged.deletedBy).toBeUndefined();
      expect(merged.deletionReason).toBeUndefined();
      const other = store.get("c2");
      expect(other?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(other?.deletedBy).toBe("u-admin");
      expect(other?.deletionReason).toBe("Merged into c1");
      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
      expect(mockInvalidateDuplicateScanCache).toHaveBeenCalled();
    });

    it("applies mergedInput onto the keep id", async () => {
      const { repo, store } = createFakeRepo();
      store.set("c1", fakeContact("c1"));
      store.set("c2", fakeContact("c2"));
      const useCases = createContactsUseCases(repo);

      const merged = await useCases.mergeContactsById(
        "c1",
        "c2",
        fakeContact("c1", { firstName: "Merged" }),
        "u-admin",
      );

      expect(merged.id).toBe("c1");
      expect(merged.firstName).toBe("Merged");
    });

    it("rejects merging a contact into itself", async () => {
      const { repo } = createFakeRepo();
      const useCases = createContactsUseCases(repo);

      await expect(useCases.mergeContactsById("c1", "c1", undefined, "u-admin")).rejects.toThrow(
        "Cannot merge a contact into itself",
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("rejects a missing or deleted keep contact", async () => {
      const { repo, store } = createFakeRepo();
      store.set("c2", fakeContact("c2"));
      const useCases = createContactsUseCases(repo);

      await expect(
        useCases.mergeContactsById("missing", "c2", undefined, "u-admin"),
      ).rejects.toThrow("Keep contact not found");

      store.set("c1", fakeContact("c1", { deletedAt: "2026-07-27T00:00:00.000Z" }));
      await expect(useCases.mergeContactsById("c1", "c2", undefined, "u-admin")).rejects.toThrow(
        "Keep contact not found",
      );
    });

    it("rejects a missing or deleted delete-target", async () => {
      const { repo, store } = createFakeRepo();
      store.set("c1", fakeContact("c1"));
      const useCases = createContactsUseCases(repo);

      await expect(
        useCases.mergeContactsById("c1", "missing", undefined, "u-admin"),
      ).rejects.toThrow("Delete contact not found");

      store.set("c2", fakeContact("c2", { deletedAt: "2026-07-27T00:00:00.000Z" }));
      await expect(useCases.mergeContactsById("c1", "c2", undefined, "u-admin")).rejects.toThrow(
        "Delete contact not found",
      );
    });

    it("excludes the deleteId from unique-field conflicts", async () => {
      const { repo, store } = createFakeRepo();
      mockLoadContactFieldConfig.mockResolvedValue(makeUniqueEmailFieldConfig());
      const other = fakeContact("c2", {
        emails: [{ label: "Primary", address: "same@example.com" }],
      });
      store.set(
        "c1",
        fakeContact("c1", { emails: [{ label: "Primary", address: "same@example.com" }] }),
      );
      store.set("c2", other);
      vi.mocked(repo.findActiveContactsMatchingUniqueValues).mockImplementation(
        async (_tenant, _values, excludeIds) => ((excludeIds ?? []).includes("c2") ? [] : [other]),
      );
      const useCases = createContactsUseCases(repo);

      const merged = await useCases.mergeContactsById("c1", "c2", undefined, "u-admin");

      expect(merged.id).toBe("c1");
      expect(repo.findActiveContactsMatchingUniqueValues).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({ emails: ["same@example.com"] }),
        expect.arrayContaining(["c2"]),
      );
    });
  });
});

describe("duplicate-scan use cases (DI)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
  });

  it("loadContactDuplicatePairsPage delegates to the service with the injected repo", async () => {
    mockLoadDuplicatePairsPage.mockResolvedValue({
      pairs: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    });
    const { repo } = createFakeRepo();
    const useCases = createContactsUseCases(repo);

    await useCases.loadContactDuplicatePairsPage({ page: 1, limit: 10 });

    expect(mockLoadDuplicatePairsPage).toHaveBeenCalledWith({ page: 1, limit: 10 }, repo);
  });
});

describe("bulkTagContacts use case", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
  });

  it("adds and removes tags atomically and broadcasts collection change", async () => {
    const { repo, store } = createFakeRepo();
    store.set("c-1", fakeContact("c-1", { tags: ["VIP", "Donor"] }));
    store.set("c-2", fakeContact("c-2", { tags: ["Volunteer"] }));

    const useCases = createContactsUseCases(repo);
    const result = await useCases.bulkTagContacts(["c-1", "c-2"], {
      addTags: ["2026", "Ramadan"],
      removeTags: ["vip"],
    });

    expect(result.updatedCount).toBe(2);
    expect(store.get("c-1")?.tags).toEqual(["Donor", "2026", "Ramadan"]);
    expect(store.get("c-2")?.tags).toEqual(["Volunteer", "2026", "Ramadan"]);
    expect(repo.bulkSave).toHaveBeenCalledTimes(1);
    expect(repo.save).not.toHaveBeenCalled();
    expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
  });

  it("skips soft-deleted contacts during bulk tagging", async () => {
    const { repo, store } = createFakeRepo();
    store.set("c-1", fakeContact("c-1", { tags: ["Active"] }));
    store.set(
      "c-2",
      fakeContact("c-2", { tags: ["Deleted"], deletedAt: new Date().toISOString() }),
    );

    const useCases = createContactsUseCases(repo);
    const result = await useCases.bulkTagContacts(["c-1", "c-2"], {
      addTags: ["Tagged"],
    });

    expect(result.updatedCount).toBe(1);
    expect(store.get("c-1")?.tags).toEqual(["Active", "Tagged"]);
    expect(store.get("c-2")?.tags).toEqual(["Deleted"]);
  });
});
