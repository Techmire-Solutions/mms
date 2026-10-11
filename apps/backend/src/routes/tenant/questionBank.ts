import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  questionBankQuestionListSchema,
  questionBankTestListSchema,
  questionBankResultListSchema,
} from "@mms/shared";
import {
  registerBulkRoutes,
  registerMetricsRoute,
  registerSoftDeletableBulkRoutes,
} from "../../lib/crudRouter.js";

import { questionBankUseCases } from "../../questionBank/use-cases/questionBankUseCases.js";

import { questionBankSetupConfigRoutes } from "./questionBankSetupConfigRoutes.js";
import { questionBankContractRouter } from "./questionBank/questionBankContractRouter.js";
import { questionBankExportRoutes } from "./questionBank/questionBankExportRoutes.js";

const QUESTIONS_COLLECTION = QUESTION_BANK_MODULE_MANIFEST.collectionKey;
const TESTS_COLLECTION = QUESTION_BANK_MODULE_MANIFEST.testsCollectionKey;
const RESULTS_COLLECTION = QUESTION_BANK_MODULE_MANIFEST.resultsCollectionKey;

/**
 * Question Bank module routes — upsert bulk + soft-delete questions; upsert tests/results.
 */
export default async function questionBankRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "questionBank");

  await fastify.register(
    async (sub) => {
      await sub.register(questionBankSetupConfigRoutes);
      await sub.register(questionBankExportRoutes);

      registerMetricsRoute(sub, {
        collection: QUESTIONS_COLLECTION,
        loadMetricsFn: questionBankUseCases.loadQuestionBankCommandMetrics,
        errorMessagePrefix: "question bank",
      });

      registerSoftDeletableBulkRoutes(sub, {
        path: "/questions",
        collection: QUESTIONS_COLLECTION,
        schema: questionBankQuestionListSchema,
        loadFn: questionBankUseCases.loadQuestions,
        saveFn: questionBankUseCases.upsertQuestions,
        deleteFn: questionBankUseCases.deleteQuestionById,
        restoreFn: questionBankUseCases.restoreQuestionById,
        bulkDeleteFn: questionBankUseCases.bulkSoftDeleteQuestions,
        bulkRestoreFn: (ids, userId) => questionBankUseCases.bulkRestoreQuestions(ids, userId),
        responseKey: "questions",
        errorMessagePrefix: "questions",
        nameSingular: "Question",
        customGetRoute: true,
        customBulkTrashRoutes: true,
      });

      registerBulkRoutes(sub, {
        path: "/tests",
        collection: TESTS_COLLECTION,
        schema: questionBankTestListSchema,
        saveFn: questionBankUseCases.upsertTests,
        responseKey: "tests",
        errorMessagePrefix: "tests",
        customGetRoute: true,
      });

      registerBulkRoutes(sub, {
        path: "/assessment-results",
        collection: RESULTS_COLLECTION,
        schema: questionBankResultListSchema,
        saveFn: questionBankUseCases.upsertResults,
        responseKey: "results",
        errorMessagePrefix: "assessment results",
        customGetRoute: true,
      });
    },
    { prefix: "/api/question-bank" },
  );

  await fastify.register(questionBankContractRouter);
}
