import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { ACCOUNTING_MODULE_MANIFEST, accountingReportQuerySchema, type User } from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { accountingUseCases } from "../../../accounting/use-cases/accountingUseCases.js";
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
}
