import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";

const { mockLoadContactPreferences, mockSaveObject, mockGetObject, mockDeleteObject } = vi.hoisted(
  () => ({
    mockLoadContactPreferences: vi.fn<(tenantId?: string) => Promise<unknown>>(),
    mockSaveObject: vi.fn<(key: string, data: unknown) => Promise<unknown>>(async () => undefined),
    mockGetObject: vi.fn<(key: string) => Promise<unknown>>(async () => null),
    mockDeleteObject: vi.fn<(key: string) => Promise<void>>(async () => undefined),
  }),
);

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../db/database.js", () => ({
  getObject: (key: string) => mockGetObject(key),
  deleteObject: (key: string) => mockDeleteObject(key),
  saveObject: (key: string, data: unknown) => mockSaveObject(key, data),
}));

vi.mock("../contacts/use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: (tenantId?: string) => mockLoadContactPreferences(tenantId),
}));

import {
  countContactDuplicateMatches,
  getDuplicateScanCache,
  invalidateDuplicateScanCache,
  loadDuplicatePairs,
  loadDuplicatePairsPage,
  runContactsDuplicateScan,
} from "../contacts/use-cases/contactDuplicateScanUseCases.js";
import { withTenantRead } from "../db/tenant-context.js";
import { contact, createFakeRepo } from "./__fixtures__/contactDuplicateRepo.factory.js";

describe("contactDuplicateScanUseCases", () => {
  beforeEach(() => {
    mockLoadContactPreferences.mockResolvedValue(null);
  });

  describe("exact-name duplicates", () => {
    it("given two contacts whose names differ only in case and spacing, should list them as a name pair", async () => {
      // Arrange
      const store = new Map<string, Contact>();
      store.set("a", contact("a", "Muhammad Ali"));
      store.set("b", contact("b", "  muhammad   ALI "));
      store.set("c", contact("c", "Someone Else"));
      const repo = createFakeRepo(store);

      // Act
      const page = await loadDuplicatePairsPage({ page: 1, limit: 50 }, repo);

      // Assert
      expect(page.total).toBe(1);
      expect(page.pairs[0]?.reasonKey).toBe("name");
      expect(page.pairs[0]?.contacts.map((c) => String(c.id)).sort()).toEqual(["a", "b"]);
    });

    it("given a draft with an existing contact's name, should count one match", async () => {
      // Arrange
      const store = new Map<string, Contact>();
      store.set("a", contact("a", "Muhammad Ali"));
      const repo = createFakeRepo(store);

      // Act
      const matchCount = await countContactDuplicateMatches(contact("new", "muhammad ali"), repo);

      // Assert
      expect(matchCount).toBe(1);
    });

    it("given an edited contact keeps its own name, should not count itself", async () => {
      // Arrange
      const store = new Map<string, Contact>();
      store.set("a", contact("a", "Muhammad Ali"));
      const repo = createFakeRepo(store);

      // Act
      const matchCount = await countContactDuplicateMatches(contact("a", "Muhammad Ali"), repo);

      // Assert
      expect(matchCount).toBe(0);
    });

    it("given two same-name guardians of different children, should not list them", async () => {
      // Arrange
      const store = new Map<string, Contact>();
      store.set("g1", contact("g1", "Abdul Rahman"));
      store.set("g2", contact("g2", "Abdul Rahman"));
      const repo = createFakeRepo(store, ["g1", "g2"]);

      // Act
      const page = await loadDuplicatePairsPage({ page: 1, limit: 50 }, repo);

      // Assert
      expect(page.total).toBe(0);
      expect(repo.findContactGuardianIds).toHaveBeenCalledWith(
        "demo",
        expect.arrayContaining(["g1", "g2"]),
      );
    });

    it("given a draft with a guardian's name while editing another guardian, should not count it", async () => {
      // Arrange
      const store = new Map<string, Contact>();
      store.set("g1", contact("g1", "Abdul Rahman"));
      store.set("g2", contact("g2", "Abdul Rahman"));
      const repo = createFakeRepo(store, ["g1", "g2"]);

      // Act
      const matchCount = await countContactDuplicateMatches(contact("g2", "Abdul Rahman"), repo);

      // Assert
      expect(matchCount).toBe(0);
    });
  });

  describe("read-only transaction safety", () => {
    it("should compute and return duplicate pairs without saving cache when inside a read-only transaction", async () => {
      // Arrange
      const store = new Map<string, Contact>();
      store.set("a", contact("a", "Muhammad Ali"));
      store.set("b", contact("b", "  muhammad   ALI "));
      const repo = createFakeRepo(store);
      mockSaveObject.mockClear();

      // Act
      const pairs = await withTenantRead("demo", async () => {
        return await loadDuplicatePairs(repo);
      });

      // Assert
      expect(pairs.length).toBe(1);
      expect(pairs[0]?.reasonKey).toBe("name");
      expect(mockSaveObject).not.toHaveBeenCalled();
    });

    it("should save cache when outside a read-only transaction", async () => {
      // Arrange
      const store = new Map<string, Contact>();
      store.set("a", contact("a", "Muhammad Ali"));
      store.set("b", contact("b", "  muhammad   ALI "));
      const repo = createFakeRepo(store);
      mockSaveObject.mockClear();

      // Act
      const pairs = await loadDuplicatePairs(repo);

      // Assert
      expect(pairs.length).toBe(1);
      expect(mockSaveObject).toHaveBeenCalledTimes(1);
    });

    it("should return cached duplicate pairs when cache is warm", async () => {
      // Arrange
      const cachedPairs = [
        {
          primary: contact("a", "Muhammad Ali"),
          candidate: contact("b", "Muhammad Ali"),
          reasonKey: "name",
        },
      ];
      mockGetObject.mockResolvedValueOnce({
        computedAt: new Date().toISOString(),
        pairs: cachedPairs,
      });

      // Act
      const pairs = await loadDuplicatePairs();

      // Assert
      expect(pairs).toEqual(cachedPairs);
      expect(mockGetObject).toHaveBeenCalledTimes(1);
    });

    it("should handle cache validation in getDuplicateScanCache", async () => {
      mockGetObject.mockResolvedValueOnce(null);
      expect(await getDuplicateScanCache()).toBeNull();

      mockGetObject.mockResolvedValueOnce("invalid-string");
      expect(await getDuplicateScanCache()).toBeNull();

      mockGetObject.mockResolvedValueOnce({ pairs: "not-array" });
      expect(await getDuplicateScanCache()).toBeNull();

      mockGetObject.mockResolvedValueOnce({
        computedAt: new Date(Date.now() - 25 * 3600000).toISOString(), // expired (> 24h)
        pairs: [],
      });
      expect(await getDuplicateScanCache()).toBeNull();

      const valid = {
        computedAt: new Date().toISOString(),
        pairs: [],
      };
      mockGetObject.mockResolvedValueOnce(valid);
      expect(await getDuplicateScanCache()).toEqual(valid);
    });

    it("should delete cache object in invalidateDuplicateScanCache", async () => {
      mockDeleteObject.mockClear();
      await invalidateDuplicateScanCache();
      expect(mockDeleteObject).toHaveBeenCalledWith("contacts_duplicate_scan_cache");
    });

    it("should execute runContactsDuplicateScan and save cache", async () => {
      const store = new Map<string, Contact>();
      store.set("a", contact("a", "Muhammad Ali"));
      store.set("b", contact("b", "  muhammad   ALI "));
      const repo = createFakeRepo(store);
      mockSaveObject.mockClear();

      const progressCalls: number[] = [];
      const result = await runContactsDuplicateScan((processed) => {
        progressCalls.push(processed);
      }, repo);

      expect(result.pairCount).toBe(1);
      expect(result.contactCount).toBe(2);
      expect(mockSaveObject).toHaveBeenCalledTimes(1);
      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });
});
