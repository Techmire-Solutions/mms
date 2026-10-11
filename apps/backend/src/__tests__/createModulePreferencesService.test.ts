import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetRequestTenant = vi.fn();
const mockBroadcastCollection = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => {
    const t = mockGetRequestTenant();
    if (!t) throw new Error("Tenant context required");
    return t.trim().toLowerCase();
  },
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

interface TestPreferences {
  theme: string;
  pageSize: number;
}

const normalize = (value: TestPreferences | Record<string, unknown> | null | undefined) =>
  ({
    theme: "light",
    pageSize: 25,
    ...(value as TestPreferences | Record<string, unknown> | null | undefined),
  }) as TestPreferences;

type ServiceOptions = {
  broadcastKey: string;
  getByWorkspace: (tenant: string) => Promise<Record<string, unknown> | null>;
  upsert: (tenant: string, payload: Record<string, unknown>) => Promise<unknown>;
  normalize: (
    value: TestPreferences | Record<string, unknown> | null | undefined,
  ) => TestPreferences;
};

function makeService(overrides: Partial<ServiceOptions> = {}) {
  const getByWorkspace = vi.fn(async (): Promise<Record<string, unknown> | null> => ({
    theme: "dark",
    pageSize: 50,
  }));
  const upsert = vi.fn(async () => ({}));
  const service = createModulePreferencesService<TestPreferences>({
    broadcastKey: "faculty",
    getByWorkspace,
    upsert,
    normalize,
    ...overrides,
  });
  return { service, getByWorkspace, upsert };
}

describe("createModulePreferencesService", () => {
  beforeEach(() => {
    mockGetRequestTenant.mockReturnValue("demo");
    mockBroadcastCollection.mockReset();
  });

  describe("load", () => {
    it("normalizes the raw row from getByWorkspace", async () => {
      const { service, getByWorkspace } = makeService();
      getByWorkspace.mockResolvedValue({ theme: "dark", pageSize: 50 });

      await expect(service.load()).resolves.toEqual({ theme: "dark", pageSize: 50 });
      expect(getByWorkspace).toHaveBeenCalledWith("demo");
    });

    it("returns null when getByWorkspace returns null", async () => {
      const { service, getByWorkspace } = makeService();
      getByWorkspace.mockResolvedValue(null);

      await expect(service.load()).resolves.toBeNull();
    });

    it("returns null for non-object or array raw rows", async () => {
      const { service, getByWorkspace } = makeService();
      getByWorkspace.mockResolvedValue(["not-an-object"] as never);
      await expect(service.load()).resolves.toBeNull();

      getByWorkspace.mockResolvedValue("scalar" as never);
      await expect(service.load()).resolves.toBeNull();
    });

    it("throws when tenant context is missing", async () => {
      mockGetRequestTenant.mockReturnValue(undefined);
      const { service } = makeService();

      await expect(service.load()).rejects.toThrow("Tenant context required");
    });
  });

  describe("save", () => {
    it("normalizes the payload, upserts for the tenant, broadcasts, and returns normalized", async () => {
      const { service, getByWorkspace, upsert } = makeService();

      const saved = await service.save({ theme: "dark", pageSize: 50 });

      expect(saved).toEqual({ theme: "dark", pageSize: 50 });
      expect(upsert).toHaveBeenCalledWith("demo", { theme: "dark", pageSize: 50 });
      expect(mockBroadcastCollection).toHaveBeenCalledWith("faculty");
      expect(getByWorkspace).not.toHaveBeenCalled();
    });

    it("throws when tenant context is missing", async () => {
      mockGetRequestTenant.mockReturnValue(undefined);
      const { service } = makeService();

      await expect(service.save({ theme: "dark", pageSize: 50 })).rejects.toThrow(
        "Tenant context required",
      );
    });
  });
});
