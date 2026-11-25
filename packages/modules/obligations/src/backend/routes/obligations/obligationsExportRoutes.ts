import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/contracts";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  obligationsCsvExportBodySchema,
  obligationsImportBodySchema,
} from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { canDeleteCollection, canReadCollection, canWriteCollection } from "@mms/be-core/rbac";

const COLLECTION = OBLIGATIONS_MODULE_MANIFEST.collectionKey;

/** Obligations CSV export queue, import queue, and export audit logging. */
export const obligationsExportRoutes: FastifyPluginAsync = async (fastify) => {
  getCsvRouteDeps().registerCsvExportRoutes(fastify, {
    canRead: (user: User) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user: User) => canDeleteCollection(user, COLLECTION),
    bodySchema: obligationsCsvExportBodySchema,
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting obligations…",
    entityNoun: "obligation",
    exportAuditAction: "obligation.export",
    queueAuditAction: "obligation.export.queue",
  });

  getCsvRouteDeps().registerCsvImportRoutes(fastify, {
    canWrite: (user: User) => canWriteCollection(user, COLLECTION),
    bodySchema: obligationsImportBodySchema,
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing obligations…",
    entityNoun: "obligation",
    queueAuditAction: "obligation.import",
  });
};
