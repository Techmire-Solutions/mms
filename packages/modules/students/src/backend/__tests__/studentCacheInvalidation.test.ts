import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvalidateMultiTierCache = vi.fn();
let currentTenant: string | null = "demo";

vi.mock("@mms/be-core/http", () => ({
  getRequestTenant: () => currentTenant,
}));

vi.mock("@mms/be-core/cache", () => ({
  invalidateMultiTierCache: (...args: unknown[]) => mockInvalidateMultiTierCache(...args),
}));

import { invalidateStudentsCache } from "../use-cases/studentCacheInvalidation.js";

describe("invalidateStudentsCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTenant = "demo";
  });

  it("evicts students multi-tier cache when tenant is present", async () => {
    await invalidateStudentsCache();
    expect(mockInvalidateMultiTierCache).toHaveBeenCalledWith({
      tenantId: "demo",
      domain: "students",
    });
  });

  it("skips eviction when tenant is not set", async () => {
    currentTenant = null;
    await invalidateStudentsCache();
    expect(mockInvalidateMultiTierCache).not.toHaveBeenCalled();
  });
});
