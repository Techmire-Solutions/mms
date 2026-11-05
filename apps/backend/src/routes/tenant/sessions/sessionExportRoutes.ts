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

/**
 * `POST /api/sessions/export/csv` — queues the server-side Sessions CSV export.
 *
 * The queue path writes the authoritative `sessions.export.queue` audit row, so the legacy
 * client-reportable `/export-audit` endpoint is deliberately not registered (C-09 / faculty
 * parity): a caller could otherwise forge the exported count and scope.
 */
export const sessionExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "sessions"),
    canDeleteTrash: (user) => canDeleteCollection(user, "sessions"),
    bodySchema: sessionsCsvExportBodySchema,
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting sessions…",
    entityNoun: "session",
    exportAuditAction: "sessions.export",
    queueAuditAction: "sessions.export.queue",
    registerExportAudit: false,
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, "sessions"),
    bodySchema: sessionsImportBodySchema,
    moduleId: SESSIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing sessions…",
    entityNoun: "session",
    queueAuditAction: "sessions.import",
  });
};
