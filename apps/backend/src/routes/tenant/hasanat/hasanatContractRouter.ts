import type { FastifyPluginAsync } from "fastify";
import { isQueryFlagTrue, type User } from "@mms/shared";
import { hasanatContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canReadCollection,
  canWriteCollection,
  canDeleteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { hasanatUseCases } from "../../../hasanat/use-cases/hasanatUseCases.js";

const s = initServer();

export const hasanatContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(hasanatContract, {
    listDistributions: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["listDistributions"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["listDistributions"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "hasanat_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadDistributionsPage({ ...query, includeDeleted }),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list distributions" },
        };
      }
    },
    createDistribution: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["createDistribution"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["createDistribution"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "hasanat_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const distribution = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.createDistribution(body),
          { readOnly: false },
        );
        return { status: 201 as const, body: { distribution } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to create distribution" },
        };
      }
    },
    updateDistribution: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["updateDistribution"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["updateDistribution"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, "hasanat_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const distribution = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.updateDistributionById(id, body),
          { readOnly: false },
        );
        if (!distribution) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Distribution not found" },
          };
        }
        return { status: 200 as const, body: { distribution } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to update distribution" },
        };
      }
    },
    bulkDeleteDistributions: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["bulkDeleteDistributions"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["bulkDeleteDistributions"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "hasanat_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () =>
            hasanatUseCases.bulkSoftDeleteDistributions(
              body.ids.map(String),
              String(user.id),
              body.deletionReason,
            ),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to bulk delete distributions" },
        };
      }
    },
    bulkRestoreDistributions: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["bulkRestoreDistributions"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["bulkRestoreDistributions"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, "hasanat_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.bulkRestoreDistributions(body.ids.map(String), user?.id),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true, ...result } };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to bulk restore distributions" },
        };
      }
    },
    listDenoms: async ({
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["listDenoms"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["listDenoms"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_denoms")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadDenoms(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list denominations" },
        };
      }
    },
    listBatches: async ({
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["listBatches"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["listBatches"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_batches")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadBatches(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list batches" },
        };
      }
    },
    listRedemptions: async ({
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["listRedemptions"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["listRedemptions"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_redemptions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadRedemptions(),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list redemptions" },
        };
      }
    },
    widgetAggregates: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof hasanatContract)["widgetAggregates"]>): Promise<
      ContractRouteResponse<(typeof hasanatContract)["widgetAggregates"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "hasanat_distributions")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => hasanatUseCases.loadHasanatWidgetAggregates(body.widgets),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load widget aggregates" },
        };
      }
    },
  } as unknown as RouterImplementation<typeof hasanatContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
