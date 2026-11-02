import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { DocumentTemplate } from "@mms/shared";
import { buildApp } from "../app.js";
import {
  accountantToken,
  adminToken,
  assistantTeacherToken,
  bearerAuth,
  teacherToken,
  viewerToken,
} from "./helpers/tokens.js";

interface StoredTemplate {
  template: DocumentTemplate;
  updatedAt: Date;
}

// In-memory test storage for templates (records carry the CAS token).
const mockTemplates = new Map<string, StoredTemplate>();
let clock = Date.parse("2026-01-01T00:00:00.000Z");
const nextTimestamp = (): Date => new Date((clock += 1000));

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
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

vi.mock("../db/repositories/documentTemplatesRepository.js", () => ({
  getDocumentTemplateRepo: vi.fn(async (tenant: string, key: string) => {
    return mockTemplates.get(`${tenant}:${key}`) ?? null;
  }),
  upsertDocumentTemplateRepo: vi.fn(
    async (
      tenant: string,
      key: string,
      template: DocumentTemplate,
      expectedUpdatedAt: Date | null,
    ) => {
      const composite = `${tenant}:${key}`;
      const existing = mockTemplates.get(composite);

      if (expectedUpdatedAt === null) {
        if (existing) return null;
        const record = { template, updatedAt: nextTimestamp() };
        mockTemplates.set(composite, record);
        return record;
      }
      if (!existing) return null;
      if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return null;

      const record = { template, updatedAt: nextTimestamp() };
      mockTemplates.set(composite, record);
      return record;
    },
  ),
  deleteDocumentTemplateRepo: vi.fn(async (tenant: string, key: string) => {
    return mockTemplates.delete(`${tenant}:${key}`);
  }),
  listDocumentTemplatesRepo: vi.fn(async (tenant: string) => {
    const results: Array<{ key: string; template: DocumentTemplate; updatedAt: Date }> = [];
    for (const [composite, record] of mockTemplates.entries()) {
      const [t, k] = composite.split(":");
      if (t === tenant) {
        results.push({ key: k, template: record.template, updatedAt: record.updatedAt });
      }
    }
    return results;
  }),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
  broadcastTenantUpdate: vi.fn(),
}));

const sampleTemplate: DocumentTemplate = {
  pageSize: "A6",
  elements: [
    {
      id: "elem-1",
      type: "text",
      label: "Invoice Heading",
      x: 10,
      y: 10,
      w: 100,
      h: 20,
      field: "title",
    },
  ],
};

function authHeaders(token: string): Record<string, string> {
  return { host: "demo.localhost", authorization: bearerAuth(token) };
}

const KEY = "test_receipt_template";
const URL = `/api/templates/${KEY}`;

describe("documentTemplatesContractRouter", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
  });

  beforeEach(() => {
    mockTemplates.clear();
  });

  async function getTemplate(): Promise<{
    template: DocumentTemplate | null;
    updatedAt: string | null;
  }> {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const res = await app.inject({ method: "GET", url: URL, headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body);
  }

  it("returns null template and updatedAt when none is stored", async () => {
    await expect(getTemplate()).resolves.toEqual({ template: null, updatedAt: null });
  });

  it("inserts with expectedUpdatedAt null and returns the new version", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const res = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: sampleTemplate, expectedUpdatedAt: null },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.template).toEqual(sampleTemplate);
    expect(body.updatedAt).toEqual(expect.any(String));

    await expect(getTemplate()).resolves.toEqual({
      template: sampleTemplate,
      updatedAt: body.updatedAt,
    });
  });

  it("updates with the matching version and advances updatedAt", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const first = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: sampleTemplate, expectedUpdatedAt: null },
    });
    const firstBody = JSON.parse(first.body);
    const updatedTemplate = { ...sampleTemplate, pageSize: "A5" };

    const second = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: updatedTemplate, expectedUpdatedAt: firstBody.updatedAt },
    });

    expect(second.statusCode).toBe(200);
    const secondBody = JSON.parse(second.body);
    expect(secondBody.template).toEqual(updatedTemplate);
    expect(secondBody.updatedAt).not.toBe(firstBody.updatedAt);
  });

  it("rejects a stale save with 409 and leaves the stored layout untouched", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const first = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: sampleTemplate, expectedUpdatedAt: null },
    });
    const firstBody = JSON.parse(first.body);

    // Another admin saves first…
    await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: {
        template: { ...sampleTemplate, pageSize: "A4" },
        expectedUpdatedAt: firstBody.updatedAt,
      },
    });

    // …then the first client's stale draft is rejected.
    const stale = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: {
        template: { ...sampleTemplate, pageSize: "80mm" },
        expectedUpdatedAt: firstBody.updatedAt,
      },
    });

    expect(stale.statusCode).toBe(409);
    expect(JSON.parse(stale.body).type).toBe("conflict");
    const stored = await getTemplate();
    expect(stored.template?.pageSize).toBe("A4");
  });

  it("rejects an insert with expectedUpdatedAt null when a row already exists", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: sampleTemplate, expectedUpdatedAt: null },
    });

    const res = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: { ...sampleTemplate, pageSize: "A5" }, expectedUpdatedAt: null },
    });

    expect(res.statusCode).toBe(409);
    await expect(getTemplate()).resolves.toMatchObject({ template: { pageSize: "A6" } });
  });

  it("rejects a missing expectedUpdatedAt with 400", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const res = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: sampleTemplate },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid template payload with 400", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const res = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: {
        template: { pageSize: "A6", elements: "invalid" },
        expectedUpdatedAt: null,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deletes a saved template and returns success: true", async () => {
    mockTemplates.set(`demo:${KEY}`, { template: sampleTemplate, updatedAt: nextTimestamp() });
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });

    const deleteRes = await app.inject({
      method: "DELETE",
      url: URL,
      headers: authHeaders(token),
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(JSON.parse(deleteRes.body).success).toBe(true);
    await expect(getTemplate()).resolves.toEqual({ template: null, updatedAt: null });
  });

  it("rejects non-staff user from modifying template with 403", async () => {
    const nonStaffToken = viewerToken(app, { email: "viewer@demo.test", name: "Viewer" });
    const res = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(nonStaffToken),
      payload: { template: sampleTemplate, expectedUpdatedAt: null },
    });

    expect(res.statusCode).toBe(403);
  });

  it.each([
    ["teacher", teacherToken],
    ["accountant", accountantToken],
    ["assistant teacher", assistantTeacherToken],
  ])("rejects a %s from overwriting a template with 403", async (_label, makeToken) => {
    const token = makeToken(app, { email: "staff@demo.test", name: "Staff" });
    const res = await app.inject({
      method: "PUT",
      url: URL,
      headers: authHeaders(token),
      payload: { template: sampleTemplate, expectedUpdatedAt: null },
    });

    expect(res.statusCode).toBe(403);
    expect(mockTemplates.size).toBe(0);
  });

  it("rejects a teacher from deleting a template with 403", async () => {
    mockTemplates.set(`demo:${KEY}`, { template: sampleTemplate, updatedAt: nextTimestamp() });
    const token = teacherToken(app, { email: "teacher@demo.test", name: "Teacher" });

    const res = await app.inject({
      method: "DELETE",
      url: URL,
      headers: authHeaders(token),
    });

    expect(res.statusCode).toBe(403);
    expect(mockTemplates.has(`demo:${KEY}`)).toBe(true);
  });
});
