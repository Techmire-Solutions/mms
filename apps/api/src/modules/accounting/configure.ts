import type { FastifyInstance } from "fastify";
import {
  configureAccountingExportRouteDeps,
  configureAccountingExtraRoutes,
  configureAccountingFinancePort,
  configureAccountingJobEnqueuer,
  configureObligationVoucherPort,
} from "@mms/mod-accounting/backend/tenant";
import { financeUseCases } from "@mms/mod-billing/backend/use-cases";
import { obligationsRepository } from "@mms/mod-obligations/backend/repository";
import { listWakalaTypesByWorkspace } from "@mms/mod-obligations/backend/repository";
import { listObligationDistributionsByWorkspace } from "@mms/mod-obligations/backend/repository";
import { enqueueCsvExportJob } from "../../lib/csvExportEnqueue.js";
import { registerModuleCsvExportRoutes } from "../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../lib/registerModuleCsvImportRoutes.js";
import { accountingExportRoutes, accountingReportRoutes } from "@mms/mod-accounting/backend/routes";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../../services/backgroundJobWorkerService.js";
import { configureJobEnqueuer } from "@mms/be-core/jobs";
import { configureCsvRouteDeps } from "@mms/be-core/http/routes";
import { configureUploadsRoot } from "@mms/be-core/storage";
import { configureTenantRoleMatrix } from "@mms/be-core/rbac";
import { getTenantRoleMatrix } from "../../services/rbacService.js";
import { resolveUploadsRoot } from "../../config/uploadConfig.js";

configureUploadsRoot(resolveUploadsRoot);
configureTenantRoleMatrix(getTenantRoleMatrix);

configureAccountingFinancePort({
  createInvoice: (input: Record<string, unknown>) => financeUseCases.createInvoice(input as never),
  createPayment: (input: Record<string, unknown>) => financeUseCases.createPayment(input as never),
});

configureObligationVoucherPort({
  findObligationCollectionById: (tenant, id) =>
    obligationsRepository.findObligationCollectionById(tenant, id),
  listWakalaTypesByWorkspace,
  listObligationDistributionsByWorkspace,
});

configureJobEnqueuer({
  getUserJob: (userId, jobId) => getUserBackgroundJob(userId, jobId),
  enqueueJob: (tenant, userId, job, payload) => enqueueBackgroundJob(tenant, userId, job, payload),
  enqueueCsvExport: (input) => enqueueCsvExportJob(input),
  isQueueUnavailable: (error) => error instanceof QueueUnavailableError,
});

configureAccountingJobEnqueuer({
  getUserJob: (userId, jobId) => getUserBackgroundJob(userId, jobId),
  enqueueJob: (tenant, userId, job, payload) => enqueueBackgroundJob(tenant, userId, job, payload),
  enqueueCsvExport: (input) => enqueueCsvExportJob(input),
  isQueueUnavailable: (error) => error instanceof QueueUnavailableError,
});

configureAccountingExportRouteDeps({
  registerCsvExportRoutes: (fastify: FastifyInstance, options: Record<string, unknown>) =>
    registerModuleCsvExportRoutes(fastify, options as never),
  registerCsvImportRoutes: (fastify: FastifyInstance, options: Record<string, unknown>) =>
    registerModuleCsvImportRoutes(fastify, options as never),
});

configureCsvRouteDeps({
  registerCsvExportRoutes: (fastify: FastifyInstance, options: Record<string, unknown>) =>
    registerModuleCsvExportRoutes(fastify, options as never),
  registerCsvImportRoutes: (fastify: FastifyInstance, options: Record<string, unknown>) =>
    registerModuleCsvImportRoutes(fastify, options as never),
});

configureAccountingExtraRoutes([accountingExportRoutes, accountingReportRoutes]);
