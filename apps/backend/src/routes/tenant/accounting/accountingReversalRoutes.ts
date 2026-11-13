import type { FastifyPluginAsync } from "fastify";
import {
  journalReversalResultSchema,
  journalReversalRequestSchema,
  resourceIdParamsSchema,
  type User,
} from "@mms/shared";
import { canManageAccounting } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendValidated } from "../../../lib/validatedReply.js";
import { reverseJournalEntry } from "../../../accounting/use-cases/reverseJournalEntryUseCase.js";
import { reverseJournalEntryDeps } from "../../../accounting/use-cases/reverseJournalEntryDeps.js";

/** Posts a linked reversing journal for a posted entry (the original stays intact). */
export const accountingReversalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/entries/:id/reverse",
    // Reversal undoes an immutable, posted voucher: controller authority.
    { config: { moduleAction: "manage" } },
    async (request, reply) => {
      const user = request.user as User;
      if (!canManageAccounting(user)) return sendForbidden(reply);
      const params = parseRequest(resourceIdParamsSchema, request.params);
      if (!params.ok) return replyValidationError(reply, params);
      const body = parseRequest(journalReversalRequestSchema, request.body ?? {});
      if (!body.ok) return replyValidationError(reply, body);
      try {
        const result = await reverseJournalEntry(
          String(request.tenant?.id),
          params.data.id,
          body.data,
          { id: String(user.id), name: user.name },
          reverseJournalEntryDeps,
        );
        return sendValidated(reply, 201, journalReversalResultSchema, result);
      } catch (error) {
        return (
          sendIfHttpDomainError(reply, error) ??
          sendDatabaseError(reply, "Failed to reverse journal entry", error)
        );
      }
    },
  );
};
