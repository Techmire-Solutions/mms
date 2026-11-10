import type { FastifyPluginAsync } from "fastify";
import { isQueryFlagTrue, type User } from "@mms/shared";
import { hasanatContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";
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

function databaseError(message: string) {
  return { status: 500 as const, body: { type: "database_error", message } };
}

export const hasanatContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(hasanatContract, {
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
      } catch {
        return databaseError("Failed to list distributions");
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
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["listDenoms"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["listDenoms"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_denoms")) return forbidden;
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadDenoms(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return databaseError("Failed to list denominations");
      }
    },

    listBatches: async ({
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["listBatches"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["listBatches"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_batches")) return forbidden;
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadBatches(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return databaseError("Failed to list batches");
      }
    },

    listRedemptions: async ({
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["listRedemptions"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["listRedemptions"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_redemptions")) return forbidden;
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadRedemptions(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return databaseError("Failed to list redemptions");
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
      } catch {
        return databaseError("Failed to load widget aggregates");
      }
    },
  } as unknown as RouterImplementation<typeof hasanatContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
