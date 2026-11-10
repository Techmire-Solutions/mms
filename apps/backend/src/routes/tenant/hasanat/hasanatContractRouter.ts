import type { FastifyPluginAsync } from "fastify";
import {
  isQueryFlagTrue,
  normalizeHasanatReportComparisonQuery,
  parseComparisonQueryParams,
  type User,
} from "@mms/shared";
import { hasanatContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { hasanatUseCases } from "../../../hasanat/use-cases/hasanatUseCases.js";
import {
  handleBatchAward,
  handleBatchRecipients,
  handleReconcileTiers,
  handleStudentReport,
  handleStudentSummary,
} from "./hasanatTierBatchHandlers.js";
import {
  handleBulkDeleteDistributions,
  handleBulkRestoreDistributions,
  handleChangeDistributionStatus,
  handleCreateDistribution,
  handleDeleteDistribution,
  handleRedeemDistribution,
  handleRestoreDistribution,
  handleReverseRedemption,
  handleUpdateDistribution,
} from "./hasanatDistributionHandlers.js";

const s = initServer();

const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};

/**
 * Every route declared in `hasanatContract` must be implemented here. The completeness assertion
 * below fails the build when a contract key is missing, instead of the route silently 404ing.
 */
const implementation = {
  listDistributions: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["listDistributions"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["listDistributions"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "hasanat_distributions")) return forbidden;
    const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
    if (includeDeleted && !canDeleteCollection(user, "hasanat_distributions")) return forbidden;
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.loadDistributionsPage({ ...query, includeDeleted }),
        { readOnly: true },
      );
      return { status: 200 as const, body: result };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to list distributions" },
      });
    }
  },

  batchAward: handleBatchAward,
  batchRecipients: handleBatchRecipients,
  studentReport: handleStudentReport,
  studentSummary: handleStudentSummary,
  reconcileTiers: handleReconcileTiers,
  createDistribution: handleCreateDistribution,
  updateDistribution: handleUpdateDistribution,
  changeDistributionStatus: handleChangeDistributionStatus,
  deleteDistribution: handleDeleteDistribution,
  restoreDistribution: handleRestoreDistribution,
  bulkDeleteDistributions: handleBulkDeleteDistributions,
  bulkRestoreDistributions: handleBulkRestoreDistributions,
  redeemDistribution: handleRedeemDistribution,
  reverseRedemption: handleReverseRedemption,

  listDenoms: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["listDenoms"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["listDenoms"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "hasanat_denoms")) return forbidden;
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.loadDenoms({ limit: query?.limit, offset: query?.offset }),
        { readOnly: true },
      );
      return { status: 200 as const, body: result };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to list denominations" },
      });
    }
  },

  listBatches: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["listBatches"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["listBatches"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "hasanat_batches")) return forbidden;
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.loadBatches({ limit: query?.limit, offset: query?.offset }),
        { readOnly: true },
      );
      return { status: 200 as const, body: result };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to list batches" },
      });
    }
  },

  listRedemptions: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["listRedemptions"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["listRedemptions"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "hasanat_redemptions")) return forbidden;
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.loadRedemptions(query),
        { readOnly: true },
      );
      return { status: 200 as const, body: result };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to list redemptions" },
      });
    }
  },

  reportAggregates: async ({
    query,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["reportAggregates"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["reportAggregates"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "hasanat_distributions")) return forbidden;
    try {
      const comparisonQuery = normalizeHasanatReportComparisonQuery(
        parseComparisonQueryParams(query ?? {}),
      );
      const result = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.loadHasanatReportAggregates(comparisonQuery),
        { readOnly: true },
      );
      return { status: 200 as const, body: result };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load hasanat report aggregates" },
      });
    }
  },

  replaceDenoms: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["replaceDenoms"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["replaceDenoms"]>
  > => {
    const user = request.user as User;
    if (!canWriteCollection(user, "hasanat_denoms")) return forbidden;
    try {
      const denoms = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.replaceDenoms(body),
        { readOnly: false },
      );
      return { status: 200 as const, body: { denoms } };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to replace denominations" },
      });
    }
  },

  replaceBatches: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["replaceBatches"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["replaceBatches"]>
  > => {
    const user = request.user as User;
    if (!canWriteCollection(user, "hasanat_batches")) return forbidden;
    try {
      const batches = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.replaceBatches(body),
        { readOnly: false },
      );
      return { status: 200 as const, body: { batches } };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to replace batches" },
      });
    }
  },

  widgetAggregates: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof hasanatContract)["widgetAggregates"]>): Promise<
    ContractRouteResponse<(typeof hasanatContract)["widgetAggregates"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "hasanat_distributions")) return forbidden;
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => hasanatUseCases.loadHasanatWidgetAggregates(body.widgets),
        { readOnly: true },
      );
      return { status: 200 as const, body: result };
    } catch (error: unknown) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load widget aggregates" },
      });
    }
  },
};

type MissingContractRoutes = Exclude<keyof typeof hasanatContract, keyof typeof implementation>;
const contractIsComplete: MissingContractRoutes extends never
  ? true
  : { missingRoutes: MissingContractRoutes } = true;
void contractIsComplete;

export const hasanatContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(
    hasanatContract,
    implementation as unknown as RouterImplementation<typeof hasanatContract>,
  );
  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
