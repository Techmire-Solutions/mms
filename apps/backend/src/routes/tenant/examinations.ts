import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examBulkWriteSchema,
  examMarksWriteListSchema,
} from "@mms/shared";
import {
  registerBulkRoutes,
  registerMetricsRoute,
  registerSoftDeletableBulkRoutes,
} from "../../lib/crudRouter.js";
import { examinationsUseCases } from "../../examinations/use-cases/examinationsUseCases.js";
import { canDeleteCollection } from "../../services/rbacService.js";

import { examinationSetupConfigRoutes } from "./examinationSetupConfigRoutes.js";
import { examinationsReportRoutes } from "./examinations/examinationsReportRoutes.js";
import { examinationContractRouter } from "./examinations/examinationContractRouter.js";
import { examinationSubjectsRouter } from "./examinations/examinationSubjectsRouter.js";
import { authorizeAndStampExamResults } from "../../examinations/use-cases/examResultsSubmission.js";
import { examinationsExportRoutes } from "./examinations/examinationsExportRoutes.js";
import { examinationMarksTransferRoutes } from "./examinations/examinationMarksTransferRoutes.js";

const EXAMS_COLLECTION = EXAMINATIONS_MODULE_MANIFEST.collectionKey;
const RESULTS_COLLECTION = EXAMINATIONS_MODULE_MANIFEST.resultsCollectionKey;

/**
 * Examinations module routes — upsert bulk + soft-delete exams.
 */
export default async function examinationsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "examination");

  await fastify.register(
    async (sub) => {
      await sub.register(examinationSetupConfigRoutes);
      await sub.register(examinationsReportRoutes);
      await sub.register(examinationsExportRoutes);
      await sub.register(examinationMarksTransferRoutes);

      registerMetricsRoute(sub, {
        collection: EXAMS_COLLECTION,
        loadMetricsFn: examinationsUseCases.loadExaminationsCommandMetrics,
        errorMessagePrefix: "examination",
      });

      registerSoftDeletableBulkRoutes(sub, {
        path: "/exams",
        collection: EXAMS_COLLECTION,
        schema: examBulkWriteSchema,
        // Creating/editing an exam defines its scoring frame and status for every student — a
        // controller action. Teachers keep `examinations.write` for marks entry only.
        canSave: (user) => canDeleteCollection(user, "exams"),
        loadFn: examinationsUseCases.loadExams,
        saveFn: examinationsUseCases.upsertExams,
        deleteFn: examinationsUseCases.deleteExamById,
        restoreFn: examinationsUseCases.restoreExamById,
        bulkDeleteFn: examinationsUseCases.bulkSoftDeleteExams,
        bulkRestoreFn: (ids, userId) => examinationsUseCases.bulkRestoreExams(ids, userId),
        responseKey: "exams",
        errorMessagePrefix: "exams",
        nameSingular: "Exam",

        customGetRoute: true,
        customBulkTrashRoutes: true,
      });

      registerBulkRoutes(sub, {
        path: "/results",
        collection: RESULTS_COLLECTION,
        // Strict marks-write contract: a missing mark is a 400, never a silent zero. The full
        // record schema accepts moderation/soft-delete fields the persist layer ignores, so it
        // must not be the write boundary (the CSV import writes through the use case instead).
        schema: examMarksWriteListSchema,
        saveFn: examinationsUseCases.upsertExamResults,
        beforeSave: authorizeAndStampExamResults,
        responseKey: "results",
        errorMessagePrefix: "exam results",

        customGetRoute: true,
      });
    },
    { prefix: "/api/examinations" },
  );

  await fastify.register(examinationContractRouter);
  await fastify.register(examinationSubjectsRouter);
}
