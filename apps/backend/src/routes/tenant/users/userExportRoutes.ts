import type { FastifyPluginAsync } from "fastify";
import { USERS_MODULE_MANIFEST } from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import {
  moduleExportAuditBodySchema as userExportAuditSchema,
  usersCsvExportBodySchema,
  usersImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";

/** Users CSV export queue, import queue, and export audit logging. */
export const userExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "users"),
    canDeleteTrash: (user) => canDeleteCollection(user, "users"),
    bodySchema: usersCsvExportBodySchema,
    moduleId: USERS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting users…",
    entityNoun: "user",
    exportAuditAction: "user.export",
    queueAuditAction: "user.export.queue",
    exportAuditSchema: userExportAuditSchema,
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, "users"),
    bodySchema: usersImportBodySchema,
    moduleId: USERS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing users…",
    entityNoun: "user",
    queueAuditAction: "user.import",
  });
};
