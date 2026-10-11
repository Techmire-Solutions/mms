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

export default async function uploadRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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
        const err = error as Error & { statusCode?: number; type?: string };
        const statusCode = err.statusCode ?? 500;
        return reply.status(statusCode).send({
          type: err.type ?? (statusCode === 400 ? "validation_error" : "server_error"),
          message: err.message || "Failed to upload image",
        });
      }
    },
  );

  fastify.post("/attachment", { preHandler: authenticateUploader }, async (request, reply) => {
    let filepath: string | undefined;
    try {
      const file = await request.file();
      if (!file) {
        return replyValidationError(reply, "File is required");
      }

      const tenant = getRequestTenant()?.trim().toLowerCase();
      const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
      const root = resolveUploadsRoot();
      const dir = tenant ? join(root, "tenants", tenant, "attachments") : join(root, "attachments");
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

      const url = tenant
        ? `/uploads/tenants/${tenant}/attachments/${filename}`
        : `/uploads/attachments/${filename}`;
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
      const err = error as Error & { statusCode?: number; type?: string };
      const statusCode = err.statusCode ?? 500;
      return reply.status(statusCode).send({
        type: err.type ?? (statusCode === 400 ? "validation_error" : "server_error"),
        message: err.message || "Failed to upload attachment",
      });
    }
  });
}
