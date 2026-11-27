import { describe, expect, it } from "vitest";
import type { ConsolidationGroup } from "@mms/contracts";
import { HttpDomainError } from "@mms/be-core/http/errors";
import type { PlatformConsolidationRepository } from "../platform/repository/platformConsolidationRepositoryAdapter.js";
import {
  buildConsolidationReport,
  deleteGroup,
  saveGroup,
} from "../platform/use-cases/consolidationUseCases.js";

/** Minimal repository fake — only the calls each use-case under test performs. */
function repoFake(overrides: Partial<PlatformConsolidationRepository> = {}) {
  return {
    listConsolidationGroups: async () => [] as ConsolidationGroup[],
    saveConsolidationGroup: async () => {},
    deleteConsolidationGroup: async () => true,
    loadMemberLedger: async () => ({
      balanceSheetRows: [],
      periodResultRows: [],
      functionalCurrency: "PKR",
    }),
    insertPlatformActivityLog: async () => {},
    ...overrides,
  } as unknown as PlatformConsolidationRepository;
}

const group = (overrides: Partial<ConsolidationGroup> = {}): ConsolidationGroup =>
  ({
    id: "g1",
    name: "Group",
    presentationCurrency: "PKR",
    members: [
      {
        memberSubdomain: "alpha",
        isParent: true,
        ownershipPercent: 100,
        functionalCurrency: "PKR",
      },
    ],
    ...overrides,
  }) as ConsolidationGroup;

describe("consolidationUseCases error contracts", () => {
  it("given a save that did not persist, should throw a 500 server_error HttpDomainError", async () => {
    // Arrange
    const repo = repoFake({ listConsolidationGroups: async () => [] });

    // Act + Assert
    await expect(
      saveGroup(repo, { id: "a1", email: "admin@example.com" }, "g1", {
        name: "Group",
        presentationCurrency: "PKR",
        members: [],
        intercompanyAccountCodes: [],
      }),
    ).rejects.toMatchObject({
      constructor: HttpDomainError,
      statusCode: 500,
      type: "server_error",
      message: "Consolidation group was not saved",
    });
  });

  it("given a missing group on delete, should throw a 404 not_found HttpDomainError", async () => {
    // Arrange
    const repo = repoFake({ deleteConsolidationGroup: async () => false });

    // Act + Assert
    await expect(
      deleteGroup(repo, { id: "a1", email: "admin@example.com" }, "nope"),
    ).rejects.toMatchObject({
      constructor: HttpDomainError,
      statusCode: 404,
      type: "not_found",
      message: "Consolidation group not found",
    });
  });

  it("given an unknown group id, should throw a 404 not_found HttpDomainError", async () => {
    // Arrange
    const repo = repoFake({ listConsolidationGroups: async () => [group()] });

    // Act + Assert
    await expect(
      buildConsolidationReport(repo, "missing", { dateFrom: "2026-01-01", dateTo: "2026-01-31" }),
    ).rejects.toMatchObject({
      constructor: HttpDomainError,
      statusCode: 404,
      type: "not_found",
      message: "Consolidation group not found",
    });
  });

  it("given a group with no members, should throw a 422 validation_error HttpDomainError", async () => {
    // Arrange
    const repo = repoFake({
      listConsolidationGroups: async () => [group({ members: [] })],
    });

    // Act + Assert
    await expect(
      buildConsolidationReport(repo, "g1", { dateFrom: "2026-01-01", dateTo: "2026-01-31" }),
    ).rejects.toMatchObject({
      constructor: HttpDomainError,
      statusCode: 422,
      type: "validation_error",
      message: "The group has no members",
    });
  });
});
