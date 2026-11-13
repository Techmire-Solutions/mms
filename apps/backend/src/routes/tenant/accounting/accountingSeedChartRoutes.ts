import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountingSeedChartResponseSchema,
  type User,
} from "@mms/shared";
import { canWriteCollection } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendValidated } from "../../../lib/validatedReply.js";
import { seedDefaultChartOfAccountsUseCase } from "../../../accounting/use-cases/seedDefaultChartOfAccounts.js";

/** The seed takes no input; reject a body rather than silently ignoring one. */
const emptyBodySchema = z.object({}).strict();

/** Seeds the default Chart of Accounts into a workspace that has none (409 otherwise). */
export const accountingSeedChartRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/accounts/seed-default", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, ACCOUNTING_MODULE_MANIFEST.accountCollectionKey))
      return sendForbidden(reply);
    const body = parseRequest(emptyBodySchema, request.body ?? {});
    if (!body.ok) return replyValidationError(reply, body);
    try {
      const result = await seedDefaultChartOfAccountsUseCase();
      return sendValidated(reply, 201, accountingSeedChartResponseSchema, {
        success: true,
        ...result,
      });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to seed chart of accounts", error)
      );
    }
  });
};
