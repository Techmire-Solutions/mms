import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashRefreshToken } from "../services/auth/authCookieService.js";
import { ContactUniqueFieldError } from "../services/contactUniqueValidationService.js";
import { signTenantToken } from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

const mockFindRefreshTokenByHash = vi.fn();
const mockDeleteAuthArtifact = vi.fn();
const mockConsumeAuthArtifact = vi.fn().mockResolvedValue(true);
const mockPutAuthArtifact = vi.fn();
const mockGetPublicUserById = vi.fn();
const mockGetTenantUserProfile = vi.fn();
const mockUpdateOwnLinkedContact = vi.fn();
const mockGetJwtExpiresIn = vi.fn();

vi.mock("../services/auth/authArtifactService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth/authArtifactService.js")>();
  return {
    ...actual,
    purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
    findRefreshTokenByHash: (...args: unknown[]) => mockFindRefreshTokenByHash(...args),
    deleteAuthArtifact: (...args: unknown[]) => mockDeleteAuthArtifact(...args),
    consumeAuthArtifact: (...args: unknown[]) => mockConsumeAuthArtifact(...args),
    putAuthArtifact: (...args: unknown[]) => mockPutAuthArtifact(...args),
  };
});

vi.mock("../services/auth/userService.js", () => ({
  getPublicUserById: (...args: unknown[]) => mockGetPublicUserById(...args),
  getTenantUserProfile: (...args: unknown[]) => mockGetTenantUserProfile(...args),
  updateOwnLinkedContact: (...args: unknown[]) => mockUpdateOwnLinkedContact(...args),
}));

vi.mock("../services/globalSettingsService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/globalSettingsService.js")>();
  return {
    ...actual,
    getJwtExpiresIn: (...args: unknown[]) => mockGetJwtExpiresIn(...args),
    loadGlobalSettings: vi.fn().mockResolvedValue({}),
  };
});

const mockVerifyPassword = vi.fn();
const mockHasPlatformUsers = vi.fn();
const mockFindPlatformUserByEmail = vi.fn();
const mockUpdatePlatformUserPassword = vi.fn();
const mockGetStoredPlatformUserById = vi.fn();
const mockListPlatformWorkspaces = vi.fn();
const mockSetPlatformAdminPermissions = vi.fn();
const mockSetPlatformAdminDisabled = vi.fn();
const mockDeletePlatformAdmin = vi.fn();
const mockVerifyPlatformUserPassword = vi.fn();
const mockDeleteWorkspace = vi.fn();
const mockResetWorkspaceAdminPassword = vi.fn();
const mockCreateWorkspaceAdminUser = vi.fn();
const mockGetWorkspaceInstitutionSetupStatus = vi.fn();
const mockIsPlatformSmtpConfigured = vi.fn().mockReturnValue(false);
const mockGetPlatformUserProfile = vi.fn().mockImplementation(async (id: string) => {
  const stored = await mockGetStoredPlatformUserById(id);
  if (!stored) return null;
  return {
    id: stored.id,
    email: stored.email,
    name: stored.name,
    role: stored.role,
    permissions: stored.permissions ?? { workspaces: false, onboard: false },
    createdAt: stored.createdAt,
    emailVerifiedAt: stored.emailVerifiedAt,
    disabledAt: stored.disabledAt ?? null,
  };
});

vi.mock("../services/platform/platformEmailService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/platform/platformEmailService.js")>();
  return {
    ...actual,
    isPlatformSmtpConfigured: (...args: unknown[]) => mockIsPlatformSmtpConfigured(...args),
  };
});

vi.mock("../services/auth/passwordService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth/passwordService.js")>();
  return {
    ...actual,
    verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  };
});

const mockCreateVerifiedPlatformUser = vi
  .fn()
  .mockImplementation(async (input: { email: string; name: string; passwordHash: string }) => ({
    id: "p-superuser-1",
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
    role: "super_user",
    permissions: { workspaces: true, onboard: true },
    sessionVersion: 0,
    createdAt: new Date().toISOString(),
    emailVerifiedAt: new Date().toISOString(),
  }));

vi.mock("../services/platform/platformUserService.js", () => ({
  ensurePlatformSuperUserFromEnv: vi.fn().mockResolvedValue(undefined),
  findPlatformUserByEmail: (...args: unknown[]) => mockFindPlatformUserByEmail(...args),
  getStoredPlatformUserById: (...args: unknown[]) => mockGetStoredPlatformUserById(...args),
  hasPlatformUsers: (...args: unknown[]) => mockHasPlatformUsers(...args),
  countPlatformUsers: vi.fn(),
  createVerifiedPlatformUser: (...args: unknown[]) => mockCreateVerifiedPlatformUser(...args),
  setPlatformAdminPermissions: (...args: unknown[]) => mockSetPlatformAdminPermissions(...args),
  setPlatformAdminDisabled: (...args: unknown[]) => mockSetPlatformAdminDisabled(...args),
  deletePlatformAdmin: (...args: unknown[]) => mockDeletePlatformAdmin(...args),
  verifyPlatformUserPassword: (...args: unknown[]) => mockVerifyPlatformUserPassword(...args),
  updatePlatformUserPassword: (...args: unknown[]) => mockUpdatePlatformUserPassword(...args),
  updatePlatformUserName: vi.fn(),
  changePlatformUserPassword: vi.fn(),
  getPlatformUserProfile: (...args: unknown[]) => mockGetPlatformUserProfile(...args),
  updatePlatformUserProfile: vi.fn(),
  toPlatformUserProfile: (stored: Record<string, unknown>) => ({
    id: stored.id,
    email: stored.email,
    name: stored.name,
    role: stored.role,
    permissions: stored.permissions ?? { workspaces: false, onboard: false },
    createdAt: stored.createdAt,
    emailVerifiedAt: stored.emailVerifiedAt,
    disabledAt: stored.disabledAt ?? null,
  }),
  toPublicPlatformUser: (user: Record<string, unknown>) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions ?? { workspaces: false, onboard: false },
  }),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
    listPlatformWorkspaces: (...args: unknown[]) => mockListPlatformWorkspaces(...args),
    deleteWorkspace: (...args: unknown[]) => mockDeleteWorkspace(...args),
    resetWorkspaceAdminPassword: (...args: unknown[]) => mockResetWorkspaceAdminPassword(...args),
    createWorkspaceAdminUser: (...args: unknown[]) => mockCreateWorkspaceAdminUser(...args),
    getWorkspaceInstitutionSetupStatus: (...args: unknown[]) =>
      mockGetWorkspaceInstitutionSetupStatus(...args),
  };
});

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

import { buildApp } from "../app.js";
import { resetServerConfigCacheForTesting } from "../config/serverConfig.js";
import { PLATFORM_ACCESS_COOKIE } from "../services/platform/platformCookieService.js";
import { unblockTenant } from "../services/authSessionService.js";

// Never let state from one test leak into the next: production-mode tests cache
// server config, and the workspace-delete test blocklists the demo tenant.
afterEach(async () => {
  resetServerConfigCacheForTesting();
  await unblockTenant("demo");
});

describe("auth routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockFindRefreshTokenByHash.mockReset();
    mockDeleteAuthArtifact.mockReset().mockResolvedValue(undefined);
    mockConsumeAuthArtifact.mockReset().mockResolvedValue(true);
    mockPutAuthArtifact.mockReset().mockResolvedValue("new-artifact-id");
    mockGetPublicUserById.mockReset();
    mockGetTenantUserProfile.mockReset();
    mockUpdateOwnLinkedContact.mockReset();
    mockGetJwtExpiresIn.mockReset().mockResolvedValue("15m");
    mockHasPlatformUsers.mockReset().mockResolvedValue(true);
    mockFindPlatformUserByEmail.mockReset().mockResolvedValue(null);
    mockIsPlatformSmtpConfigured.mockReset().mockReturnValue(false);
    mockVerifyPassword.mockReset().mockResolvedValue(true);
    mockGetStoredPlatformUserById.mockReset().mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockUpdatePlatformUserPassword.mockReset();
    mockListPlatformWorkspaces.mockReset().mockResolvedValue({
      workspaces: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    mockSetPlatformAdminPermissions.mockReset();
    mockSetPlatformAdminDisabled.mockReset();
    mockDeletePlatformAdmin.mockReset();
    mockVerifyPlatformUserPassword.mockReset().mockResolvedValue(true);
    mockDeleteWorkspace.mockReset().mockResolvedValue({
      id: "ws-demo",
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      createdAt: "2026-01-01T00:00:00.000Z",
      enabled: true,
    });
    mockGetWorkspaceInstitutionSetupStatus.mockReset().mockResolvedValue(false);
  });

  it("POST /api/auth/login rejects apex host without subdomain", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { host: "localhost" },
      payload: { email: "admin@test.com", password: "password123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ type: "invalid_credentials" });
    await app.close();
  });

  it("POST /api/auth/refresh rejects missing cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/auth/refresh rejects unknown opaque token", async () => {
    mockFindRefreshTokenByHash.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { host: "demo.localhost" },
      cookies: { mms_refresh: "invalid-refresh-token" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/auth/refresh rotates session with valid artifact", async () => {
    const token = "valid-refresh-token-value";
    mockFindRefreshTokenByHash.mockResolvedValue({
      id: "artifact-1",
      kind: "refresh_token",
      payload: {
        userId: "u1",
        workspaceSubdomain: "demo",
        tokenHash: hashRefreshToken(token),
      },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockGetPublicUserById.mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
      workspaceSubdomain: "demo",
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { host: "demo.localhost" },
      cookies: { mms_refresh: token },
    });
    expect(res.statusCode).toBe(200);
    expect(mockConsumeAuthArtifact).toHaveBeenCalledWith("artifact-1", "refresh_token");
    expect(res.json()).toMatchObject({ user: { email: "admin@test.com" } });
    await app.close();
  });

  it("GET /api/auth/me rejects unauthenticated requests", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/auth/institution-setup-status returns workspace-wide completion", async () => {
    mockGetWorkspaceInstitutionSetupStatus.mockResolvedValueOnce(true);
    const app = await buildApp();
    const token = signTenantToken(app, { role: "admin", workspaceSubdomain: "demo" });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/institution-setup-status",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ complete: true });
    expect(mockGetWorkspaceInstitutionSetupStatus).toHaveBeenCalledWith("demo");
    await app.close();
  });

  it("GET /api/auth/institution-setup-status requires authentication", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/institution-setup-status",
      headers: { host: "demo.localhost" },
    });

    expect(res.statusCode).toBe(401);
    expect(mockGetWorkspaceInstitutionSetupStatus).not.toHaveBeenCalled();
    await app.close();
  });

  it("PUT /api/auth/me/contact returns validation_error on unique field conflict", async () => {
    mockGetTenantUserProfile.mockResolvedValueOnce({
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
      contact: {
        id: "c1",
        firstName: "Ali",
        lastName: "Khan",
        name: "Ali Khan",
      },
    });
    mockUpdateOwnLinkedContact.mockRejectedValueOnce(
      new ContactUniqueFieldError([
        { fieldId: "number", tabId: "phones", message: "Phone Number must be unique" },
      ]),
    );
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
    });
    const res = await app.inject({
      method: "PUT",
      url: "/api/auth/me/contact",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
      payload: {
        phones: [{ label: "Mobile", number: "+923001234567", countryCode: "+92" }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      type: "validation_error",
      errors: [{ fieldId: "number", tabId: "phones" }],
    });
    expect(mockUpdateOwnLinkedContact).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/auth/me rejects JWT bound to a different tenant", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
      workspaceSubdomain: "other",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("GET /api/auth/me rejects access token when 2FA is not verified", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
      twoFactorVerified: false,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "two_factor_required" });
    await app.close();
  });

  it("POST /api/students returns 403 for roles without write access", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "viewer@test.com",
      name: "Viewer",
      role: "viewer",
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/students",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
      payload: { id: "s1", name: "Test Student", status: "active", gender: "male" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("GET /api/students returns 403 for roles without read access", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "viewer@test.com",
      name: "Viewer",
      role: "viewer",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/students",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("POST /api/auth/refresh rejects replay after rotation", async () => {
    const token = "replay-refresh-token";
    mockFindRefreshTokenByHash.mockResolvedValueOnce({
      id: "artifact-replay",
      kind: "refresh_token",
      payload: {
        userId: "u1",
        workspaceSubdomain: "demo",
        tokenHash: hashRefreshToken(token),
      },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockGetPublicUserById.mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
      workspaceSubdomain: "demo",
    });

    const app = await buildApp();
    const first = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { host: "demo.localhost" },
      cookies: { mms_refresh: token },
    });
    expect(first.statusCode).toBe(200);

    mockFindRefreshTokenByHash.mockResolvedValue(null);
    const second = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { host: "demo.localhost" },
      cookies: { mms_refresh: token },
    });
    expect(second.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/contacts returns 403 for roles without write access", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "viewer@test.com",
      name: "Viewer",
      role: "viewer",
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/contacts",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${token}`,
      },
      payload: { id: "c1", firstName: "Test", lastName: "Contact" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("platform auth routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    mockVerifyPlatformUserPassword.mockReset().mockResolvedValue(true);
    mockDeleteWorkspace.mockReset().mockResolvedValue({
      id: "ws-demo",
      subdomain: "demo",
      madrasaName: "Demo Madrasa",
      createdAt: "2026-01-01T00:00:00.000Z",
      enabled: true,
    });
    mockHasPlatformUsers.mockReset().mockResolvedValue(true);
    mockFindPlatformUserByEmail.mockReset().mockResolvedValue(null);
    mockVerifyPassword.mockReset().mockResolvedValue(true);
    mockGetStoredPlatformUserById.mockReset().mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockGetJwtExpiresIn.mockReset().mockResolvedValue("15m");
  });

  it("POST /api/platform/auth/password/forgot accepts unknown email without leaking", async () => {
    mockFindPlatformUserByEmail.mockResolvedValueOnce(null);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/password/forgot",
      headers: { host: "localhost" },
      payload: { email: "unknown@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accepted: true });
    expect(mockPutAuthArtifact).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/platform/auth/password/forgot sends reset for existing platform user", async () => {
    mockFindPlatformUserByEmail.mockResolvedValue({
      id: "p1",
      email: "admin@example.com",
      name: "Admin",
      passwordHash: "hash",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockIsPlatformSmtpConfigured.mockReturnValue(false);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/password/forgot",
      headers: { host: "localhost" },
      payload: { email: "admin@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ accepted: true });
    expect(mockPutAuthArtifact).toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/platform/auth/setup/status reports first-run when empty", async () => {
    mockHasPlatformUsers.mockResolvedValueOnce(false);
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/auth/setup/status",
      headers: { host: "localhost" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ needsSetup: true });
    await app.close();
  });

  it("POST /api/platform/auth/setup/register creates superuser and issues session directly when no users exist", async () => {
    mockHasPlatformUsers.mockResolvedValue(false);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/setup/register",
      headers: { host: "localhost" },
      payload: {
        name: "Platform Admin",
        email: "admin@example.com",
        password: "SecurePass1",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { user: { email: string; role: string } };
    expect(body.user.email).toBe("admin@example.com");
    expect(body.user.role).toBe("super_user");
    await app.close();
  });

  it("POST /api/platform/auth/login rejects tenant subdomain host", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/login",
      headers: { host: "demo.localhost" },
      payload: { email: "platform@test.com", password: "password123" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("POST /api/platform/auth/login sets platform session cookie on apex", async () => {
    mockFindPlatformUserByEmail.mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockVerifyPassword.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/login",
      headers: { host: "localhost" },
      payload: { email: "platform@test.com", password: "password123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: "platform@test.com" } });
    const platformCookie = res.cookies.find((c) => c.name === PLATFORM_ACCESS_COOKIE);
    expect(platformCookie).toBeDefined();
    expect(typeof platformCookie?.value).toBe("string");
    expect(platformCookie!.value.length).toBeGreaterThan(0);
    expect(platformCookie?.maxAge).toBeUndefined();
    await app.close();
  });

  it("POST /api/platform/auth/login returns account_disabled for disabled admin with valid password", async () => {
    mockFindPlatformUserByEmail.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "admin",
      permissions: { workspaces: true, onboard: false },
      sessionVersion: 0,
      disabledAt: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockVerifyPassword.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/login",
      headers: { host: "localhost" },
      payload: { email: "operator@test.com", password: "password123" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "account_disabled" });
    await app.close();
  });

  it("POST /api/platform/auth/login runs dummy verification when account does not exist to prevent timing attacks", async () => {
    mockFindPlatformUserByEmail.mockResolvedValue(null);
    mockVerifyPassword.mockResolvedValue(false);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/auth/login",
      headers: { host: "localhost" },
      payload: { email: "nonexistent@test.com", password: "password123" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "invalid_credentials" });
    expect(mockVerifyPassword).toHaveBeenCalledWith(
      "password123",
      expect.stringMatching(/^[0-9a-f]{32}:[0-9a-f]{128}$/i),
    );
    await app.close();
  });

  it("GET /api/platform/auth/me soft-probes session on apex", async () => {
    const app = await buildApp();
    const unauth = await app.inject({
      method: "GET",
      url: "/api/platform/auth/me",
      headers: { host: "localhost" },
    });
    expect(unauth.statusCode).toBe(200);
    expect(unauth.json()).toMatchObject({ user: null, isAuthenticated: false });

    const token = app.jwt.sign({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      role: "platform_super",
      tokenType: "platform_access",
    });
    const authed = await app.inject({
      method: "GET",
      url: "/api/platform/auth/me",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(authed.statusCode).toBe(200);
    expect(authed.json()).toMatchObject({
      user: { email: "platform@test.com" },
      isAuthenticated: true,
    });
    await app.close();
  });

  it("POST /api/auth/onboard requires platform authentication on apex", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/onboard",
      headers: { host: "localhost" },
      payload: {
        madrasaName: "Test Madrasa",
        adminName: "Admin",
        email: "admin@test.com",
        password: "password123",
        subdomain: "testmadrasa",
      },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /api/auth/onboard rejects platform admin without onboard permission", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "admin",
      permissions: { workspaces: true, onboard: false },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      role: "admin",
      tokenType: "platform_access",
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/onboard",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: {
        madrasaName: "Test Madrasa",
        adminName: "Admin",
        email: "admin@test.com",
        password: "password123",
        subdomain: "testmadrasa",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    await app.close();
  });

  it("POST /api/auth/onboard accepts payload without admin password and evaluates step-up password", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockVerifyPlatformUserPassword.mockResolvedValue(false);
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      role: "super_user",
      tokenType: "platform_access",
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/onboard",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: {
        madrasaName: "Test Madrasa",
        adminName: "Admin",
        email: "admin@test.com",
        currentPassword: "wrong-operator-password",
        subdomain: "testmadrasa",
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "invalid_current_password" });
    await app.close();
  });

  it("GET /api/platform/workspaces rejects platform admin without workspaces permission", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "admin",
      permissions: { workspaces: false, onboard: true },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      role: "admin",
      tokenType: "platform_access",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockListPlatformWorkspaces).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/platform/workspaces allows platform admin with workspaces permission", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "admin",
      permissions: { workspaces: true, onboard: false },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      role: "admin",
      tokenType: "platform_access",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(res.statusCode).toBe(200);
    expect(mockListPlatformWorkspaces).toHaveBeenCalled();
    await app.close();
  });

  it("PATCH /api/platform/users/:id/permissions rejects non-super platform admin", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "admin",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      role: "admin",
      tokenType: "platform_access",
    });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/users/p-target/permissions",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: { permissions: { workspaces: true, onboard: false }, password: "TestPassword123!" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "forbidden" });
    expect(mockSetPlatformAdminPermissions).not.toHaveBeenCalled();
    await app.close();
  });

  it("PATCH /api/platform/users/:id/permissions allows super_user", async () => {
    mockSetPlatformAdminPermissions.mockResolvedValue({
      id: "p-target",
      email: "admin@test.com",
      name: "Target Admin",
      role: "admin",
      permissions: {
        workspaces: true,
        onboard: false,
        settings: false,
        admins: false,
        system: false,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockVerifyPlatformUserPassword.mockResolvedValue(true);
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      role: "super_user",
      tokenType: "platform_access",
    });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/platform/users/p-target/permissions",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: {
        permissions: {
          workspaces: true,
          onboard: false,
          settings: false,
          admins: false,
          system: false,
        },
        password: "TestPassword123!",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockSetPlatformAdminPermissions).toHaveBeenCalledWith("p-target", {
      workspaces: true,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    });
    expect(res.json()).toMatchObject({
      user: {
        id: "p-target",
        permissions: {
          workspaces: true,
          onboard: false,
          settings: false,
          admins: false,
          system: false,
        },
      },
    });
    await app.close();
  });

  it("GET /api/platform/auth/me ignores tenant access token on apex", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/auth/me",
      headers: { host: "localhost" },
      cookies: { mms_access: token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: null, isAuthenticated: false });
    await app.close();
  });

  it("GET /api/auth/me rejects platform access token on tenant host", async () => {
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      role: "platform_super",
      tokenType: "platform_access",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { host: "demo.localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/auth/me rejects tenant session on apex host", async () => {
    const app = await buildApp();
    const token = signTenantToken(app, {
      id: "u1",
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { host: "localhost" },
      cookies: { mms_access: token },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/platform/auth/me soft-clears stale sessionVersion", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p1",
      tokenType: "platform_access",
      sessionVersion: 0,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/auth/me",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: null, isAuthenticated: false });
    const setCookie = res.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie ?? "");
    expect(cookieHeader).toMatch(/mms_platform_access=/);
    await app.close();
  });

  it("GET /api/platform/auth/me soft-clears disabled platform admin", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "admin",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      disabledAt: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p-admin",
      tokenType: "platform_access",
      sessionVersion: 0,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/auth/me",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: null, isAuthenticated: false });
    await app.close();
  });

  it("GET /api/platform/workspaces rejects stale sessionVersion with 401", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p1",
      tokenType: "platform_access",
      sessionVersion: 0,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      type: "session_revoked",
      message: "Platform session has been revoked",
    });
    await app.close();
  });

  it("GET /api/platform/workspaces rejects disabled platform admin with 401", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p-admin",
      email: "operator@test.com",
      name: "Platform Operator",
      passwordHash: "hash",
      role: "admin",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      disabledAt: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p-admin",
      tokenType: "platform_access",
      sessionVersion: 0,
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/workspaces",
      headers: { host: "localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "account_disabled" });
    await app.close();
  });

  it("POST /api/platform/auth/setup/register creates superuser without requiring SMTP in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousJwt = process.env.JWT_SECRET;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "test-secret-must-be-at-least-32-chars!!";
      process.env.DATABASE_URL =
        previousDatabaseUrl ?? "postgres://postgres:postgres@localhost:5432/mms";
      mockHasPlatformUsers.mockResolvedValue(false);
      mockIsPlatformSmtpConfigured.mockReturnValue(false);

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/platform/auth/setup/register",
        headers: { host: "localhost" },
        payload: {
          name: "Platform Admin",
          email: "admin@example.com",
          password: "SecurePass1",
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        user: { email: "admin@example.com", role: "super_user" },
      });
      await app.close();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.JWT_SECRET = previousJwt ?? "test-secret";
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("POST /api/platform/auth/password/forgot requires SMTP in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousJwt = process.env.JWT_SECRET;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "test-secret-must-be-at-least-32-chars!!";
      process.env.DATABASE_URL =
        previousDatabaseUrl ?? "postgres://postgres:postgres@localhost:5432/mms";
      mockIsPlatformSmtpConfigured.mockReturnValue(false);
      mockPutAuthArtifact.mockClear();

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/platform/auth/password/forgot",
        headers: { host: "localhost" },
        payload: { email: "admin@example.com" },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ type: "smtp_required" });
      expect(mockPutAuthArtifact).not.toHaveBeenCalled();
      await app.close();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.JWT_SECRET = previousJwt ?? "test-secret";
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it("DELETE /api/platform/workspaces/:subdomain requires password and confirmSubdomain", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p1",
      tokenType: "platform_access",
      sessionVersion: 0,
    });

    const badConfirm = await app.inject({
      method: "DELETE",
      url: "/api/platform/workspaces/demo",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: { password: "TestPassword123!", confirmSubdomain: "other" },
    });
    expect(badConfirm.statusCode).toBe(400);
    expect(mockDeleteWorkspace).not.toHaveBeenCalled();

    mockVerifyPlatformUserPassword.mockResolvedValueOnce(false);
    const badPassword = await app.inject({
      method: "DELETE",
      url: "/api/platform/workspaces/demo",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: { password: "wrong", confirmSubdomain: "demo" },
    });
    expect(badPassword.statusCode).toBe(401);
    expect(mockDeleteWorkspace).not.toHaveBeenCalled();

    mockVerifyPlatformUserPassword.mockResolvedValueOnce(true);
    const ok = await app.inject({
      method: "DELETE",
      url: "/api/platform/workspaces/demo",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: { password: "TestPassword123!", confirmSubdomain: "demo" },
    });
    expect(ok.statusCode).toBe(200);
    expect(mockDeleteWorkspace).toHaveBeenCalledWith("demo");
    await app.close();
  });

  it("DELETE /api/platform/users/:id deletes admin after password check", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: { workspaces: true, onboard: true },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockDeletePlatformAdmin.mockResolvedValue(undefined);
    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p1",
      tokenType: "platform_access",
      sessionVersion: 0,
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/platform/users/p-target",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: { password: "TestPassword123!" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeletePlatformAdmin).toHaveBeenCalledWith("p-target");
    await app.close();
  });

  it("POST workspace reset/create admin reject wrong operator password", async () => {
    mockGetStoredPlatformUserById.mockResolvedValue({
      id: "p1",
      email: "platform@test.com",
      name: "Platform Admin",
      passwordHash: "hash",
      role: "super_user",
      permissions: {
        workspaces: true,
        onboard: true,
        settings: true,
        admins: true,
        system: true,
      },
      sessionVersion: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockVerifyPlatformUserPassword.mockResolvedValue(false);
    mockResetWorkspaceAdminPassword.mockResolvedValue({
      success: true,
      subdomain: "demo",
      adminEmail: "admin@demo.local",
      newPassword: "generated",
    });
    mockCreateWorkspaceAdminUser.mockResolvedValue({
      success: true,
      subdomain: "demo",
      adminEmail: "new@demo.local",
      name: "New Admin",
      initialPassword: "generated",
    });

    const app = await buildApp();
    const token = app.jwt.sign({
      id: "p1",
      tokenType: "platform_access",
      sessionVersion: 0,
    });

    const resetRes = await app.inject({
      method: "POST",
      url: "/api/platform/workspaces/demo/reset-admin-password",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: { password: "wrong" },
    });
    expect(resetRes.statusCode).toBe(401);
    expect(mockResetWorkspaceAdminPassword).not.toHaveBeenCalled();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/platform/workspaces/demo/admin-users",
      headers: { host: "localhost", origin: "http://localhost" },
      cookies: { [PLATFORM_ACCESS_COOKIE]: token },
      payload: {
        name: "New Admin",
        email: "new@demo.local",
        currentPassword: "wrong",
      },
    });
    expect(createRes.statusCode).toBe(401);
    expect(mockCreateWorkspaceAdminUser).not.toHaveBeenCalled();
    await app.close();
  });
});
