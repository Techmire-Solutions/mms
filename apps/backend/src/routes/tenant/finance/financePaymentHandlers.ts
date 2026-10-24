import {
  FINANCE_MODULE_MANIFEST,
  type User,
  type financeContract,
  isQueryFlagTrue,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { withTenant } from "../../../db/tenant-context.js";
import { financeUseCases } from "../../../finance/use-cases/financeUseCases.js";
import {
  canDeleteCollection,
  canWriteCollection,
  canReadCollection,
} from "../../../services/rbacService.js";

const PAYMENT_COLLECTION = FINANCE_MODULE_MANIFEST.paymentCollectionKey;

export const financePaymentHandlers = {
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
};
