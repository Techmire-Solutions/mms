import { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import { authenticateTenant } from '../../middleware/authenticate.js';
import { registerModuleAccess } from '../../middleware/requireTenantModule.js';
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examListSchema,
  examResultListSchema,
} from '@mms/shared';
import {
  registerBulkRoutes,
  registerMetricsRoute,
  registerSoftDeletableBulkRoutes,
} from '../../lib/crudRouter.js';
import { examinationsUseCases } from '../../examinations/use-cases/examinationsUseCases.js';

import { examinationSetupConfigRoutes } from './examinationSetupConfigRoutes.js';
import { examinationsReportRoutes } from './examinations/examinationsReportRoutes.js';
import { examinationContractRouter } from './examinations/examinationContractRouter.js';
import { examinationSubjectsRouter } from './examinations/examinationSubjectsRouter.js';
import { scopeAndStampExamResults } from './examinations/examResultsWriteGuard.js';
import { examinationsExportRoutes } from './examinations/examinationsExportRoutes.js';

const EXAMS_COLLECTION = EXAMINATIONS_MODULE_MANIFEST.collectionKey;
const RESULTS_COLLECTION = EXAMINATIONS_MODULE_MANIFEST.resultsCollectionKey;

/**
 * Examinations module routes — upsert bulk + soft-delete exams.
 */
export default async function examinationsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook('preHandler', authenticateTenant);
  registerModuleAccess(fastify, 'examination');

  await fastify.register(
    async (sub) => {
      await sub.register(examinationSetupConfigRoutes);
      await sub.register(examinationsReportRoutes);
      await sub.register(examinationsExportRoutes);

      registerMetricsRoute(sub, {
        collection: EXAMS_COLLECTION,
        loadMetricsFn: examinationsUseCases.loadExaminationsCommandMetrics,
        errorMessagePrefix: 'examination',
      });

      registerSoftDeletableBulkRoutes(sub, {
        path: '/exams',
        collection: EXAMS_COLLECTION,
        schema: examListSchema,
        loadFn: examinationsUseCases.loadExams,
        saveFn: examinationsUseCases.upsertExams,
        deleteFn: examinationsUseCases.deleteExamById,
        restoreFn: examinationsUseCases.restoreExamById,
        bulkDeleteFn: examinationsUseCases.bulkSoftDeleteExams,
        bulkRestoreFn: (ids, userId) => examinationsUseCases.bulkRestoreExams(ids, userId),
        responseKey: 'exams',
        errorMessagePrefix: 'exams',
        nameSingular: 'Exam',

        customGetRoute: true,
        customBulkTrashRoutes: true,
      });

      registerBulkRoutes(sub, {
        path: '/results',
        collection: RESULTS_COLLECTION,
        schema: examResultListSchema,
        saveFn: examinationsUseCases.upsertExamResults,
        beforeSave: scopeAndStampExamResults,
        responseKey: 'results',
        errorMessagePrefix: 'exam results',

        customGetRoute: true,
      });
    },
    { prefix: '/api/examinations' },
  );

  await fastify.register(examinationContractRouter);
  await fastify.register(examinationSubjectsRouter);
}
