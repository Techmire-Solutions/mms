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

const FINANCE_COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;
const PAYMENT_COLLECTION = FINANCE_MODULE_MANIFEST.paymentCollectionKey;
const s = initServer();

export const financeContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(financeContract, {
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
    listPayments: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof financeContract)["listPayments"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["listPayments"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.loadPaymentsPage({ ...query, includeDeleted }),
          { readOnly: true },
        );
        return { status: 200 as const, body: result };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to list payments" },
        });
      }
    },
    getPayment: async ({
      params: { id },
      query,
      request,
    }: ContractRouteArgs<(typeof financeContract)["getPayment"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["getPayment"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, PAYMENT_COLLECTION)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const item = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.getPaymentById(id, includeDeleted),
          { readOnly: true },
        );
        if (!item)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Payment not found" },
          };
        return { status: 200 as const, body: { payment: item } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to load payment" },
        });
      }
    },
    createPayment: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["createPayment"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["createPayment"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.createPayment(body),
          { readOnly: false },
        );
        return { status: 201 as const, body: { payment: result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to create payment" },
        });
      }
    },
    updatePayment: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["updatePayment"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["updatePayment"]>
    > => {
      const user = request.user as User;
      if (!canWriteCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.updatePaymentById(id, body),
          { readOnly: false },
        );
        if (!result)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Payment not found" },
          };
        return { status: 200 as const, body: { payment: result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to update payment" },
        });
      }
    },
    deletePayment: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["deletePayment"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["deletePayment"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const deleted = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.deletePaymentById(id, String(user.id), body?.deletionReason),
          { readOnly: false },
        );
        if (!deleted)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Payment not found" },
          };
        return { status: 200 as const, body: { success: true as const } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to delete payment" },
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
    bulkDeletePayments: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["bulkDeletePayments"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["bulkDeletePayments"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.bulkSoftDeletePayments(body.ids.map(String), String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true as const, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk delete payments" },
        });
      }
    },
    bulkRestorePayments: async ({
      body,
      request,
    }: ContractRouteArgs<(typeof financeContract)["bulkRestorePayments"]>): Promise<
      ContractRouteResponse<(typeof financeContract)["bulkRestorePayments"]>
    > => {
      const user = request.user as User;
      if (!canDeleteCollection(user, PAYMENT_COLLECTION))
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      try {
        const result = await withTenant(
          String(request.tenant?.id),
          () => financeUseCases.bulkRestorePayments(body.ids.map(String), String(user.id)),
          { readOnly: false },
        );
        return { status: 200 as const, body: { success: true as const, ...result } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "database_error", message: "Failed to bulk restore payments" },
        });
      }
    },
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
  } as unknown as RouterImplementation<typeof financeContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
