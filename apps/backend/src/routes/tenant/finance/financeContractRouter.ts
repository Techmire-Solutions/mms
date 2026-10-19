import type { FastifyPluginAsync } from "fastify";
import { FINANCE_MODULE_MANIFEST, type User, financeContract, isQueryFlagTrue } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import { financeUseCases } from "../../../finance/use-cases/financeUseCases.js";
import {
  canDeleteCollection,
  canWriteCollection,
  canReadCollection,
} from "../../../services/rbacService.js";
import { financePaymentHandlers } from "./financePaymentHandlers.js";
import { financeMetricsHandlers } from "./financeMetricsHandlers.js";

const FINANCE_COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;
const s = initServer();

export const financeContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(financeContract, {
    ...financePaymentHandlers,
    ...financeMetricsHandlers,
    listInvoices: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof financeContract)["listInvoices"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["listInvoices"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.loadInvoicesPage({ ...query, includeDeleted }),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list invoices" },
        });
      }
    },
    getInvoice: async ({
      params: { id },
      query,
      request,
    }: ContractRouteArgs<(typeof financeContract)["getInvoice"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["getInvoice"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, FINANCE_COLLECTION)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const item = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.getInvoiceById(id, includeDeleted),
          { readOnly: true },
        );
        if (!item)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Invoice not found" },
          };
        return { status: 200 as const, body: { invoice: item } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to load invoice" },
        });
      }
    },
    createInvoice: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["createInvoice"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["createInvoice"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.createInvoice(body),
          { readOnly: false },
        );
        return { status: 201 as const, body: { invoice: result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to create invoice" },
        });
      }
    },
    updateInvoice: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["updateInvoice"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["updateInvoice"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.updateInvoiceById(id, body),
          { readOnly: false },
        );
        if (!result)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Invoice not found" },
          };
        return { status: 200 as const, body: { invoice: result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to update invoice" },
        });
      }
    },
    deleteInvoice: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["deleteInvoice"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["deleteInvoice"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const deleted = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.deleteInvoiceById(id, String(user.id), body?.deletionReason),
          { readOnly: false },
        );
        if (!deleted)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Invoice not found" },
          };
        return { status: 200 as const, body: { success: true as const } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to delete invoice" },
        });
      }
    },

    bulkDeleteInvoices: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["bulkDeleteInvoices"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["bulkDeleteInvoices"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.bulkSoftDeleteInvoices(body.ids.map(String), String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true as const, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk delete invoices" },
        });
      }
    },
    bulkRestoreInvoices: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["bulkRestoreInvoices"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["bulkRestoreInvoices"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.bulkRestoreInvoices(body.ids.map(String), String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true as const, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk restore invoices" },
        });
      }
    },
    bulkStatusInvoices: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["bulkStatusInvoices"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["bulkStatusInvoices"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, FINANCE_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.bulkUpdateInvoicesStatus(body.ids, body.status),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true as const, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk update invoice status" },
        });
      }
    },

  } as unknown as RouterImplementation<typeof financeContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
