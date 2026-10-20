import { FINANCE_MODULE_MANIFEST, type User, type financeContract } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import { financeUseCases } from "../../../finance/use-cases/financeUseCases.js";
import { canReadCollection } from "../../../services/rbacService.js";

const FINANCE_COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;

export const financeMetricsHandlers = {
  getMetrics: async ({
    request,
  }: ContractRouteArgs<(typeof financeContract)["getMetrics"]>): Promise<
    ContractRouteResponse<(typeof financeContract)["getMetrics"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, FINANCE_COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      return {
        status: 200 as const,
        body: { metrics: await financeUseCases.loadFinanceCommandMetrics() },
      };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load finance metrics" },
      });
    }
  },

  widgetAggregates: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof financeContract)["widgetAggregates"]>): Promise<
    ContractRouteResponse<(typeof financeContract)["widgetAggregates"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, FINANCE_COLLECTION))
      return {
        status: 403 as const,
        body: { type: "forbidden", message: "Insufficient permissions" },
      };
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => financeUseCases.loadFinanceWidgetAggregates(body.widgets),
        { readOnly: true },
      );
      return { status: 200 as const, body: result };
    } catch (error) {
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to load widget aggregates" },
      });
    }
  },
};
