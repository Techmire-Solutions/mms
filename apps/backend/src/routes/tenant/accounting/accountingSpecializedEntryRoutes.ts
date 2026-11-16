import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  specializedEntryResponseSchema,
  specializedEntrySchema,
  type User,
} from "@mms/shared";
import { canWriteCollection } from "../../../services/rbacService.js";
import { canPostAccounting } from "../../../lib/rbacCanModuleHelpers.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendValidated } from "../../../lib/validatedReply.js";
import { processSpecializedEntryUseCase } from "../../../accounting/use-cases/processSpecializedEntryUseCase.js";

/**
 * General Entries quick-action endpoint (Fee, Salary) — a single request
 * writes across Finance (invoice + payment) and/or Accounting (ledger
 * posting), so both modules' write permission is required.
 */
export const accountingSpecializedEntryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/specialized-entries", async (request, reply) => {
    const user = request.user as User;
    const canWriteAccounting = canWriteCollection(user, ACCOUNTING_MODULE_MANIFEST.collectionKey);
    const canWriteFinance = canWriteCollection(user, FINANCE_MODULE_MANIFEST.collectionKey);
    if (!canWriteAccounting || !canWriteFinance) return sendForbidden(reply);

    const parsed = parseRequest(specializedEntrySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed);

    // A salary quick action writes an immutable `posted` voucher straight to the
    // ledger, so it requires `accounting.post` on top of `accounting.write` (the
    // fee path posts through the finance pipeline and is unaffected).
    if (parsed.data.type === "salary" && !canPostAccounting(user)) {
      return sendForbidden(reply);
    }

    try {
      const result = await processSpecializedEntryUseCase(parsed.data, { name: user.name });
      return sendValidated(reply, 201, specializedEntryResponseSchema, result);
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to process entry", error)
      );
    }
  });
};
