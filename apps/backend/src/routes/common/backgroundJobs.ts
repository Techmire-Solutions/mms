import { Readable } from "node:stream";
import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import type { User } from "@mms/shared";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendDatabaseError, sendNotFound } from "../../lib/httpErrors.js";
import { resourceIdParamsSchema, backgroundJobUpsertSchema } from "@mms/shared";
import {
  clearFinishedUserBackgroundJobs,
  dismissUserBackgroundJob,
  listUserBackgroundJobs,
  upsertUserBackgroundJob,
} from "../../services/backgroundJobService.js";
import {
  deleteExportArtifact,
  deleteExportArtifacts,
  getExportArtifact,
} from "../../services/exportArtifactService.js";
import { getUserBackgroundJob } from "../../services/backgroundJobWorkerService.js";
import { readStreamFromStorage } from "../../config/storage.js";
import { enforceModuleAccess } from "../../middleware/requireTenantModule.js";
import { buildContentDisposition } from "../../lib/contentDisposition.js";

export default async function backgroundJobRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);

  fastify.get("/", async (request, reply) => {
    const user = request.user as User;
    try {
      const jobs = await listUserBackgroundJobs(String(user.id));
      return reply.send({ jobs });
    } catch {
      return sendDatabaseError(reply, "Failed to list background jobs");
    }
  });

  fastify.get("/:id/download", async (request, reply) => {
    const user = request.user as User;
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    // Artifacts hold module data: re-check the owning module before serving.
    let job: Awaited<ReturnType<typeof getUserBackgroundJob>>;
    try {
      job = await getUserBackgroundJob(String(user.id), params.data.id);
    } catch {
      return sendDatabaseError(reply, "Failed to download export");
    }
    if (!job) return sendNotFound(reply, "Export file not found or expired");
    if (!(await enforceModuleAccess(request, reply, job.moduleId, "export"))) return;
    let stream: NodeJS.ReadableStream;
    let contentType: string;
    try {
      const artifact = await getExportArtifact(String(user.id), params.data.id);
      if (!artifact) {
        return sendNotFound(reply, "Export file not found or expired");
      }

      // Streamed (keyed) artifacts are served straight from blob storage without
      // re-buffering the file in memory; legacy artifacts send the stored string.
      if (artifact.key && artifact.storageType) {
        stream = await readStreamFromStorage(artifact.key, artifact.storageType);
        const defaultType = artifact.filename.toLowerCase().endsWith(".vcf")
          ? "text/vcard; charset=utf-8"
          : "text/csv; charset=utf-8";
        contentType = artifact.contentType || defaultType;
      } else {
        stream = Readable.from([artifact.content ?? ""]);
        contentType = artifact.filename.toLowerCase().endsWith(".vcf")
          ? "text/vcard; charset=utf-8"
          : "text/csv; charset=utf-8";
      }

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", buildContentDisposition(artifact.filename));
      return reply.send(stream);
    } catch {
      return sendDatabaseError(reply, "Failed to download export");
    }
  });

  fastify.get("/:id", async (request, reply) => {
    const user = request.user as User;
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const job = await getUserBackgroundJob(String(user.id), params.data.id);
      if (!job) {
        return sendNotFound(reply, "Job not found");
      }
      return reply.send({ job });
    } catch {
      return sendDatabaseError(reply, "Failed to load background job");
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const user = request.user as User;
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const parsed = parseRequest(backgroundJobUpsertSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    if (parsed.data.id !== params.data.id) {
      return replyValidationError(reply, "Job id mismatch");
    }
    try {
      const job = await upsertUserBackgroundJob(String(user.id), parsed.data);
      return reply.send({ job });
    } catch {
      return sendDatabaseError(reply, "Failed to save background job");
    }
  });

  fastify.delete("/:id", async (request, reply) => {
    const user = request.user as User;
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const ownerId = await dismissUserBackgroundJob(String(user.id), params.data.id);
      if (!ownerId) {
        return sendNotFound(reply, "Job not found");
      }
      await deleteExportArtifact(ownerId, params.data.id);
      return reply.send({ success: true });
    } catch {
      return sendDatabaseError(reply, "Failed to dismiss background job");
    }
  });

  fastify.post("/clear-finished", async (request, reply) => {
    const user = request.user as User;
    try {
      const removedIds = await clearFinishedUserBackgroundJobs(String(user.id));
      await deleteExportArtifacts(String(user.id), removedIds);
      return reply.send({ success: true, removed: removedIds.length });
    } catch {
      return sendDatabaseError(reply, "Failed to clear background jobs");
    }
  });
}
