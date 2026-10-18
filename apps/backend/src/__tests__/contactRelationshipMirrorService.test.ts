import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig, FieldDefinition, RelationshipPair } from "@mms/shared";

const mockLoadContactLookupKind = vi.fn();
const mockReplaceContactLookupKind = vi.fn();
const mockLoadContactFieldConfig = vi.fn();
const mockSaveContactFieldConfig = vi.fn();

vi.mock("../contacts/use-cases/contactLookupsService.js", () => ({
  loadContactLookupKind: (...args: unknown[]) => mockLoadContactLookupKind(...args),
  replaceContactLookupKind: (...args: unknown[]) => mockReplaceContactLookupKind(...args),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: () => mockLoadContactFieldConfig(),
  saveContactFieldConfig: (...args: unknown[]) => mockSaveContactFieldConfig(...args),
}));

import { syncRelationshipMirrorsFromPairs } from "../lib/contactRelationshipMirrorService.js";

function makeFieldConfig(options: string[]): FieldConfig {
  const relationshipField: FieldDefinition = {
    key: "relationship",
    label: "Relationship",
    type: "select",
    options,
    enabled: true,
    order: 1,
  };
  const otherField: FieldDefinition = {
    key: "notes",
    label: "Notes",
    type: "text",
    enabled: true,
    order: 2,
  };
  return {
    version: 1,
    enabledTabs: ["basic", "relationship"],
    requiredTabs: [],
    fields: { relationship: [relationshipField, otherField] },
  } as unknown as FieldConfig;
}

const PARENT_CHILD: RelationshipPair[] = [{ forward: "Parent", inverse: "Child" }];

describe("contactRelationshipMirrorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadContactLookupKind.mockResolvedValue([]);
    mockReplaceContactLookupKind.mockResolvedValue(undefined);
    mockLoadContactFieldConfig.mockResolvedValue(null);
    mockSaveContactFieldConfig.mockResolvedValue(undefined);
  });

  it("writes lookups when the label sequence differs", async () => {
    mockLoadContactLookupKind.mockResolvedValue(["Uncle"]);
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(["Parent"]));

    const labels = await syncRelationshipMirrorsFromPairs(PARENT_CHILD);

    expect(labels).toEqual(["Parent", "Child"]);
    expect(mockReplaceContactLookupKind).toHaveBeenCalledWith("relationships", ["Parent", "Child"]);
  });

  it("skips lookup writes when the sequence already matches (case-insensitive)", async () => {
    mockLoadContactLookupKind.mockResolvedValue(["parent", "CHILD"]);
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(["Parent", "Child"]));

    await syncRelationshipMirrorsFromPairs(PARENT_CHILD);

    expect(mockReplaceContactLookupKind).not.toHaveBeenCalled();
  });

  it("saves the field config when relationship options differ", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(["Parent"]));

    await syncRelationshipMirrorsFromPairs(PARENT_CHILD);

    expect(mockSaveContactFieldConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          relationship: expect.arrayContaining([
            expect.objectContaining({ key: "relationship", options: ["Parent", "Child"] }),
          ]),
        }),
      }),
    );
  });

  it("leaves the field config unchanged when options already match (order-insensitive)", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(["Child", "Parent"]));

    await syncRelationshipMirrorsFromPairs(PARENT_CHILD);

    expect(mockSaveContactFieldConfig).not.toHaveBeenCalled();
  });

  it("honors a preferred option order", async () => {
    mockLoadContactLookupKind.mockResolvedValue([]);
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(["Parent", "Child"]));

    const labels = await syncRelationshipMirrorsFromPairs(PARENT_CHILD, ["Child", "Parent"]);

    expect(labels).toEqual(["Child", "Parent"]);
    expect(mockReplaceContactLookupKind).toHaveBeenCalledWith("relationships", ["Child", "Parent"]);
  });

  it("treats undefined pairs as an empty label set", async () => {
    mockLoadContactLookupKind.mockResolvedValue([]);
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(["Parent", "Child"]));

    const labels = await syncRelationshipMirrorsFromPairs(undefined);

    expect(labels).toEqual([]);
    expect(mockReplaceContactLookupKind).not.toHaveBeenCalled();
    expect(mockSaveContactFieldConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          relationship: expect.arrayContaining([
            expect.objectContaining({ key: "relationship", options: [] }),
          ]),
        }),
      }),
    );
  });
});
