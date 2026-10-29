import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { parseImageUploadPurpose, resolveUploadsRoot } from "../../config/uploadConfig.js";
import { authenticateUploader } from "../../middleware/authenticateUploader.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { saveUploadedImage } from "../../services/imageAssetService.js";
import { replyValidationError } from "../../lib/zodRequest.js";
import { sendForbidden } from "../../lib/httpErrors.js";

interface UploadLogContext {
  id: string;
  log: { error: (obj: Record<string, unknown>, message: string) => void };
}

/**
 * Normalises an upload-handler failure.
 *
 * 4xx domain errors (size, mime, validation) keep their actionable message.
 * 5xx errors (ENOSPC, EACCES, filesystem paths) are logged server-side and
 * replaced with the same generic message + request id used by the global error
 * handler — this was the one place that echoed raw infrastructure detail.
 */
export function buildUploadErrorResponse(
  request: UploadLogContext,
  error: unknown,
  fallbackMessage: string,
): { statusCode: number; body: Record<string, unknown> } {
  const err = error as Error & { statusCode?: number; type?: string };
  const statusCode = err.statusCode ?? 500;

  if (statusCode >= 500) {
    request.log.error({ err, requestId: request.id }, "upload handler failed");
    return {
      statusCode,
      body: {
        type: "server_error",
        message: `Internal server error. Reference: ${request.id}`,
        requestId: request.id,
      },
    };
  }

  return {
    statusCode,
    body: {
      type: err.type ?? (statusCode === 400 ? "validation_error" : "server_error"),
      message: err.message || fallbackMessage,
    },
  };
}

export default async function uploadRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
      parts: 4,
      fieldSize: 1 * 1024 * 1024,
    },
  });

  fastify.post<{ Querystring: { purpose?: string } }>(
    "/image",
    { preHandler: authenticateUploader },
    async (request, reply) => {
      try {
        const purpose = parseImageUploadPurpose(request.query.purpose);
        const file = await request.file();
        if (!file) {
          return replyValidationError(reply, "Image file is required");
        }

        const tenant = getRequestTenant();
        const url = await saveUploadedImage(file.file, file.mimetype, purpose, tenant);
        return reply.send({ url, purpose });
      } catch (error: unknown) {
        const { statusCode, body } = buildUploadErrorResponse(
          request,
          error,
          "Failed to upload image",
        );
        return reply.status(statusCode).send(body);
      }
    },
  );

  fastify.post("/attachment", { preHandler: authenticateUploader }, async (request, reply) => {
    let filepath: string | undefined;
    try {
      // Attachments are always tenant data. A root-level `/uploads/attachments/`
      // file has no tenant segment and would be readable by every authenticated
      // workspace, so creation without a bound tenant is rejected outright.
      const tenant = getRequestTenant()?.trim().toLowerCase();
      if (!tenant) {
        return sendForbidden(reply, "Tenant context is required for attachments");
      }

      const file = await request.file();
      if (!file) {
        return replyValidationError(reply, "File is required");
      }

      const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
      const root = resolveUploadsRoot();
      const dir = join(root, "tenants", tenant, "attachments");
      await mkdir(dir, { recursive: true });

      // Sanitize filename to prevent directory traversal
      const safeName = file.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${randomUUID()}-${safeName}`;
      filepath = join(dir, filename);

      let bytesWritten = 0;
      let exceeded = false;
      const sizeLimiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytesWritten += chunk.length;
          if (bytesWritten > MAX_ATTACHMENT_SIZE) {
            exceeded = true;
            callback(new Error("File size exceeds limit of 10 MB"));
            return;
          }
          callback(null, chunk);
        },
      });

      try {
        await pipeline(file.file, sizeLimiter, createWriteStream(filepath));
      } catch (pipeErr) {
        await unlink(filepath).catch(() => {});
        if (
          exceeded ||
          (pipeErr as Error)?.message?.includes("exceeds limit") ||
          file.file.truncated
        ) {
          return replyValidationError(reply, "File size exceeds limit of 10 MB");
        }
        throw pipeErr;
      }

      if (file.file.truncated) {
        await unlink(filepath).catch(() => {});
        return replyValidationError(reply, "File size exceeds limit of 10 MB");
      }

      const url = `/uploads/tenants/${tenant}/attachments/${filename}`;
      return reply.send({
        url,
        name: file.filename,
        type: file.mimetype,
        size: bytesWritten,
      });
    } catch (error: unknown) {
      if (filepath) {
        await unlink(filepath).catch(() => {});
      }
      const { statusCode, body } = buildUploadErrorResponse(
        request,
        error,
        "Failed to upload attachment",
      );
      return reply.status(statusCode).send(body);
    }
  });
}
