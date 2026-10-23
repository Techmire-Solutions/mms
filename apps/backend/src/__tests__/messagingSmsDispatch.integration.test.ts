import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { signTenantToken } from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
  findAuthArtifactByLookupKey: vi.fn(),
  tryClaimAuthArtifactByLookupKey: vi.fn(),
  updateAuthArtifactPayload: vi.fn(),
  deleteAuthArtifact: vi.fn(),
  authArtifactUserScopeKey: (userId: string) => `user:${userId}`,
  authArtifactWorkspaceScopeKey: (subdomain: string) => `ws:${subdomain}`,
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo"
          ? { id: "ws-demo", subdomain: "demo", madrasaName: "Demo Madrasa", enabled: true }
          : null,
      ),
  };
});

const mockRecordMessageLogs = vi.fn();
vi.mock("../messaging/use-cases/messagingUseCases.js", () => ({
  messagingUseCases: {
    recordMessageLogs: (...args: unknown[]) => mockRecordMessageLogs(...args),
  },
}));

const mockSendTenantSms = vi.fn();
vi.mock("../services/sms/smsService.js", () => ({
  sendTenantSms: (...args: unknown[]) => mockSendTenantSms(...args),
}));

describe("POST /api/messaging/dispatch/sms", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    mockRecordMessageLogs.mockReset().mockResolvedValue(1);
    mockSendTenantSms.mockReset().mockResolvedValue({ sent: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires authentication", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/dispatch/sms",
      payload: {
        recipients: [{ id: "c-1", phone: "+1234567890", name: "Student A" }],
        message: "Hello {name}",
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it("denies user without messaging.write permission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/dispatch/sms",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "accountant", name: "accountant" })}`,
      },
      payload: {
        recipients: [{ id: "c-1", phone: "+1234567890", name: "Student A" }],
        message: "Hello {name}",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects unknown personalization tokens", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/dispatch/sms",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        recipients: [{ id: "c-1", phone: "+1234567890", name: "Student A" }],
        message: "Hello {bad_token}",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain("bad_token");
  });

  it("dispatches SMS and records logs for authorized user", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/dispatch/sms",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        recipients: [
          { id: "c-1", phone: "+1234567890", name: "Student A" },
          { id: "c-2", phone: "+1234567891", name: "Student B" },
        ],
        message: "Hello {name}, your attendance is {attendance_status}",
        category: "attendance",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
    expect(mockSendTenantSms).toHaveBeenCalledTimes(2);
    expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
    const [tenant, logs] = mockRecordMessageLogs.mock.calls[0];
    expect(tenant).toBe("demo");
    expect(logs).toHaveLength(2);
    expect(logs[0].contactId).toBe("c-1");
    expect(logs[0].category).toBe("attendance");
    expect(logs[0].status).toBe("sent");
  });
});
