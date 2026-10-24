import type { FastifyPluginAsync } from "fastify";
import {
  SESSIONS_MODULE_MANIFEST,
  sessionsCsvExportBodySchema,
  sessionsImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

/** Sessions CSV export queue, import queue, and export audit logging. */
export const sessionExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, SESSIONS_MODULE_MANIFEST.collectionKey),
    canDeleteTrash: (user) => canDeleteCollection(user, SESSIONS_MODULE_MANIFEST.collectionKey),
    bodySchema: sessionsCsvExportBodySchema,
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting sessions…",
    entityNoun: "session",
    exportAuditAction: "session.export",
    queueAuditAction: "session.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, SESSIONS_MODULE_MANIFEST.collectionKey),
    bodySchema: sessionsImportBodySchema,
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing sessions…",
    entityNoun: "session",
    queueAuditAction: "session.import",
  });
};
