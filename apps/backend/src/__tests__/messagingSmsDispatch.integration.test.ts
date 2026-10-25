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

  const smsPayload = (message = "Hello {name}") => ({
    recipients: [
      { id: "c-1", phone: "+1234567890", name: "Student A" },
      { id: "c-2", phone: "+1234567891", name: "Student B" },
    ],
    message,
  });

  const authHeaders = async () => {
    const app = await buildApp();
    return {
      app,
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
    };
  };

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

  it("replays the first response without re-sending when the same idempotency key is reused", async () => {
    const {
      findAuthArtifactByLookupKey,
      tryClaimAuthArtifactByLookupKey,
      updateAuthArtifactPayload,
    } = await import("../services/auth/authArtifactService.js");
    vi.mocked(findAuthArtifactByLookupKey).mockReset().mockResolvedValue(null);
    vi.mocked(tryClaimAuthArtifactByLookupKey)
      .mockReset()
      .mockResolvedValue({ claimed: true, id: "art-1" });
    vi.mocked(updateAuthArtifactPayload).mockReset().mockResolvedValue(undefined);

    const { app, headers } = await authHeaders();
    const payload = { ...smsPayload(), idempotencyKey: "sms-dispatch-001" };

    const first = await app.inject({ method: "POST", url: "/api/messaging/dispatch/sms", headers, payload });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
    expect(mockSendTenantSms).toHaveBeenCalledTimes(2);
    expect(tryClaimAuthArtifactByLookupKey).toHaveBeenCalledTimes(1);
    const finalizedPayload = vi.mocked(updateAuthArtifactPayload).mock.calls[0]?.[1] as {
      response: { sentCount: number; failedCount: number; total: number };
      bodyDigest: string;
    };
    expect(finalizedPayload.response).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
    expect(finalizedPayload.bodyDigest).toMatch(/^[a-f0-9]{64}$/);

    const replayPayload = {
      response: finalizedPayload.response,
      bodyDigest: finalizedPayload.bodyDigest,
    };
    vi.mocked(findAuthArtifactByLookupKey).mockResolvedValue({
      id: "art-1",
      kind: "messaging_idempotency",
      payload: replayPayload,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const second = await app.inject({ method: "POST", url: "/api/messaging/dispatch/sms", headers, payload });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
    expect(mockSendTenantSms).toHaveBeenCalledTimes(2);
    expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
    expect(tryClaimAuthArtifactByLookupKey).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 409 when the idempotency key is reused with a different body", async () => {
    const { findAuthArtifactByLookupKey } = await import(
      "../services/auth/authArtifactService.js"
    );
    vi.mocked(findAuthArtifactByLookupKey).mockReset().mockResolvedValue({
      id: "art-mismatch",
      kind: "messaging_idempotency",
      payload: {
        response: { sentCount: 1, failedCount: 0, total: 1 },
        bodyDigest: "a".repeat(64),
      },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { app, headers } = await authHeaders();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/dispatch/sms",
      headers,
      payload: { ...smsPayload("Different message"), idempotencyKey: "sms-dispatch-002" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      type: "conflict",
      message: "Idempotency key reused with a different request body",
    });
    expect(mockSendTenantSms).not.toHaveBeenCalled();
    expect(mockRecordMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("dispatches without touching the idempotency store when no key is supplied", async () => {
    const { tryClaimAuthArtifactByLookupKey } = await import(
      "../services/auth/authArtifactService.js"
    );
    vi.mocked(tryClaimAuthArtifactByLookupKey).mockReset();

    const { app, headers } = await authHeaders();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/dispatch/sms",
      headers,
      payload: smsPayload(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
    expect(mockSendTenantSms).toHaveBeenCalledTimes(2);
    expect(tryClaimAuthArtifactByLookupKey).not.toHaveBeenCalled();
    await app.close();
  });
});
