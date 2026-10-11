import type { FastifyPluginAsync } from "fastify";
import { ACCOUNTING_MODULE_MANIFEST, type User } from "@mms/shared";
import { canWriteCollection } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { seedDefaultChartOfAccountsUseCase } from "../../../accounting/use-cases/seedDefaultChartOfAccounts.js";

/** Seeds the default Chart of Accounts into a workspace that has none (409 otherwise). */
export const accountingSeedChartRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/accounts/seed-default", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, ACCOUNTING_MODULE_MANIFEST.accountCollectionKey))
      return sendForbidden(reply);
    try {
      const result = await seedDefaultChartOfAccountsUseCase();
      return reply.status(201).send({ success: true, ...result });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to seed chart of accounts", error)
      );
    }
  });
};
