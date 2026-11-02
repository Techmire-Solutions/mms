import { describe, expect, it, vi } from "vitest";
import fastify from "fastify";

vi.mock("../middleware/authenticateUploader.js", () => ({
  authenticateUploader: vi.fn().mockResolvedValue(undefined),
}));

import uploadRoutes, {
  buildUploadErrorResponse,
  canUploadAttachments,
} from "../routes/common/uploads.js";
import { authenticateUploader } from "../middleware/authenticateUploader.js";
import { bindRequestTenant } from "../lib/tenantContext.js";

const mockResolveAttachmentPath = vi.hoisted(() => vi.fn());
const mockIsAttachmentReferenced = vi.hoisted(() => vi.fn());
const mockDeleteTenantAttachment = vi.hoisted(() => vi.fn());

vi.mock("../services/attachmentStorageService.js", () => ({
  resolveTenantAttachmentPath: mockResolveAttachmentPath,
  isAttachmentReferenced: mockIsAttachmentReferenced,
  deleteTenantAttachment: mockDeleteTenantAttachment,
}));

const logContext = () => {
  const error = vi.fn();
  return { error, request: { id: "req-123", log: { error } } };
};

describe("upload handler error masking (F40)", () => {
  it("replaces 5xx detail with a generic message and request reference", () => {
    const { error, request } = logContext();
    const failure = Object.assign(
      new Error("ENOSPC: no space left on device, write /srv/mms/uploads/tenants/demo/x.pdf"),
      { statusCode: 500 },
    );

    const result = buildUploadErrorResponse(request, failure, "Failed to upload attachment");

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      type: "server_error",
      message: "Internal server error. Reference: req-123",
      requestId: "req-123",
    });
    expect(String(result.body.message)).not.toContain("ENOSPC");
    expect(String(result.body.message)).not.toContain("/srv/");
    // The full cause is still logged server-side for operators.
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("keeps 4xx domain messages intact", () => {
    const { request } = logContext();
    const failure = Object.assign(new Error("File size exceeds limit of 10 MB"), {
      statusCode: 400,
      type: "validation_error",
    });

    const result = buildUploadErrorResponse(request, failure, "Failed to upload attachment");

    expect(result).toEqual({
      statusCode: 400,
      body: {
        type: "validation_error",
        message: "File size exceeds limit of 10 MB",
      },
    });
  });
});

describe("attachment upload permission (B-02)", () => {
  it("requires contacts.write on the uploading user", () => {
    expect(canUploadAttachments({ role: "admin" } as never)).toBe(true);
    expect(canUploadAttachments({ role: "registrar" } as never)).toBe(true);
    expect(canUploadAttachments({ role: "teacher" } as never)).toBe(false);
    expect(canUploadAttachments({ role: "accountant" } as never)).toBe(false);
    expect(canUploadAttachments({ role: "viewer" } as never)).toBe(false);
  });
});

describe("attachment delete route (B-03)", () => {
  const register = async () => {
    const app = fastify({ logger: false });
    app.addHook("onRequest", async () => {
      bindRequestTenant("demo");
    });
    await app.register(uploadRoutes, { prefix: "/api/uploads" });
    return app;
  };

  const injectDelete = (app: Awaited<ReturnType<typeof register>>, url = "a.pdf") =>
    app.inject({
      method: "POST",
      url: "/api/uploads/attachment/delete",
      headers: { host: "demo.localhost" },
      payload: { url: `/uploads/tenants/demo/attachments/${url}` },
    });

  it("forbids a user without contacts.write", async () => {
    vi.mocked(authenticateUploader).mockImplementation(async (request) => {
      (request as { user?: unknown }).user = { role: "teacher" };
    });
    const app = await register();
    const res = await injectDelete(app);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ type: "forbidden", message: "Insufficient permissions" });
    await app.close();
  });

  it("rejects an invalid attachment URL", async () => {
    vi.mocked(authenticateUploader).mockImplementation(async (request) => {
      (request as { user?: unknown }).user = { role: "admin" };
    });
    mockResolveAttachmentPath.mockReturnValueOnce(null);
    const app = await register();
    const res = await injectDelete(app);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      type: "validation_error",
      message: "Invalid attachment URL",
    });
    await app.close();
  });

  it("skips a file that is still referenced by a contact row", async () => {
    vi.mocked(authenticateUploader).mockImplementation(async (request) => {
      (request as { user?: unknown }).user = { role: "admin" };
    });
    mockResolveAttachmentPath.mockReturnValueOnce("/tmp/a.pdf");
    mockIsAttachmentReferenced.mockResolvedValueOnce(true);
    const app = await register();
    const res = await injectDelete(app);
    expect(res.json()).toEqual({ deleted: false, reason: "referenced" });
    expect(mockDeleteTenantAttachment).not.toHaveBeenCalled();
    await app.close();
  });

  it("unlinks an unreferenced file and reports a missing file as not deleted", async () => {
    vi.mocked(authenticateUploader).mockImplementation(async (request) => {
      (request as { user?: unknown }).user = { role: "admin" };
    });
    mockResolveAttachmentPath.mockReturnValue("/tmp/a.pdf");
    mockIsAttachmentReferenced.mockResolvedValue(false);
    mockDeleteTenantAttachment.mockResolvedValueOnce(true);
    const app = await register();

    const res = await injectDelete(app);
    expect(res.json()).toEqual({ deleted: true });

    mockDeleteTenantAttachment.mockResolvedValueOnce(false);
    const missing = await injectDelete(app);
    expect(missing.json()).toEqual({ deleted: false });
    await app.close();
  });
});

describe("attachment tenant scoping (F39)", () => {
  it("rejects /api/uploads/attachment/delete when no tenant is bound", async () => {
    const app = fastify({ logger: false });
    await app.register(uploadRoutes, { prefix: "/api/uploads" });

    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/attachment/delete",
      headers: { host: "localhost" },
      payload: { url: "/uploads/tenants/demo/attachments/a.pdf" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      type: "forbidden",
      message: "Tenant context is required for attachments",
    });
    await app.close();
  });

  it("rejects /api/uploads/attachment when no tenant is bound", async () => {
    const app = fastify({ logger: false });
    await app.register(uploadRoutes, { prefix: "/api/uploads" });

    const res = await app.inject({
      method: "POST",
      url: "/api/uploads/attachment",
      headers: { host: "localhost" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      type: "forbidden",
      message: "Tenant context is required for attachments",
    });
    await app.close();
  });
});
