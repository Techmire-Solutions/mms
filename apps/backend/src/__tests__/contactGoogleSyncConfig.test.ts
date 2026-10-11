import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactGoogleSyncCredentialRecord } from "../db/repositories/contactGoogleSyncRepository.js";

const mockGetRequestTenant = vi.fn();
const mockFindCredentials = vi.fn();
const mockUpsertCredentials = vi.fn();
const mockDeleteCredentials = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => {
    const t = mockGetRequestTenant();
    if (!t) throw new Error("Tenant context required");
    return t;
  },
}));

vi.mock("../db/repositories/contactGoogleSyncRepository.js", () => ({
  findContactGoogleSyncCredentials: (...args: unknown[]) => mockFindCredentials(...args),
  upsertContactGoogleSyncCredentials: (...args: unknown[]) => mockUpsertCredentials(...args),
  deleteContactGoogleSyncCredentials: (...args: unknown[]) => mockDeleteCredentials(...args),
}));

import {
  clearContactGoogleSyncConfig,
  clearGoogleSyncTokens,
  getContactGoogleSyncConfig,
  redactGoogleSyncConfigForClient,
  setContactGoogleSyncConfig,
} from "../services/contactGoogleSyncConfig.js";

function credentialRecord(
  overrides: Partial<ContactGoogleSyncCredentialRecord> = {},
): ContactGoogleSyncCredentialRecord {
  return {
    clientId: "client-1",
    clientSecret: "secret-1",
    accessToken: "access-1",
    refreshToken: "refresh-1",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as ContactGoogleSyncCredentialRecord;
}

describe("contactGoogleSyncConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
  });

  it("delegates get with the resolved tenant", async () => {
    mockFindCredentials.mockResolvedValueOnce(credentialRecord());

    const config = await getContactGoogleSyncConfig("u1");

    expect(config.clientId).toBe("client-1");
    expect(mockFindCredentials).toHaveBeenCalledWith("demo", "u1");
  });

  it("delegates set and stamps updatedAt", async () => {
    mockUpsertCredentials.mockImplementationOnce(
      async (_tenant: string, _userId: string, config: ContactGoogleSyncCredentialRecord) => config,
    );

    const saved = await setContactGoogleSyncConfig(
      "u1",
      credentialRecord({ updatedAt: undefined }),
    );

    expect(mockUpsertCredentials).toHaveBeenCalledWith(
      "demo",
      "u1",
      expect.objectContaining({ clientId: "client-1", updatedAt: expect.any(String) }),
    );
    expect(typeof saved.updatedAt).toBe("string");
    expect(saved.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("delegates clear", async () => {
    await clearContactGoogleSyncConfig("u1");

    expect(mockDeleteCredentials).toHaveBeenCalledWith("demo", "u1");
  });

  it("throws when tenant context is missing", async () => {
    mockGetRequestTenant.mockReturnValue(null);

    await expect(getContactGoogleSyncConfig("u1")).rejects.toThrow("Tenant context required");
  });

  it("redacts config for the client with boolean flags and no secrets", () => {
    const redacted = redactGoogleSyncConfigForClient(
      credentialRecord({
        clientSecret: "secret-1",
        refreshToken: "refresh-1",
        accessToken: "access-1",
      }),
    );

    expect(redacted).toEqual({
      clientId: "client-1",
      updatedAt: "2026-07-01T00:00:00.000Z",
      hasClientSecret: true,
      hasRefreshToken: true,
      isConnected: true,
    });
    expect(JSON.stringify(redacted)).not.toContain("secret-1");
    expect(JSON.stringify(redacted)).not.toContain("access-1");
    expect(JSON.stringify(redacted)).not.toContain("refresh-1");
  });

  it("clears tokens, saves, and returns the redacted client config", async () => {
    mockFindCredentials.mockResolvedValueOnce(credentialRecord());
    mockUpsertCredentials.mockImplementationOnce(
      async (_tenant: string, _userId: string, config: ContactGoogleSyncCredentialRecord) => config,
    );

    const redacted = await clearGoogleSyncTokens("u1");

    expect(mockUpsertCredentials).toHaveBeenCalledWith(
      "demo",
      "u1",
      expect.objectContaining({ clientId: "client-1" }),
    );
    const savedArg = mockUpsertCredentials.mock.calls[0]?.[2];
    expect(savedArg?.accessToken).toBeUndefined();
    expect(savedArg?.refreshToken).toBeUndefined();
    expect(redacted).toEqual(
      expect.objectContaining({ clientId: "client-1", isConnected: false, hasRefreshToken: false }),
    );
  });
});
