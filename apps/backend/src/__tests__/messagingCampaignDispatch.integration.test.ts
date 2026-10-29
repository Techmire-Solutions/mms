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

const mockSendTenantEmail = vi.fn();
vi.mock("../services/email/emailService.js", () => ({
  sendTenantEmail: (...args: unknown[]) => mockSendTenantEmail(...args),
}));

const mockSendTenantWhatsApp = vi.fn();
vi.mock("../services/whatsapp/whatsappService.js", () => ({
  sendTenantWhatsApp: (...args: unknown[]) => mockSendTenantWhatsApp(...args),
}));

const mockEnqueueBackgroundJob = vi.fn();
const mockGetUserBackgroundJob = vi.fn();
const mockGetUserBackgroundJobPayload = vi.fn();
vi.mock("../services/backgroundJobWorkerService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/backgroundJobWorkerService.js")>();
  return {
    ...actual,
    enqueueBackgroundJob: (...args: unknown[]) => mockEnqueueBackgroundJob(...args),
    getUserBackgroundJob: (...args: unknown[]) => mockGetUserBackgroundJob(...args),
    getUserBackgroundJobPayload: (...args: unknown[]) => mockGetUserBackgroundJobPayload(...args),
  };
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

describe("Messaging Campaign Dispatch Routes", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    mockRecordMessageLogs.mockReset().mockResolvedValue(1);
    mockSendTenantEmail.mockReset().mockResolvedValue({ sent: true });
    mockSendTenantWhatsApp.mockReset().mockResolvedValue({ sent: true });
    mockEnqueueBackgroundJob.mockReset().mockResolvedValue({
      id: "job-123",
      moduleId: "messaging",
      kind: "dispatch",
      status: "running",
      label: "Campaign queued",
      createdAt: new Date().toISOString(),
    });
    mockGetUserBackgroundJob.mockReset().mockResolvedValue(null);
    mockGetUserBackgroundJobPayload.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/messaging/dispatch/email", () => {
    it("requires authentication", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        payload: {
          recipients: [{ id: "c-1", email: "student@example.com", name: "Student A" }],
          subject: "Notice for {name}",
          message: "Hello {name}",
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects unknown personalization tokens", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
        },
        payload: {
          recipients: [{ id: "c-1", email: "student@example.com", name: "Student A" }],
          subject: "Notice {unknown_token_xyz}",
          message: "Hello {name}",
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain("Unknown personalization token");
    });

    it("dispatches emails and records logs for authorized admin", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
        },
        payload: {
          recipients: [
            { id: "c-1", email: "alice@example.com", name: "Alice" },
            { id: "c-2", email: "bob@example.com", name: "Bob" },
          ],
          subject: "Greetings {name}",
          message: "Dear {name}, classes start soon.",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
      expect(mockSendTenantEmail).toHaveBeenCalledTimes(2);
      expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
    });

    it("enqueues background job with 202 when queued: true", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
        },
        payload: {
          recipients: [{ id: "c-1", email: "alice@example.com", name: "Alice" }],
          subject: "Notice {name}",
          message: "Classes start Monday",
          queued: true,
        },
      });

      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.queued).toBe(true);
      expect(body.job.id).toBe("job-123");
      expect(mockEnqueueBackgroundJob).toHaveBeenCalledTimes(1);
    });

    it("replays the first response without re-sending under the same idempotency key", async () => {
      const {
        findAuthArtifactByLookupKey,
        tryClaimAuthArtifactByLookupKey,
        updateAuthArtifactPayload,
      } = await import("../services/auth/authArtifactService.js");
      vi.mocked(findAuthArtifactByLookupKey).mockReset().mockResolvedValue(null);
      vi.mocked(tryClaimAuthArtifactByLookupKey)
        .mockReset()
        .mockResolvedValue({ claimed: true, id: "art-email-1" });
      vi.mocked(updateAuthArtifactPayload).mockReset().mockResolvedValue(undefined);

      const { app, headers } = await authHeaders();
      const payload = {
        recipients: [
          { id: "c-1", email: "alice@example.com", name: "Alice" },
          { id: "c-2", email: "bob@example.com", name: "Bob" },
        ],
        subject: "Greetings {name}",
        message: "Dear {name}, classes start soon.",
        idempotencyKey: "email-dispatch-001",
      };

      const first = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        headers,
        payload,
      });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
      expect(mockSendTenantEmail).toHaveBeenCalledTimes(2);
      expect(tryClaimAuthArtifactByLookupKey).toHaveBeenCalledTimes(1);

      const finalizedPayload = vi.mocked(updateAuthArtifactPayload).mock.calls[0]?.[1] as {
        response: { sentCount: number; failedCount: number; total: number };
        bodyDigest: string;
      };
      expect(finalizedPayload.response).toEqual({
        sentCount: 2,
        failedCount: 0,
        total: 2,
      });
      expect(finalizedPayload.bodyDigest).toMatch(/^[a-f0-9]{64}$/);

      vi.mocked(findAuthArtifactByLookupKey).mockResolvedValue({
        id: "art-email-1",
        kind: "messaging_idempotency",
        payload: {
          response: finalizedPayload.response,
          bodyDigest: finalizedPayload.bodyDigest,
        },
        expiresAt: new Date(Date.now() + 60_000),
      });

      const second = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        headers,
        payload,
      });
      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
      expect(mockSendTenantEmail).toHaveBeenCalledTimes(2);
      expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
      expect(tryClaimAuthArtifactByLookupKey).toHaveBeenCalledTimes(1);
      await app.close();
    });

    it("returns 409 when the idempotency key is reused with a different body", async () => {
      const { findAuthArtifactByLookupKey } =
        await import("../services/auth/authArtifactService.js");
      vi.mocked(findAuthArtifactByLookupKey)
        .mockReset()
        .mockResolvedValue({
          id: "art-email-mismatch",
          kind: "messaging_idempotency",
          payload: {
            response: { sentCount: 1, failedCount: 0, total: 1 },
            bodyDigest: "b".repeat(64),
          },
          expiresAt: new Date(Date.now() + 60_000),
        });

      const { app, headers } = await authHeaders();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        headers,
        payload: {
          recipients: [{ id: "c-1", email: "alice@example.com", name: "Alice" }],
          subject: "Different subject",
          message: "Different message",
          idempotencyKey: "email-dispatch-002",
        },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        type: "conflict",
        message: "Idempotency key reused with a different request body",
      });
      expect(mockSendTenantEmail).not.toHaveBeenCalled();
      expect(mockRecordMessageLogs).not.toHaveBeenCalled();
      await app.close();
    });

    it("passes the client idempotency key and body digest into the queued job payload", async () => {
      mockEnqueueBackgroundJob
        .mockReset()
        .mockImplementation(
          async (
            _tenant: unknown,
            _userId: unknown,
            job: { id: string; label: string },
            jobPayload: Record<string, unknown>,
          ) => ({
            ...job,
            moduleId: "messaging" as const,
            status: "running" as const,
            createdAt: new Date().toISOString(),
            jobPayload,
          }),
        );
      const { app, headers } = await authHeaders();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/email",
        headers,
        payload: {
          recipients: [{ id: "c-1", email: "alice@example.com", name: "Alice" }],
          subject: "Notice {name}",
          message: "Classes start Monday",
          queued: true,
          idempotencyKey: "email-dispatch-que-01",
        },
      });

      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.job.id).toBe("demo:u-admin:email-dispatch-que-01");
      const [tenant, userId, job, jobPayload] = mockEnqueueBackgroundJob.mock.calls[0];
      expect(tenant).toBe("demo");
      expect(userId).toBe("u-admin");
      expect(job.id).toBe("demo:u-admin:email-dispatch-que-01");
      expect(jobPayload).toEqual(
        expect.objectContaining({
          channel: "email",
          idempotencyKey: "email-dispatch-que-01",
          bodyDigest: expect.stringMatching(/^[a-f0-9]{64}$/) as string,
        }),
      );
      await app.close();
    });
  });

  describe("POST /api/messaging/dispatch/whatsapp", () => {
    it("requires authentication", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/whatsapp",
        payload: {
          recipients: [{ id: "c-1", phone: "+1234567890", name: "Student A" }],
          message: "Hello {name}",
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("dispatches whatsapp messages and records logs for authorized admin", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/whatsapp",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
        },
        payload: {
          recipients: [
            { id: "c-1", phone: "+1234567890", name: "Alice" },
            { id: "c-2", phone: "+9876543210", name: "Bob" },
          ],
          message: "Salaam {name}",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
      expect(mockSendTenantWhatsApp).toHaveBeenCalledTimes(2);
      expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
    });

    it("enqueues background job with 202 when recipients count exceeds 50", async () => {
      const app = await buildApp();
      const largeRecipientList = Array.from({ length: 55 }, (_, i) => ({
        id: `c-${i}`,
        phone: `+123456789${i}`,
        name: `Student ${i}`,
      }));

      const res = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/whatsapp",
        headers: {
          host: "demo.localhost",
          authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
        },
        payload: {
          recipients: largeRecipientList,
          message: "Broadcast announcement",
        },
      });

      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.queued).toBe(true);
      expect(mockEnqueueBackgroundJob).toHaveBeenCalledTimes(1);
    });

    it("replays the first response without re-sending under the same idempotency key", async () => {
      const {
        findAuthArtifactByLookupKey,
        tryClaimAuthArtifactByLookupKey,
        updateAuthArtifactPayload,
      } = await import("../services/auth/authArtifactService.js");
      vi.mocked(findAuthArtifactByLookupKey).mockReset().mockResolvedValue(null);
      vi.mocked(tryClaimAuthArtifactByLookupKey)
        .mockReset()
        .mockResolvedValue({ claimed: true, id: "art-wa-1" });
      vi.mocked(updateAuthArtifactPayload).mockReset().mockResolvedValue(undefined);

      const { app, headers } = await authHeaders();
      const payload = {
        recipients: [
          { id: "c-1", phone: "+1234567890", name: "Alice" },
          { id: "c-2", phone: "+9876543210", name: "Bob" },
        ],
        message: "Salaam {name}",
        idempotencyKey: "whatsapp-dispatch-01",
      };

      const first = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/whatsapp",
        headers,
        payload,
      });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
      expect(mockSendTenantWhatsApp).toHaveBeenCalledTimes(2);
      expect(tryClaimAuthArtifactByLookupKey).toHaveBeenCalledTimes(1);

      const finalizedPayload = vi.mocked(updateAuthArtifactPayload).mock.calls[0]?.[1] as {
        response: { sentCount: number; failedCount: number; total: number };
        bodyDigest: string;
      };
      expect(finalizedPayload.response).toEqual({
        sentCount: 2,
        failedCount: 0,
        total: 2,
      });

      vi.mocked(findAuthArtifactByLookupKey).mockResolvedValue({
        id: "art-wa-1",
        kind: "messaging_idempotency",
        payload: {
          response: finalizedPayload.response,
          bodyDigest: finalizedPayload.bodyDigest,
        },
        expiresAt: new Date(Date.now() + 60_000),
      });

      const second = await app.inject({
        method: "POST",
        url: "/api/messaging/dispatch/whatsapp",
        headers,
        payload,
      });
      expect(second.statusCode).toBe(200);
      expect(second.json()).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
      expect(mockSendTenantWhatsApp).toHaveBeenCalledTimes(2);
      expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
      expect(tryClaimAuthArtifactByLookupKey).toHaveBeenCalledTimes(1);
      await app.close();
    });
  });
});
