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

// In-memory test storage for templates
const mockTemplates = new Map<string, DocumentTemplate>();

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
    async (tenant: string, key: string, template: DocumentTemplate) => {
      mockTemplates.set(`${tenant}:${key}`, template);
      return template;
    },
  ),
  deleteDocumentTemplateRepo: vi.fn(async (tenant: string, key: string) => {
    return mockTemplates.delete(`${tenant}:${key}`);
  }),
  listDocumentTemplatesRepo: vi.fn(async (tenant: string) => {
    const results: Array<{ key: string; template: DocumentTemplate; updatedAt: Date }> = [];
    for (const [composite, template] of mockTemplates.entries()) {
      const [t, k] = composite.split(":");
      if (t === tenant) {
        results.push({ key: k, template, updatedAt: new Date() });
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

describe("documentTemplatesContractRouter", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
  });

  beforeEach(() => {
    mockTemplates.clear();
  });

  it("returns null template when none is stored", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const res = await app.inject({
      method: "GET",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.template).toBeNull();
  });

  it("saves a valid template and returns 200", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const res = await app.inject({
      method: "PUT",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
      payload: {
        template: sampleTemplate,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.template).toEqual(sampleTemplate);

    // Verify GET now returns the saved template
    const getRes = await app.inject({
      method: "GET",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
    });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body).template).toEqual(sampleTemplate);
  });

  it("rejects invalid template payload with 400", async () => {
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });
    const res = await app.inject({
      method: "PUT",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
      payload: {
        template: {
          pageSize: "A6",
          elements: "invalid",
        },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("deletes a saved template and returns success: true", async () => {
    mockTemplates.set("demo:test_receipt_template", sampleTemplate);
    const token = adminToken(app, { email: "admin@demo.test", name: "Admin" });

    const deleteRes = await app.inject({
      method: "DELETE",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(JSON.parse(deleteRes.body).success).toBe(true);

    // Verify GET now returns null
    const getRes = await app.inject({
      method: "GET",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
    });
    expect(JSON.parse(getRes.body).template).toBeNull();
  });

  it("rejects non-staff user from modifying template with 403", async () => {
    const nonStaffToken = viewerToken(app, { email: "viewer@demo.test", name: "Viewer" });
    const res = await app.inject({
      method: "PUT",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(nonStaffToken),
      payload: {
        template: sampleTemplate,
      },
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
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
      payload: { template: sampleTemplate },
    });

    expect(res.statusCode).toBe(403);
    expect(mockTemplates.size).toBe(0);
  });

  it("rejects a teacher from deleting a template with 403", async () => {
    mockTemplates.set("demo:test_receipt_template", sampleTemplate);
    const token = teacherToken(app, { email: "teacher@demo.test", name: "Teacher" });

    const res = await app.inject({
      method: "DELETE",
      url: "/api/templates/test_receipt_template",
      headers: authHeaders(token),
    });

    expect(res.statusCode).toBe(403);
    expect(mockTemplates.has("demo:test_receipt_template")).toBe(true);
  });
});
