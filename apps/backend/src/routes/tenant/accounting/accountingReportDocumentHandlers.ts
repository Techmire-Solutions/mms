import type { User, accountingContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { handleContractError } from "../../../lib/contractError.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import {
  enqueueAccountingLedgerExport,
  enqueueAccountingReportPdf,
  QueueUnavailableError,
} from "./accountingReportDocumentEnqueue.js";

/**
 * Contract handlers for the printable reports (PDF) and the streamed ledger export.
 *
 * Split out of `accountingContractRouter` for the 300-line ceiling; both handlers
 * use the same audit/idempotency helpers as the CSV export routes.
 */

const forbidden = () => ({
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
});

export const accountingReportDocumentHandlers = {
  requestReportPdf: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof accountingContract)["requestReportPdf"]>): Promise<
    ContractRouteResponse<(typeof accountingContract)["requestReportPdf"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "accounting_entries")) return forbidden();
    const tenant = getRequestTenant();
    if (!tenant) return forbidden();
    try {
      const job = await enqueueAccountingReportPdf(tenant, String(user.id), body);
      return { status: 202 as const, body: { job } };
    } catch (error: unknown) {
      if (error instanceof QueueUnavailableError) {
        return {
          status: 503 as const,
          body: { type: "service_unavailable", message: (error as Error).message },
        };
      }
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to queue the report PDF" },
      });
    }
  },

  exportLedger: async ({
    body,
    request,
  }: ContractRouteArgs<(typeof accountingContract)["exportLedger"]>): Promise<
    ContractRouteResponse<(typeof accountingContract)["exportLedger"]>
  > => {
    const user = request.user as User;
    if (!canReadCollection(user, "accounting_entries")) return forbidden();
    const tenant = getRequestTenant();
    if (!tenant) return forbidden();
    try {
      const job = await enqueueAccountingLedgerExport(
        tenant,
        String(user.id),
        String(user.role),
        body,
      );
      return { status: 202 as const, body: { job } };
    } catch (error: unknown) {
      if (error instanceof QueueUnavailableError) {
        return {
          status: 503 as const,
          body: { type: "service_unavailable", message: (error as Error).message },
        };
      }
      return handleContractError(request, error, {
        status: 500,
        body: { type: "database_error", message: "Failed to queue the ledger export" },
      });
    }
  },
};
