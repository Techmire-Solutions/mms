import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  journalReversalRequestSchema,
  resourceIdParamsSchema,
  type User,
} from "@mms/shared";
import { canWriteCollection } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { reverseJournalEntry } from "../../../accounting/use-cases/reverseJournalEntryUseCase.js";
import { reverseJournalEntryDeps } from "../../../accounting/use-cases/reverseJournalEntryDeps.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** Posts a linked reversing journal for a posted entry (the original stays intact). */
export const accountingReversalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/entries/:id/reverse", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const body = parseRequest(journalReversalRequestSchema, request.body ?? {});
    if (!body.ok) return replyValidationError(reply, body.message);
    try {
      const result = await reverseJournalEntry(
        String(request.tenant?.id),
        params.data.id,
        body.data,
        { id: String(user.id), name: user.name },
        reverseJournalEntryDeps,
      );
      return reply.status(201).send(result);
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to reverse journal entry", error)
      );
    }
  });
};
