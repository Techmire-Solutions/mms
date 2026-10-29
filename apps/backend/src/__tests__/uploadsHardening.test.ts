import { describe, expect, it, vi } from "vitest";
import fastify from "fastify";

vi.mock("../middleware/authenticateUploader.js", () => ({
  authenticateUploader: vi.fn().mockResolvedValue(undefined),
}));

import uploadRoutes, { buildUploadErrorResponse } from "../routes/common/uploads.js";

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

describe("attachment tenant scoping (F39)", () => {
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
