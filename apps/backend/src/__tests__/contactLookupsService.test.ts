import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListByWorkspace = vi.fn();
const mockListByKind = vi.fn();
const mockReplaceKind = vi.fn();

vi.mock("../db/repositories/contactLookupsRepository.js", () => ({
  listContactLookupsByWorkspace: (...args: unknown[]) => mockListByWorkspace(...args),
  listContactLookupsByKind: (...args: unknown[]) => mockListByKind(...args),
  replaceContactLookupsForKind: (...args: unknown[]) => mockReplaceKind(...args),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

const mockBroadcastCollection = vi.fn();

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

import {
  loadContactLookupKind,
  loadContactLookupsMap,
  replaceContactLookupKind,
} from "../contacts/use-cases/contactLookupsService.js";

describe("contactLookupsService", () => {
  beforeEach(() => {
    mockListByWorkspace.mockReset();
    mockListByKind.mockReset();
    mockReplaceKind.mockReset();
    mockBroadcastCollection.mockReset();
  });

  it("returns shared defaults when no typed rows exist", async () => {
    mockListByWorkspace.mockResolvedValue([]);
    mockListByKind.mockResolvedValue([]);
    const map = await loadContactLookupsMap("demo");
    expect(map.genders.length).toBeGreaterThan(0);
    expect(map.phoneLabels.length).toBeGreaterThan(0);
    expect(map.educationDegrees.length).toBeGreaterThan(0);
    expect(map.employmentTypes.length).toBeGreaterThan(0);
    expect(map.skillCategories.length).toBeGreaterThan(0);
    expect(map.skillProficiencies.length).toBeGreaterThan(0);
    expect(map.countryCodes[0]).toMatchObject({
      country: expect.any(String),
      code: expect.any(String),
    });
  });

  it("maps typed string rows for a kind", async () => {
    mockListByKind.mockResolvedValue([
      { label: "Mobile", meta: null, sortOrder: 0 },
      { label: "Work", meta: null, sortOrder: 1 },
    ]);
    await expect(loadContactLookupKind("phoneLabels", "demo")).resolves.toEqual(["Mobile", "Work"]);
  });

  it("replaces countryCodes with meta.code", async () => {
    mockReplaceKind.mockResolvedValue(undefined);
    const saved = await replaceContactLookupKind(
      "countryCodes",
      [{ country: "Pakistan", code: "+92" }],
      "demo",
    );
    expect(saved).toEqual([{ country: "Pakistan", code: "+92" }]);
    expect(mockReplaceKind).toHaveBeenCalledWith("demo", "countryCodes", [
      expect.objectContaining({
        kind: "countryCodes",
        label: "Pakistan",
        meta: { code: "+92" },
        sortOrder: 0,
      }),
    ]);
    expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
  });

  it("broadcasts contacts after replacing string lookup kinds", async () => {
    mockReplaceKind.mockResolvedValue(undefined);
    await replaceContactLookupKind("phoneLabels", ["Mobile", "Work"], "demo");
    expect(mockBroadcastCollection).toHaveBeenCalledWith("contacts");
  });
});
