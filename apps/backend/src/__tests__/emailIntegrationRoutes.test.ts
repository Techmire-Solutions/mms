import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken, viewerToken } from "./helpers/tokens.js";
import { DEFAULT_EMAIL_INTEGRATION } from "@mms/shared";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
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
  };
});

const mockLoadEmailConfig = vi.fn().mockResolvedValue(DEFAULT_EMAIL_INTEGRATION);
const mockSaveEmailConfig = vi.fn().mockResolvedValue(DEFAULT_EMAIL_INTEGRATION);
const mockSaveEmailSecrets = vi.fn().mockResolvedValue(undefined);
const mockMarkResult = vi.fn().mockResolvedValue(DEFAULT_EMAIL_INTEGRATION);

vi.mock("../services/email/emailIntegrationService.js", () => ({
  loadEmailIntegrationConfig: () => mockLoadEmailConfig(),
  saveEmailIntegrationConfig: (args: unknown) => mockSaveEmailConfig(args),
  saveEmailIntegrationSecrets: (args: unknown) => mockSaveEmailSecrets(args),
  markEmailIntegrationTestResult: (ok: boolean, err?: string) => mockMarkResult(ok, err),
}));

const mockVerifyEmailTransport = vi.fn().mockResolvedValue({ sent: true });
const mockSendTenantEmail = vi.fn().mockResolvedValue({ sent: true });

vi.mock("../services/email/emailService.js", () => ({
  verifyEmailTransport: () => mockVerifyEmailTransport(),
  sendTenantEmail: (payload: unknown, settings: unknown) => mockSendTenantEmail(payload, settings),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  loadGlobalSettings: vi.fn().mockResolvedValue({ emailNotifications: true }),
}));

describe("emailRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies access to integration settings for non-admin viewers", async () => {
    const app = await buildApp();
    const token = viewerToken(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/email/integration",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.mms.local",
      },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns integration config for admin", async () => {
    const app = await buildApp();
    const token = adminToken(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/email/integration",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.mms.local",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(DEFAULT_EMAIL_INTEGRATION);
    await app.close();
  });

  it("runs email integration test with custom recipient", async () => {
    const app = await buildApp();
    const token = adminToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/email/integration/test",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.mms.local",
      },
      payload: {
        testEmail: "custom-recipient@example.com",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockVerifyEmailTransport).toHaveBeenCalled();
    expect(mockSendTenantEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "custom-recipient@example.com",
        subject: "MMS email test",
      }),
      expect.anything(),
    );
    await app.close();
  });

  it("runs email integration test falling back to session user email when omitted", async () => {
    const app = await buildApp();
    const token = adminToken(app, { email: "admin-session@example.com" });

    const res = await app.inject({
      method: "POST",
      url: "/api/email/integration/test",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.mms.local",
      },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockSendTenantEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin-session@example.com",
      }),
      expect.anything(),
    );
    await app.close();
  });

  it("rejects invalid testEmail payload with 400", async () => {
    const app = await buildApp();
    const token = adminToken(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/email/integration/test",
      headers: {
        authorization: `Bearer ${token}`,
        host: "demo.mms.local",
      },
      payload: {
        testEmail: "not-a-valid-email",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(mockSendTenantEmail).not.toHaveBeenCalled();
    await app.close();
  });
});
