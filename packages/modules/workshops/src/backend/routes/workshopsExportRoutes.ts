import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/contracts";
import { WORKSHOPS_MODULE_MANIFEST, workshopsCsvExportBodySchema } from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { canDeleteCollection, canReadCollection } from "@mms/be-core/rbac";

const COLLECTION = WORKSHOPS_MODULE_MANIFEST.collectionKey;

/** Workshops (events) CSV export queue + export audit logging. */
export const workshopsExportRoutes: FastifyPluginAsync = async (fastify) => {
  getCsvRouteDeps().registerCsvExportRoutes(fastify, {
    canRead: (user: User) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user: User) => canDeleteCollection(user, COLLECTION),
    bodySchema: workshopsCsvExportBodySchema,
    moduleId: WORKSHOPS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting workshops…",
    entityNoun: "workshop",
    exportAuditAction: "workshops.export",
    queueAuditAction: "workshops.export.queue",
  });
};
