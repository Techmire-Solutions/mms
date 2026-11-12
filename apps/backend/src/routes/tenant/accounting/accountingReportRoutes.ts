import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountingLedgerQuerySchema,
  accountingReportQuerySchema,
  receivablesAgingQuerySchema,
  type User,
} from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { accountingUseCases } from "../../../accounting/use-cases/accountingUseCases.js";
import {
  loadAccountLedger,
  loadReceivablesAging,
} from "../../../accounting/use-cases/accountingReportEndpointsUseCases.js";
import {
  sendDatabaseError,
  sendForbidden,
  sendIfHttpDomainError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** Accounting report SQL aggregates (Trial Balance, Income Statement, Balance Sheet, Cash Flow). */
export async function accountingReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(accountingReportQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const aggregates = await accountingUseCases.loadAccountingReportAggregates(parsed.data);
      return reply.send(aggregates);
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load accounting report aggregates", error)
      );
    }
  });

  /**
   * Server-side General Ledger: the browser aggregate used to stop silently at
   * 5,000 entries, so a large ledger showed a wrong running/closing balance.
   */
  fastify.get("/ledger", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(accountingLedgerQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      return reply.send(await loadAccountLedger(parsed.data));
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load the account ledger", error)
      );
    }
  });

  /** Student receivables aging (open invoices bucketed by days past due). */
  fastify.get("/receivables-aging", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(receivablesAgingQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      return reply.send(await loadReceivablesAging(parsed.data));
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load receivables aging", error)
      );
    }
  });
}
