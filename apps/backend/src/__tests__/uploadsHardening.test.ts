import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

describe("image upload multipart route", () => {
  const boundary = "----mms-image-test";

  function multipartBody(bytes: Buffer, filename: string, mime: string): Buffer {
    return Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
  }

  async function register() {
    const app = fastify({ logger: false });
    app.addHook("onRequest", async () => {
      bindRequestTenant("demo");
    });
    await app.register(uploadRoutes, { prefix: "/api/uploads" });
    return app;
  }

  it("accepts a WebP image part and stores it under the tenant avatar directory", async () => {
    const temp = await mkdtemp(join(tmpdir(), "mms-image-route-"));
    vi.stubEnv("MMS_UPLOADS_DIR", temp);
    const app = await register();
    try {
      vi.mocked(authenticateUploader).mockResolvedValue(undefined);
      const webp = Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "latin1");
      const body = multipartBody(webp, "avatar.webp", "image/webp");
      const res = await app.inject({
        method: "POST",
        url: "/api/uploads/image?purpose=avatar",
        headers: {
          host: "demo.localhost",
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": String(body.length),
        },
        payload: body,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        url: expect.stringMatching(/^\/uploads\/tenants\/demo\/avatars\/[0-9a-f-]+\.webp$/),
      });
    } finally {
      await app.close();
      vi.unstubAllEnvs();
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("rejects a PNG part with the AVIF/WebP validation message", async () => {
    const temp = await mkdtemp(join(tmpdir(), "mms-image-route-"));
    vi.stubEnv("MMS_UPLOADS_DIR", temp);
    const app = await register();
    try {
      vi.mocked(authenticateUploader).mockResolvedValue(undefined);
      const png = Buffer.from("\x89PNG\r\n\x1a\n", "latin1");
      const body = multipartBody(png, "avatar.png", "image/png");
      const res = await app.inject({
        method: "POST",
        url: "/api/uploads/image?purpose=avatar",
        headers: {
          host: "demo.localhost",
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": String(body.length),
        },
        payload: body,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ message: expect.stringContaining("AVIF or WebP") });
    } finally {
      await app.close();
      vi.unstubAllEnvs();
      await rm(temp, { recursive: true, force: true });
    }
  });
});
