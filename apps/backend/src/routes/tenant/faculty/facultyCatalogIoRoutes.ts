import type { FastifyPluginAsync } from "fastify";
import {
  FACULTY_MODULE_MANIFEST,
  facultyDepartmentsCsvExportBodySchema,
  facultyDesignationsCsvExportBodySchema,
  facultyDepartmentImportBodySchema,
  facultyDesignationImportBodySchema,
  roleHasPermission,
  type User,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendForbidden, sendServiceUnavailable } from "../../../lib/httpErrors.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../../../services/backgroundJobWorkerService.js";
import { randomUUID } from "node:crypto";

const setupWrite = FACULTY_MODULE_MANIFEST.permissions.setupWrite;

function canSetupWrite(user: User): boolean {
  return canWriteCollection(user, "faculty") && roleHasPermission(user.role, setupWrite);
}

async function enqueueImportJob(options: {
  user: User;
  moduleId: string;
  kind: string;
  label: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const tenant = getRequestTenant();
  if (!tenant) throw new Error("Tenant context required");
  const userId = String(options.user.id);
  const jobId = options.idempotencyKey?.trim() || randomUUID();
  const existing = await getUserBackgroundJob(userId, jobId);
  if (existing) return existing;
  return enqueueBackgroundJob(
    tenant,
    userId,
    {
      id: jobId,
      moduleId: options.moduleId,
      kind: options.kind,
      status: "running",
      label: options.label,
      createdAt: new Date().toISOString(),
    },
    options.payload,
  );
}

/** Department/designation CSV export + import under /departments and /designations. */
export const facultyCatalogIoRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(
    async (dept) => {
      registerModuleCsvExportRoutes(dept, {
        canRead: (user) => canReadCollection(user, "faculty"),
        canDeleteTrash: (user) => canDeleteCollection(user, "faculty"),
        bodySchema: facultyDepartmentsCsvExportBodySchema,
        moduleId: "faculty-departments",
        defaultLabel: "Exporting departments…",
        entityNoun: "department",
        exportAuditAction: "faculty.departments.export",
        queueAuditAction: "faculty.departments.export.queue",
      });

      dept.post("/import", { bodyLimit: 2 * 1024 * 1024 }, async (request, reply) => {
        const user = request.user as User;
        if (!canSetupWrite(user)) return sendForbidden(reply);
        const parsed = parseRequest(facultyDepartmentImportBodySchema, request.body);
        if (!parsed.ok) return replyValidationError(reply, parsed.message);
        const label = parsed.data.label?.trim() || "Importing departments…";
        try {
          const job = await enqueueImportJob({
            user,
            moduleId: "faculty-departments",
            kind: "import",
            label,
            payload: {
              rows: parsed.data.rows,
              label,
              viewerRole: user.role,
            },
            idempotencyKey: parsed.data.idempotencyKey,
          });
          return reply.status(202).send({ job });
        } catch (err) {
          if (err instanceof QueueUnavailableError) {
            return sendServiceUnavailable(reply, err.message);
          }
          throw err;
        }
      });
    },
    { prefix: "/departments" },
  );

  await fastify.register(
    async (desig) => {
      registerModuleCsvExportRoutes(desig, {
        canRead: (user) => canReadCollection(user, "faculty"),
        canDeleteTrash: (user) => canDeleteCollection(user, "faculty"),
        bodySchema: facultyDesignationsCsvExportBodySchema,
        moduleId: "faculty-designations",
        defaultLabel: "Exporting designations…",
        entityNoun: "designation",
        exportAuditAction: "faculty.designations.export",
        queueAuditAction: "faculty.designations.export.queue",
      });

      desig.post("/import", { bodyLimit: 2 * 1024 * 1024 }, async (request, reply) => {
        const user = request.user as User;
        if (!canSetupWrite(user)) return sendForbidden(reply);
        const parsed = parseRequest(facultyDesignationImportBodySchema, request.body);
        if (!parsed.ok) return replyValidationError(reply, parsed.message);
        const label = parsed.data.label?.trim() || "Importing designations…";
        try {
          const job = await enqueueImportJob({
            user,
            moduleId: "faculty-designations",
            kind: "import",
            label,
            payload: {
              rows: parsed.data.rows,
              label,
              viewerRole: user.role,
            },
            idempotencyKey: parsed.data.idempotencyKey,
          });
          return reply.status(202).send({ job });
        } catch (err) {
          if (err instanceof QueueUnavailableError) {
            return sendServiceUnavailable(reply, err.message);
          }
          throw err;
        }
      });
    },
    { prefix: "/designations" },
  );
};
