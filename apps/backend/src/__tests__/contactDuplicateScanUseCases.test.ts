import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";

const mockLoadContactPreferences = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../db/database.js", () => ({
  getObject: vi.fn(async () => null),
  deleteObject: vi.fn(async () => undefined),
  saveObject: vi.fn(async () => undefined),
}));

vi.mock("../contacts/use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: (...args: unknown[]) => mockLoadContactPreferences(...args),
}));

import {
  countContactDuplicateMatches,
  loadDuplicatePairsPage,
} from "../contacts/use-cases/contactDuplicateScanUseCases.js";
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
});
