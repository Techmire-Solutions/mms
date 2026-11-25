import type { FastifyPluginAsync } from "fastify";
import { WORKSHOPS_MODULE_MANIFEST, workshopsCsvExportBodySchema } from "@mms/contracts";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";

const COLLECTION = WORKSHOPS_MODULE_MANIFEST.collectionKey;

/** Workshops (events) CSV export queue + export audit logging. */
export const workshopsExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: workshopsCsvExportBodySchema,
    moduleId: WORKSHOPS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting workshops…",
    entityNoun: "workshop",
    exportAuditAction: "workshops.export",
    queueAuditAction: "workshops.export.queue",
  });
};
