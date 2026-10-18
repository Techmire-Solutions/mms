import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListByWorkspace = vi.fn();
const mockListByKind = vi.fn();
const mockReplaceKind = vi.fn();

vi.mock("../db/repositories/studentLookupsRepository.js", () => ({
  listStudentLookupsByWorkspace: (...args: unknown[]) => mockListByWorkspace(...args),
  listStudentLookupsByKind: (...args: unknown[]) => mockListByKind(...args),
  replaceStudentLookupsForKind: (...args: unknown[]) => mockReplaceKind(...args),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "demo",
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

import {
  loadStudentLookupKind,
  loadStudentLookupsMap,
  replaceStudentLookupKind,
} from "../students/use-cases/studentLookupsService.js";

describe("studentLookupsService", () => {
  beforeEach(() => {
    mockListByWorkspace.mockReset();
    mockListByKind.mockReset();
    mockReplaceKind.mockReset();
  });

  it("returns shared defaults when no typed rows exist", async () => {
    mockListByWorkspace.mockResolvedValue([]);
    const map = await loadStudentLookupsMap("demo");
    expect(map.statuses).toContain("active");
    expect(map.genderFilters).toEqual(["male", "female"]);
    expect(map.discountTypes).toEqual([]);
  });

  it("maps typed string rows for a kind", async () => {
    mockListByKind.mockResolvedValue([
      { label: "active", meta: null, sortOrder: 0 },
      { label: "alumni", meta: null, sortOrder: 1 },
    ]);
    await expect(loadStudentLookupKind("statuses", "demo")).resolves.toEqual(["active", "alumni"]);
  });

  it("replaces statuses with ordered string labels", async () => {
    mockReplaceKind.mockResolvedValue(undefined);
    const saved = await replaceStudentLookupKind("statuses", ["active", "inactive"], "demo");
    expect(saved).toEqual(["active", "inactive"]);
    expect(mockReplaceKind).toHaveBeenCalledWith("demo", "statuses", [
      expect.objectContaining({ kind: "statuses", label: "active", sortOrder: 0 }),
      expect.objectContaining({ kind: "statuses", label: "inactive", sortOrder: 1 }),
    ]);
  });
});
