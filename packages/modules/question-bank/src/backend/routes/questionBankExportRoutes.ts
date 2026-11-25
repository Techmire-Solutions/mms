import type { FastifyPluginAsync } from "fastify";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  moduleExportAuditBodySchema,
  questionBankCsvExportBodySchema,
  questionBankImportBodySchema,
} from "@mms/contracts";
import type { User } from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { canDeleteCollection, canWriteCollection } from "@mms/be-core/rbac";
import { userHasPermission } from "@mms/be-core/rbac";

const COLLECTION = QUESTION_BANK_MODULE_MANIFEST.collectionKey;

/** Question Bank CSV export queue, import queue, and export audit logging. */
export const questionBankExportRoutes: FastifyPluginAsync = async (fastify) => {
  getCsvRouteDeps().registerCsvExportRoutes(fastify, {
    // The CSV is the master answer key: exporting needs approver authority, not authoring.
    canRead: (user: User) => userHasPermission(user, "questionBank.delete"),
    canDeleteTrash: (user: User) => canDeleteCollection(user, COLLECTION),
    bodySchema: questionBankCsvExportBodySchema,
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting questions…",
    entityNoun: "question",
    exportAuditAction: "questionBank.export",
    queueAuditAction: "questionBank.export.queue",
    exportAuditSchema: moduleExportAuditBodySchema,
  });

  getCsvRouteDeps().registerCsvImportRoutes(fastify, {
    canWrite: (user: User) => canWriteCollection(user, COLLECTION),
    bodySchema: questionBankImportBodySchema,
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing questions…",
    entityNoun: "question",
    queueAuditAction: "questionBank.import",
  });
};
