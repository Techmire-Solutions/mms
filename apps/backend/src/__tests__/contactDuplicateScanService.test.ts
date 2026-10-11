import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findContactDuplicatePairs,
  getContactDuplicateCandidateKeys,
  CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY,
  type Contact,
} from "@mms/shared";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";
import type { ContactDuplicateCandidateKeys } from "../contacts/repository/contactsRepository.js";

const mockFetchObject = vi.fn();
const mockDeletePersistedObject = vi.fn();
const mockPersistObject = vi.fn();
const mockLoadContactPreferences = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../db/database.js", () => ({
  getObject: (...args: unknown[]) => mockFetchObject(...args),
  deleteObject: (...args: unknown[]) => mockDeletePersistedObject(...args),
  saveObject: (...args: unknown[]) => mockPersistObject(...args),
}));

vi.mock("../contacts/use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: (...args: unknown[]) => mockLoadContactPreferences(...args),
}));

import {
  countContactDuplicateMatches,
  loadDuplicatePairsPage,
  runContactsDuplicateScan,
} from "../services/contactDuplicateScanService.js";

function contact(id: string, name: string, phone?: string, email?: string): Contact {
  return {
    id,
    name,
    firstName: name,
    phones: phone ? [{ label: "mobile", number: phone }] : [],
    emails: email ? [{ label: "personal", address: email }] : [],
  };
}

/** Fake repo mirroring the SQL blocking semantics (ids sharing a normalized key). */
function createFakeRepo(store: Map<string, Contact>) {
  const active = () => [...store.values()].filter((c) => c.deletedAt === undefined);
  return {
    countByWorkspace: vi.fn(async () => active().length),
    listPage: vi.fn(async () => ({ contacts: [], total: 0, page: 1, limit: 50, hasMore: false })),
    findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
    findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c)),
    ),
    save: vi.fn(async () => undefined),
    bulkSave: vi.fn(async () => undefined),
    findExistingNormalizedContactNames: vi.fn(async () => new Set<string>()),
    findActiveContactsMatchingUniqueValues: vi.fn(async () => []),
    findContactDuplicateCandidateIds: vi.fn(
      async (_tenant: string, keys: ContactDuplicateCandidateKeys) =>
        active()
          .filter((c) => {
            const candidate = getContactDuplicateCandidateKeys(c, {});
            return (
              candidate.phones.some((p) => keys.phones.includes(p)) ||
              candidate.emails.some((e) => keys.emails.includes(e))
            );
          })
          .map((c) => String(c.id)),
    ),
    findContactDuplicateBlockedIds: vi.fn(async (_tenant: string) => {
      const seen = new Map<string, string[]>();
      for (const c of active()) {
        const keys = getContactDuplicateCandidateKeys(c, {});
        for (const key of [...keys.phones, ...keys.emails]) {
          if (!key) continue;
          const bucket = seen.get(key) ?? [];
          bucket.push(String(c.id));
          seen.set(key, bucket);
        }
        if (keys.name) {
          const bucket = seen.get(keys.name) ?? [];
          bucket.push(String(c.id));
          seen.set(keys.name, bucket);
        }
      }
      const participants = new Set<string>();
      for (const ids of seen.values()) {
        if (new Set(ids).size >= 2) ids.forEach((id) => participants.add(id));
      }
      return [...participants];
    }),
    countFieldUsageByKeys: vi.fn(async () => ({})),
    aggregateCommandMetrics: vi.fn(async () => ({
      total: 0,
      newThisPeriod: 0,
      whatsappCount: 0,
      incompleteCount: 0,
      duplicatePairCount: 0,
    })),
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
  } as unknown as ContactsRepository;
}

describe("contactDuplicateScanService (SQL-scoped)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchObject.mockResolvedValue(null);
    mockDeletePersistedObject.mockResolvedValue(undefined);
    mockPersistObject.mockResolvedValue(undefined);
    mockLoadContactPreferences.mockResolvedValue(null);
  });

  it("countContactDuplicateMatches matches the full-set count without walking the tenant", async () => {
    const store = new Map<string, Contact>();
    const a = contact("a", "Alice", "+923001111111");
    const b = contact("b", "Bob", "+923001111111");
    const c = contact("c", "Charlie", "+923002222222");
    store.set("a", a);
    store.set("b", b);
    store.set("c", c);
    const repo = createFakeRepo(store);

    const expected = findContactDuplicatePairs([a, b, c], {}).filter((pair) =>
      pair.contacts.some((row) => String(row.id) === "b"),
    ).length;
    const matchCount = await countContactDuplicateMatches(b, repo);

    expect(matchCount).toBe(expected);
    expect(repo.listPage).not.toHaveBeenCalled();
  });

  it("returns zero matches when no candidate shares a key", async () => {
    const store = new Map<string, Contact>();
    store.set("a", contact("a", "Alice", "+923001111111"));
    const repo = createFakeRepo(store);

    const matchCount = await countContactDuplicateMatches(
      contact("z", "Zed", "+923009999999"),
      repo,
    );

    expect(matchCount).toBe(0);
    expect(repo.findByIds).not.toHaveBeenCalled();
  });

  it("countContactDuplicateMatches matches draft contact when id is null or undefined", async () => {
    const store = new Map<string, Contact>();
    const a = contact("a", "Alice", "+923001111111");
    store.set("a", a);
    const repo = createFakeRepo(store);

    // New draft in UI without assigned id or with null id
    const draft = {
      ...contact("", "Alice Draft", "+923001111111"),
      id: null as unknown as string,
    };
    const matchCount = await countContactDuplicateMatches(draft, repo);

    expect(matchCount).toBe(1);
  });

  it("runContactsDuplicateScan hydrates only blocked participants and persists the cache", async () => {
    const store = new Map<string, Contact>();
    const a = contact("a", "Alice", "+923001111111");
    const b = contact("b", "Bob", "+923001111111");
    const c = contact("c", "Charlie", "+923002222222");
    store.set("a", a);
    store.set("b", b);
    store.set("c", c);
    const repo = createFakeRepo(store);
    const progress = vi.fn();

    const result = await runContactsDuplicateScan(progress, repo);

    expect(result).toEqual({ pairCount: 1, contactCount: 3 });
    expect(mockPersistObject).toHaveBeenCalledWith(
      CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY,
      expect.objectContaining({ pairCount: 1, contactCount: 3 }),
    );
    expect(repo.findByIds).toHaveBeenCalledWith("demo", expect.arrayContaining(["a", "b"]));
    expect(repo.listPage).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalled();
  });

  it("loadDuplicatePairsPage warms the cache from the blocked participant set", async () => {
    const store = new Map<string, Contact>();
    const a = contact("a", "Alice", "+923001111111");
    const b = contact("b", "Bob", "+923001111111");
    const c = contact("c", "Charlie", "+923002222222");
    store.set("a", a);
    store.set("b", b);
    store.set("c", c);
    const repo = createFakeRepo(store);

    const page = await loadDuplicatePairsPage({ page: 1, limit: 50 }, repo);

    expect(page.total).toBe(1);
    expect(repo.findByIds).toHaveBeenCalledWith("demo", ["a", "b"]);
    expect(repo.findByIds).not.toHaveBeenCalledWith("demo", expect.arrayContaining(["c"]));
  });

  it("loadDuplicatePairsPage uses the persisted cache when present", async () => {
    const store = new Map<string, Contact>();
    store.set("a", contact("a", "Alice", "+923001111111"));
    store.set("b", contact("b", "Bob", "+923001111111"));
    const repo = createFakeRepo(store);
    const cached = {
      computedAt: "2026-08-10T00:00:00.000Z",
      contactCount: 2,
      pairCount: 1,
      pairs: findContactDuplicatePairs([...store.values()], {}),
    };
    mockFetchObject.mockResolvedValue(cached);

    const page = await loadDuplicatePairsPage({ page: 1, limit: 50 }, repo);

    expect(page.total).toBe(1);
    expect(repo.findByIds).not.toHaveBeenCalled();
    expect(repo.findContactDuplicateBlockedIds).not.toHaveBeenCalled();
  });
});
