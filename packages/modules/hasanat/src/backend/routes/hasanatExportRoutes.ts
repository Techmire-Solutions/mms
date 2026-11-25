import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/contracts";
import {
  HASANAT_MODULE_MANIFEST,
  hasanatCsvExportBodySchema,
  hasanatImportBodySchema,
} from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { canDeleteCollection, canReadCollection, canWriteCollection } from "@mms/be-core/rbac";

const COLLECTION = HASANAT_MODULE_MANIFEST.collectionKey;

/** Hasanat CSV export queue, import queue, and export audit logging. */
export const hasanatExportRoutes: FastifyPluginAsync = async (fastify) => {
  getCsvRouteDeps().registerCsvExportRoutes(fastify, {
    canRead: (user: User) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user: User) => canDeleteCollection(user, COLLECTION),
    bodySchema: hasanatCsvExportBodySchema,
    moduleId: HASANAT_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting hasanat deeds…",
    entityNoun: "hasanat deed",
    exportAuditAction: "hasanat.export",
    queueAuditAction: "hasanat.export.queue",
  });

  getCsvRouteDeps().registerCsvImportRoutes(fastify, {
    canWrite: (user: User) => canWriteCollection(user, COLLECTION),
    bodySchema: hasanatImportBodySchema,
    moduleId: HASANAT_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing hasanat deeds…",
    entityNoun: "hasanat deed",
    queueAuditAction: "hasanat.import",
  });
};
