import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindCredentials = vi.fn();
const mockUpsertCredentials = vi.fn();
const mockGetRequestTenant = vi.fn();
const mockFindExistingNormalizedContactNames = vi.fn();
const mockFindContactsMatchingUniqueValues = vi.fn();
const mockLoadContactRuntimeDefaults = vi.fn();
const mockBulkSaveContacts = vi.fn();
const mockInvalidateDuplicateScanCache = vi.fn();

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
}));

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactRuntimeDefaults: (...args: unknown[]) => mockLoadContactRuntimeDefaults(...args),
  loadExistingNormalizedContactNames: (...args: unknown[]) =>
    mockFindExistingNormalizedContactNames(...args),
  findContactsMatchingUniqueValues: (...args: unknown[]) =>
    mockFindContactsMatchingUniqueValues(...args),
}));

vi.mock("../contacts/use-cases/contactWriteUseCases.js", () => ({
  bulkSaveContacts: (...args: unknown[]) => mockBulkSaveContacts(...args),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  // No unique fields configured in these tests; the in-run uniqueness index is a no-op.
  loadContactFieldConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../contacts/use-cases/contactValidationUseCases.js", () => ({
  prepareContactRecord: async (contact: unknown) => contact,
  assertContactUniqueFields: vi.fn().mockResolvedValue(undefined),
  ContactUniqueFieldError: class ContactUniqueFieldError extends Error {
    code = "unique_conflict";
    errors: unknown[] = [];
  },
}));

vi.mock("../db/repositories/contactRepository.js", () => ({
  bulkSaveContacts: (...args: unknown[]) => mockBulkSaveContacts(...args),
  findExistingNormalizedContactNames: (...args: unknown[]) =>
    mockFindExistingNormalizedContactNames(...args),
  findActiveContactsMatchingUniqueValues: (...args: unknown[]) =>
    mockFindContactsMatchingUniqueValues(...args),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("../contacts/use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: (...args: unknown[]) => mockInvalidateDuplicateScanCache(...args),
}));

import {
  exchangeGoogleContactsOAuthCode,
  GoogleOAuthExchangeError,
  GoogleSyncError,
  runGoogleContactsSync,
  setContactGoogleSyncConfig,
} from "../contacts/use-cases/contactGoogleSyncUseCases.js";

describe("contactGoogleSyncService", () => {
  beforeEach(() => {
    mockGetRequestTenant.mockReturnValue("demo");
    mockFindCredentials.mockReset().mockResolvedValue({});
    mockUpsertCredentials
      .mockReset()
      .mockImplementation(
        async (_tenant: string, _userId: string, config: Record<string, unknown>) => ({
          ...config,
          updatedAt: new Date().toISOString(),
        }),
      );
    mockFindExistingNormalizedContactNames.mockReset().mockResolvedValue(new Set());
    mockFindContactsMatchingUniqueValues.mockReset().mockResolvedValue([]);
    mockBulkSaveContacts.mockReset().mockResolvedValue(undefined);
    mockInvalidateDuplicateScanCache.mockReset().mockResolvedValue(undefined);
    mockLoadContactRuntimeDefaults.mockReset().mockResolvedValue({
      defaultPhoneCountryCode: "+92",
      phoneLabel: "Work",
      emailLabel: "Work",
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exchanges OAuth code server-side and stores tokens", async () => {
    mockFindCredentials.mockResolvedValue({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    await setContactGoogleSyncConfig("u1", {
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ access_token: "access-1", refresh_token: "refresh-1" }),
    } as Response);

    const config = await exchangeGoogleContactsOAuthCode(
      "u1",
      "auth-code",
      "https://demo.localhost/contacts",
    );

    expect(config.isConnected).toBe(true);
    expect(config.hasRefreshToken).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects invalid redirect URIs", async () => {
    await expect(
      exchangeGoogleContactsOAuthCode("u1", "auth-code", "https://evil.example/oauth"),
    ).rejects.toBeInstanceOf(GoogleOAuthExchangeError);
  });

  it("rejects evil host with a Contacts path", async () => {
    await expect(
      exchangeGoogleContactsOAuthCode("u1", "auth-code", "https://evil.example/contacts"),
    ).rejects.toBeInstanceOf(GoogleOAuthExchangeError);
  });

  it("surfaces Google OAuth errors", async () => {
    mockFindCredentials.mockResolvedValue({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    await setContactGoogleSyncConfig("u1", {
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ error: "invalid_grant", error_description: "Code expired" }),
    } as Response);

    await expect(
      exchangeGoogleContactsOAuthCode("u1", "bad-code", "https://demo.localhost/contacts"),
    ).rejects.toMatchObject({ message: "Code expired", code: "invalid_grant" });
  });

  it("syncs Google contacts, imports fresh contacts with all phones and enriches existing peers", async () => {
    mockFindCredentials.mockResolvedValue({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
    await setContactGoogleSyncConfig("u1", {
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });

    // Existing contact in database with ID 'c-1'
    mockFindContactsMatchingUniqueValues.mockResolvedValue([
      {
        id: "c-1",
        name: "Ali Khan",
        phones: [{ label: "Work", countryCode: "+92", number: "3001112233" }],
        emails: [],
      },
    ]);

    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      json: async () => ({
        connections: [
          {
            names: [{ displayName: "Ali Khan", givenName: "Ali", familyName: "Khan" }],
            emailAddresses: [{ value: "ali@example.com" }],
            organizations: [{ name: "Tech Solutions", title: "Director" }],
          },
          {
            names: [{ displayName: "Sara Ahmed", givenName: "Sara", familyName: "Ahmed" }],
            phoneNumbers: [{ value: "+92 300 4445566" }, { value: "+92 300 7778899" }],
            emailAddresses: [{ value: "sara@example.com" }],
          },
        ],
      }),
    } as Response);

    const result = await runGoogleContactsSync("u1");

    expect(result.total).toBe(2);
    expect(result.imported).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockBulkSaveContacts).toHaveBeenCalledTimes(2); // One for inserts, one for updates
    expect(mockInvalidateDuplicateScanCache).toHaveBeenCalled();
  });

  it("refreshes access token after People API 401", async () => {
    mockFindCredentials.mockResolvedValue({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "expired-token",
      refreshToken: "refresh-1",
    });
    await setContactGoogleSyncConfig("u1", {
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "expired-token",
      refreshToken: "refresh-1",
    });

    mockFindContactsMatchingUniqueValues.mockResolvedValue([]);

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 401,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ access_token: "fresh-token" }),
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          connections: [{ names: [{ displayName: "Fresh Contact" }] }],
        }),
      } as Response);

    const result = await runGoogleContactsSync("u1");

    expect(result.imported).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skippedName).toBe(0);
    expect(result.skippedUnique).toBe(0);
    expect(mockBulkSaveContacts).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws session_expired when not connected", async () => {
    await expect(runGoogleContactsSync("u1")).rejects.toBeInstanceOf(GoogleSyncError);
  });
});
