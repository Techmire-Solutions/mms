import { describe, expect, it, vi } from "vitest";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";
import {
  collectRelatedContactIds,
  loadPreviousRelationshipTargets,
} from "../contacts/use-cases/contactRelationshipIds.js";

describe("contactRelationshipIds", () => {
  describe("collectRelatedContactIds", () => {
    it("returns empty array when no contacts or empty relationships passed", () => {
      expect(collectRelatedContactIds()).toEqual([]);
      expect(collectRelatedContactIds(null, undefined, { relationshipContacts: [] })).toEqual([]);
    });

    it("normalizes, deduplicates, and strips whitespace from contactIds", () => {
      const ids = collectRelatedContactIds(
        {
          relationshipContacts: [
            { contactId: " c-1 ", relationship: "Parent" },
            { contactId: "c-2", relationship: "Guardian" },
          ],
        },
        {
          relationshipContacts: [
            { contactId: "c-1", relationship: "Mother" },
            { contactId: "", relationship: "Other" },
            { contactId: undefined, relationship: "Other" },
          ],
        },
      );
      expect(ids).toEqual(["c-1", "c-2"]);
    });
  });

  describe("loadPreviousRelationshipTargets", () => {
    it("returns empty array when contactIds is empty", async () => {
      const repo = {
        findSummaryByIds: vi.fn(),
      } as unknown as ContactsRepository;

      const result = await loadPreviousRelationshipTargets(repo, "demo", []);
      expect(result).toEqual([]);
      expect(repo.findSummaryByIds).not.toHaveBeenCalled();
    });

    it("returns empty array when repo does not implement findSummaryByIds", async () => {
      const repo = {} as unknown as ContactsRepository;
      const result = await loadPreviousRelationshipTargets(repo, "demo", ["c-1"]);
      expect(result).toEqual([]);
    });

    it("calls findSummaryByIds and returns collected related contact ids", async () => {
      const repo = {
        findSummaryByIds: vi.fn().mockResolvedValue([
          {
            id: "c-1",
            relationshipContacts: [{ contactId: "rel-1", relationship: "Parent" }],
          },
          {
            id: "c-2",
            relationshipContacts: [{ contactId: "rel-2", relationship: "Guardian" }],
          },
        ]),
      } as unknown as ContactsRepository;

      const result = await loadPreviousRelationshipTargets(repo, "demo", ["c-1", "c-2"]);
      expect(repo.findSummaryByIds).toHaveBeenCalledWith("demo", ["c-1", "c-2"]);
      expect(result).toEqual(["rel-1", "rel-2"]);
    });
  });
});
