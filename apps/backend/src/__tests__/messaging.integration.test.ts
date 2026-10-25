import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { signTenantToken } from "./helpers/tokens.js";
import { isAllowedCollectionName } from "../services/rbacService.js";

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

const mockLoadMessageTemplates = vi.fn();
const mockLoadFilteredMessageLogs = vi.fn();
const mockClearAllMessageLogs = vi.fn();
const mockRestoreMessageLogs = vi.fn();
const mockComputeMessagingMetrics = vi.fn();
const mockSaveMessageTemplate = vi.fn();
const mockRemoveMessageTemplate = vi.fn();
const mockRecordMessageLogs = vi.fn();
const mockLoadMessagingRecipients = vi.fn();
const mockMatchMessagingRecipients = vi.fn();
const mockResolveMessagingRecipients = vi.fn();
const mockFindMessageTemplateById = vi.fn();
const mockEnqueueBackgroundJob = vi.fn();
const mockGetUserBackgroundJob = vi.fn();
const mockGetUserBackgroundJobPayload = vi.fn();
const mockRecordAudit = vi.fn();
const mockGetUserColumnPreferencesForModule = vi.fn();
const mockSetUserColumnPreferencesForModule = vi.fn();

vi.mock("../messaging/use-cases/messagingUseCases.js", () => ({
  messagingUseCases: {
    loadMessageTemplates: (...args: unknown[]) => mockLoadMessageTemplates(...args),
    getMessageTemplateById: (...args: unknown[]) => mockFindMessageTemplateById(...args),
    saveMessageTemplate: (...args: unknown[]) => mockSaveMessageTemplate(...args),
    removeMessageTemplate: (...args: unknown[]) => mockRemoveMessageTemplate(...args),
    loadMessageLogs: vi.fn().mockResolvedValue([]),
    loadFilteredMessageLogs: (...args: unknown[]) => mockLoadFilteredMessageLogs(...args),
    recordMessageLogs: (...args: unknown[]) => mockRecordMessageLogs(...args),
    clearAllMessageLogs: (...args: unknown[]) => mockClearAllMessageLogs(...args),
    restoreMessageLogs: (...args: unknown[]) => mockRestoreMessageLogs(...args),
    computeMessagingMetrics: (...args: unknown[]) => mockComputeMessagingMetrics(...args),
    loadMessagingRecipients: (...args: unknown[]) => mockLoadMessagingRecipients(...args),
    matchMessagingRecipients: (...args: unknown[]) => mockMatchMessagingRecipients(...args),
    resolveMessagingRecipients: (...args: unknown[]) => mockResolveMessagingRecipients(...args),
    replaceMessageTemplates: vi.fn(),
    replaceMessageLogs: vi.fn(),
  },
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (first: unknown, second?: unknown) => {
    const input = (second ?? first) as {
      realUserId?: string;
      tableName?: string;
      recordId?: string;
      newState?: { action?: string; summary?: string };
    };
    mockRecordAudit({
      userId: input.realUserId,
      action: input.newState?.action,
      entityType: "collection",
      entityId: input.recordId,
      summary: input.newState?.summary,
    });
    return Promise.resolve({
      hashPrevious: "0".repeat(64),
      hashCurrent: "1".repeat(64),
      canonicalPayload: "{}",
    });
  },
  mapActionStringToAuditType: (action: string) =>
    action.includes("delete") ? "DELETE" : action.includes("create") ? "CREATE" : "UPDATE",
  getLatestShardHash: vi.fn().mockResolvedValue("0".repeat(64)),
}));

vi.mock("../services/backgroundJobWorkerService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/backgroundJobWorkerService.js")>();
  return {
    ...actual,
    enqueueBackgroundJob: (...args: unknown[]) => mockEnqueueBackgroundJob(...args),
    getUserBackgroundJob: (...args: unknown[]) => mockGetUserBackgroundJob(...args),
    getUserBackgroundJobPayload: (...args: unknown[]) => mockGetUserBackgroundJobPayload(...args),
  };
});

vi.mock("../services/userColumnPreferencesService.js", () => ({
  getUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockGetUserColumnPreferencesForModule(...args),
  setUserColumnPreferencesForModule: (...args: unknown[]) =>
    mockSetUserColumnPreferencesForModule(...args),
}));

describe("messaging REST routes", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    const {
      findAuthArtifactByLookupKey,
      tryClaimAuthArtifactByLookupKey,
      updateAuthArtifactPayload,
      deleteAuthArtifact,
    } = await import("../services/auth/authArtifactService.js");
    vi.mocked(findAuthArtifactByLookupKey).mockReset().mockResolvedValue(null);
    vi.mocked(tryClaimAuthArtifactByLookupKey)
      .mockReset()
      .mockResolvedValue({ claimed: true, id: "art-id" });
    vi.mocked(updateAuthArtifactPayload).mockReset().mockResolvedValue(undefined);
    vi.mocked(deleteAuthArtifact).mockReset().mockResolvedValue(undefined);
    mockLoadMessageTemplates.mockReset().mockResolvedValue([]);
    mockFindMessageTemplateById.mockReset().mockResolvedValue(null);
    mockLoadFilteredMessageLogs.mockReset().mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      pageSize: 50,
      hasMore: false,
    });
    mockClearAllMessageLogs.mockReset().mockResolvedValue(undefined);
    mockRestoreMessageLogs.mockReset().mockResolvedValue(0);
    mockSaveMessageTemplate
      .mockReset()
      .mockImplementation(async (_tenant: string, template: unknown) => template);
    mockRemoveMessageTemplate.mockReset().mockResolvedValue(undefined);
    mockRecordMessageLogs
      .mockReset()
      .mockImplementation(async (_tenant: string, logs: unknown[]) => logs);
    mockComputeMessagingMetrics.mockReset().mockResolvedValue({
      total: 0,
      smsCount: 0,
      whatsappCount: 0,
      emailCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      skippedCount: 0,
      queuedCount: 0,
      successRate: 100,
    });
    mockLoadMessagingRecipients.mockReset().mockResolvedValue({
      contacts: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });
    mockMatchMessagingRecipients.mockReset().mockResolvedValue({
      recipients: [],
      total: 0,
      truncated: false,
      limit: 10_000,
    });
    mockResolveMessagingRecipients.mockReset().mockResolvedValue([]);
    mockEnqueueBackgroundJob.mockReset().mockImplementation(async (_tenant, _userId, job) => job);
    mockGetUserBackgroundJob.mockReset().mockResolvedValue(null);
    mockGetUserBackgroundJobPayload.mockReset().mockResolvedValue(null);
    mockRecordAudit.mockReset().mockResolvedValue(undefined);
    mockGetUserColumnPreferencesForModule.mockReset().mockResolvedValue([]);
    mockSetUserColumnPreferencesForModule.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/messaging/templates requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/templates",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/messaging/recipients requires auth", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/recipients?role=students",
      headers: { host: "demo.localhost" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /api/messaging/recipients allows teacher with messaging.read", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/recipients?role=students&page=1&pageSize=25&hasPhone=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadMessagingRecipients).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        role: "students",
        page: 1,
        pageSize: 25,
        hasPhone: true,
      }),
    );
    await app.close();
  });

  it("GET /api/messaging/recipients/match returns lean recipients for messaging.read", async () => {
    mockMatchMessagingRecipients.mockResolvedValueOnce({
      recipients: [{ id: "c1", name: "Ali", phone: "+100", email: "" }],
      total: 1,
      truncated: false,
      limit: 10_000,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/recipients/match?role=students&kind=phone",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockMatchMessagingRecipients).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        role: "students",
        kind: "phone",
      }),
    );
    expect(res.json()).toEqual({
      recipients: [{ id: "c1", name: "Ali", phone: "+100", email: "" }],
      total: 1,
      truncated: false,
      limit: 10_000,
    });
    await app.close();
  });

  it("POST /api/messaging/contacts/resolve allows teacher with messaging.read", async () => {
    mockResolveMessagingRecipients.mockResolvedValueOnce([
      { id: "c1", name: "Ali", phone: "", email: "" },
    ]);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/contacts/resolve",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
      payload: { ids: ["c1"] },
    });
    expect(res.statusCode).toBe(200);
    expect(mockResolveMessagingRecipients).toHaveBeenCalledWith("demo", ["c1"]);
    expect(res.json()).toEqual({
      recipients: [{ id: "c1", name: "Ali", phone: "", email: "" }],
    });
    await app.close();
  });

  it("POST /api/messaging/contacts/resolve allows accountant with messaging.read", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/contacts/resolve",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "accountant", name: "accountant" })}`,
      },
      payload: { ids: ["c1"] },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("GET /api/messaging/templates allows teacher with messaging.read", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ templates: [] });
    await app.close();
  });

  it("POST /api/messaging/templates denies accountant without messaging.write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "accountant", name: "accountant" })}`,
      },
      payload: { label: "Hi", body: "Hello {name}" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("DELETE /api/messaging/logs denies teacher without messaging.clearLogs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockClearAllMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("DELETE /api/messaging/logs allows admin with messaging.clearLogs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockClearAllMessageLogs).toHaveBeenCalledWith("demo");
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "messaging.logs.clear",
        entityId: "message_logs",
      }),
    );
    await app.close();
  });

  it("POST /api/messaging/logs/restore denies teacher without messaging.restoreLogs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
      payload: { ids: ["log-1"] },
    });
    expect(res.statusCode).toBe(403);
    expect(mockRestoreMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/logs/restore restores archived logs for admin with messaging.restoreLogs", async () => {
    mockRestoreMessageLogs.mockResolvedValueOnce(3);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: { ids: ["log-1", "log-2", "log-3"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ restored: 3 });
    expect(mockRestoreMessageLogs).toHaveBeenCalledWith("demo", "u-admin", [
      "log-1",
      "log-2",
      "log-3",
    ]);
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "messaging.logs.restore",
        entityId: "message_logs",
      }),
    );
    await app.close();
  });

  it("POST /api/messaging/logs/restore restores ALL archived logs when body is absent", async () => {
    mockRestoreMessageLogs.mockResolvedValueOnce(5);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ restored: 5 });
    expect(mockRestoreMessageLogs).toHaveBeenCalledWith("demo", "u-admin", undefined);
    await app.close();
  });

  it("POST /api/messaging/logs/restore forwards empty ids verbatim (use-case maps them to restore-all)", async () => {
    mockRestoreMessageLogs.mockResolvedValueOnce(2);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: { ids: ["  ", ""] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ restored: 2 });
    expect(mockRestoreMessageLogs).toHaveBeenCalledWith("demo", "u-admin", ["  ", ""]);
    await app.close();
  });

  it("POST /api/messaging/logs/restore skips audit when nothing was archived", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: { ids: ["log-1"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ restored: 0 });
    expect(mockRecordAudit).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/messaging/logs?includeDeleted denies teacher without messaging.clearLogs", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/logs?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadFilteredMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/messaging/logs?includeDeleted allows admin with messaging.clearLogs", async () => {
    mockLoadFilteredMessageLogs.mockResolvedValueOnce({
      logs: [
        { id: "archived1", channel: "sms", status: "sent", deletedAt: "2026-01-01T00:00:00.000Z" },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/logs?includeDeleted=true",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadFilteredMessageLogs).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ includeDeleted: true }),
    );
    await app.close();
  });

  it("GET /api/messaging/logs rejects invalid query", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/logs?page=not-a-number",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("POST /api/messaging/templates creates with UUID id and tenant", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        label: "Fee Reminder",
        body: "Hello {name}",
        category: "financial",
        channel: "sms",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockSaveMessageTemplate).toHaveBeenCalledTimes(1);
    const [tenant, template] = mockSaveMessageTemplate.mock.calls[0] as [
      string,
      { id: string; label: string; body: string; category: string; channel: string },
    ];
    expect(tenant).toBe("demo");
    expect(template.id).toMatch(/^custom_[0-9a-f-]{36}$/i);
    expect(template.label).toBe("Fee Reminder");
    expect(template.category).toBe("financial");
    expect(res.json().template.id).toBe(template.id);
    await app.close();
  });

  it("POST /api/messaging/templates rejects overwriting system template ids", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: { id: "t1", label: "Hijacked", body: "Hello {name}" },
    });
    expect(res.statusCode).toBe(400);
    expect(mockSaveMessageTemplate).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/templates updates existing custom templates only", async () => {
    mockFindMessageTemplateById.mockResolvedValueOnce({
      id: "custom_existing",
      label: "Old",
      body: "Old body",
      category: "general",
      channel: "all",
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        id: "custom_existing",
        label: "Updated",
        body: "New body",
        category: "financial",
        channel: "sms",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockFindMessageTemplateById).toHaveBeenCalledWith("demo", "custom_existing");
    expect(mockSaveMessageTemplate).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "custom_existing", label: "Updated", body: "New body" }),
    );
    await app.close();
  });

  it("DELETE /api/messaging/templates/:id allows admin with messaging.write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/messaging/templates/custom_abc",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRemoveMessageTemplate).toHaveBeenCalledWith("demo", "custom_abc");
    await app.close();
  });

  it("DELETE /api/messaging/templates/:id rejects system template ids", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/messaging/templates/t1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(mockRemoveMessageTemplate).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/messaging/logs allows teacher with messaging.read", async () => {
    mockLoadFilteredMessageLogs.mockResolvedValueOnce({
      logs: [{ id: "log1", channel: "sms", status: "sent" }],
      total: 1,
      page: 1,
      pageSize: 25,
      hasMore: false,
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/logs?page=1&pageSize=25&channel=sms",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockLoadFilteredMessageLogs).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ page: 1, pageSize: 25, channel: "sms" }),
    );
    expect(res.json()).toEqual({
      logs: [{ id: "log1", channel: "sms", status: "sent" }],
      total: 1,
      page: 1,
      pageSize: 25,
      hasMore: false,
    });
    await app.close();
  });

  it("GET /api/messaging/metrics allows teacher with messaging.read", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockComputeMessagingMetrics).toHaveBeenCalledWith("demo", {
      startDate: undefined,
      endDate: undefined,
    });
    expect(res.json()).toEqual({
      metrics: expect.objectContaining({ total: 0, smsCount: 0 }),
    });
    await app.close();
  });

  it("GET /api/messaging/metrics forwards startDate and endDate", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/metrics?startDate=2026-01-01&endDate=2026-01-31T23:59:59.999Z",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockComputeMessagingMetrics).toHaveBeenCalledWith("demo", {
      startDate: "2026-01-01",
      endDate: "2026-01-31T23:59:59.999Z",
    });
    await app.close();
  });

  it("POST /api/messaging/templates rejects invalid body", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: { label: "", body: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(mockSaveMessageTemplate).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/templates rejects unknown personalization tokens", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        label: "Bad tokens",
        body: "Hello {name} and {not_a_real_token}",
        category: "general",
        channel: "sms",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("{not_a_real_token}");
    expect(mockSaveMessageTemplate).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/logs denies accountant without messaging.write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "accountant", name: "accountant" })}`,
      },
      payload: {
        logs: [{ contactId: "c1", channel: "sms", body: "Assalamu Alaikum" }],
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockRecordMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/messaging/logs denies viewer without messaging.read", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "viewer", name: "viewer" })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadFilteredMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/messaging/metrics denies viewer without messaging.read", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/metrics",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "viewer", name: "viewer" })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockComputeMessagingMetrics).not.toHaveBeenCalled();
    await app.close();
  });

  it("GET /api/messaging/templates denies viewer without messaging.read", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/messaging/templates",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "viewer", name: "viewer" })}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(mockLoadMessageTemplates).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/logs rejects client audit fields via strict schema", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        logs: [
          {
            id: "msg-1",
            userId: "forged-user",
            contactId: "c1",
            channel: "sms",
            body: "Assalamu Alaikum",
            sentAt: "2026-01-01T00:00:00.000Z",
            status: "sent",
            deletedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(mockRecordMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/logs rejects unknown personalization tokens", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        logs: [{ contactId: "c1", channel: "sms", body: "Hi {bogus_token}" }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("{bogus_token}");
    expect(mockRecordMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/logs forces server id, userId, and sentAt", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        logs: [
          {
            contactId: "c1",
            channel: "sms",
            body: "Assalamu Alaikum",
            status: "sent",
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ recorded: 1 });
    expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
    const [tenant, logs] = mockRecordMessageLogs.mock.calls[0] as [
      string,
      Array<{ userId: string; deletedAt?: string; id: string; sentAt: string }>,
    ];
    expect(tenant).toBe("demo");
    expect(logs[0].userId).toBe("u-admin");
    expect(logs[0].deletedAt).toBeUndefined();
    expect(logs[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(typeof logs[0].sentAt).toBe("string");
    expect(logs[0].sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await app.close();
  });

  it("POST /api/messaging/logs replays idempotent responses without re-recording", async () => {
    const {
      findAuthArtifactByLookupKey,
      tryClaimAuthArtifactByLookupKey,
      updateAuthArtifactPayload,
    } = await import("../services/auth/authArtifactService.js");
    vi.mocked(findAuthArtifactByLookupKey).mockResolvedValueOnce(null);
    vi.mocked(tryClaimAuthArtifactByLookupKey).mockResolvedValue({ claimed: true, id: "art-1" });
    vi.mocked(updateAuthArtifactPayload).mockResolvedValue(undefined);

    const app = await buildApp();
    const headers = {
      host: "demo.localhost",
      authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      "idempotency-key": "dispatch-batch-001",
    };
    const payload = {
      logs: [
        {
          contactId: "c1",
          channel: "sms" as const,
          body: "Assalamu Alaikum",
          status: "sent" as const,
        },
      ],
      idempotencyKey: "dispatch-batch-001",
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/messaging/logs",
      headers,
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ recorded: 1 });
    expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
    expect(tryClaimAuthArtifactByLookupKey).toHaveBeenCalled();
    const claimedPayload = vi.mocked(tryClaimAuthArtifactByLookupKey).mock.calls[0]?.[1] as {
      bodyDigest: string;
    };
    const bodyDigest = claimedPayload.bodyDigest;
    expect(bodyDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(updateAuthArtifactPayload).toHaveBeenCalledWith(
      "art-1",
      expect.objectContaining({ recorded: 1, bodyDigest }),
    );

    vi.mocked(findAuthArtifactByLookupKey).mockResolvedValueOnce({
      id: "art-1",
      kind: "messaging_idempotency",
      payload: { recorded: 1, bodyDigest },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const second = await app.inject({
      method: "POST",
      url: "/api/messaging/logs",
      headers,
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ recorded: 1 });
    expect(mockRecordMessageLogs).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("POST /api/messaging/logs returns 409 when idempotency key is reused with a different body", async () => {
    const { findAuthArtifactByLookupKey } = await import("../services/auth/authArtifactService.js");
    vi.mocked(findAuthArtifactByLookupKey).mockResolvedValueOnce({
      id: "art-mismatch",
      kind: "messaging_idempotency",
      payload: {
        recorded: 1,
        bodyDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      expiresAt: new Date(Date.now() + 60_000),
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/logs",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
        "idempotency-key": "dispatch-batch-mismatch",
      },
      payload: {
        logs: [
          {
            contactId: "c1",
            channel: "sms" as const,
            body: "Different body",
            status: "sent" as const,
          },
        ],
        idempotencyKey: "dispatch-batch-mismatch",
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      type: "conflict",
      message: "Idempotency key reused with a different request body",
    });
    expect(mockRecordMessageLogs).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/export/csv queues export for admin with messaging.write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        label: "Message logs CSV",
        filename: "message_history.csv",
        query: {
          channel: "sms",
          status: "sent",
          startDate: "2026-01-01",
          endDate: "2026-01-31T23:59:59.999Z",
        },
      },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      "demo",
      expect.any(String),
      expect.objectContaining({ moduleId: "messaging", kind: "export", label: "Message logs CSV" }),
      expect.objectContaining({
        filename: "message_history.csv",
        label: "Message logs CSV",
        query: {
          channel: "sms",
          status: "sent",
          startDate: "2026-01-01",
          endDate: "2026-01-31T23:59:59.999Z",
        },
      }),
    );
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "messaging.export.queue",
        entityId: expect.any(String),
      }),
    );
    await app.close();
  });

  it("POST /api/messaging/export/csv returns 409 when idempotency key is reused with a different body", async () => {
    mockGetUserBackgroundJob.mockResolvedValueOnce({
      id: "export-key-1",
      moduleId: "messaging",
      kind: "export",
      status: "completed",
      label: "Prior export",
      createdAt: new Date().toISOString(),
    });
    mockGetUserBackgroundJobPayload.mockResolvedValueOnce({
      bodyDigest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      query: { channel: "email" },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        idempotencyKey: "export-key-1",
        label: "Different export",
        query: { channel: "sms" },
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      type: "conflict",
      message: "Idempotency key reused with a different export body",
    });
    expect(mockEnqueueBackgroundJob).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/export/csv returns 409 when idempotency key exists without bodyDigest", async () => {
    mockGetUserBackgroundJob.mockResolvedValueOnce({
      id: "export-key-no-digest",
      moduleId: "messaging",
      kind: "export",
      status: "completed",
      label: "Prior export",
      createdAt: new Date().toISOString(),
    });
    mockGetUserBackgroundJobPayload.mockResolvedValueOnce({
      query: { channel: "sms" },
    });
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "admin", name: "admin" })}`,
      },
      payload: {
        idempotencyKey: "export-key-no-digest",
        label: "Retry export",
        query: { channel: "sms" },
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      type: "conflict",
      message: "Idempotency key reused with a different export body",
    });
    expect(mockEnqueueBackgroundJob).not.toHaveBeenCalled();
    await app.close();
  });

  it("POST /api/messaging/export/csv queues export for teacher with messaging.write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "teacher", name: "teacher" })}`,
      },
      payload: { label: "Teacher export" },
    });
    expect(res.statusCode).toBe(202);
    expect(mockEnqueueBackgroundJob).toHaveBeenCalledWith(
      "demo",
      expect.any(String),
      expect.objectContaining({ moduleId: "messaging", kind: "export" }),
      expect.objectContaining({ label: "Teacher export" }),
    );
    await app.close();
  });

  it("POST /api/messaging/export/csv denies accountant without messaging.write", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/messaging/export/csv",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${signTenantToken(app, { role: "accountant", name: "accountant" })}`,
      },
      payload: { label: "Denied export" },
    });
    expect(res.statusCode).toBe(403);
    expect(mockEnqueueBackgroundJob).not.toHaveBeenCalled();
    await app.close();
  });

  it("document-store disallowlists typed messaging collections", () => {
    expect(isAllowedCollectionName("message_logs")).toBe(false);
    expect(isAllowedCollectionName("message_templates")).toBe(false);
    expect(isAllowedCollectionName("messages_u:x")).toBe(false);
    expect(isAllowedCollectionName("whatsappTemplates")).toBe(false);
    expect(isAllowedCollectionName("whatsappTemplates_u:x")).toBe(false);
  });
});
