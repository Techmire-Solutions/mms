import type { FastifyPluginAsync } from "fastify";
import {
  FINANCE_MODULE_MANIFEST,
  feeStructureInsertSchema,
  generateInvoicesBodySchema,
  resourceIdParamsSchema,
  type User,
} from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  loadFeeStructures,
  removeFeeStructure,
  upsertFeeStructure,
} from "../../../finance/use-cases/financeBillingUseCases.js";
import { generateInvoices } from "../../../finance/use-cases/financeInvoiceGenerationUseCases.js";

const COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;

/** Fee structures + items (Setup). */
export const financeBillingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/fee-structures", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    try {
      const structures = await withTenant(String(request.tenant?.id), () => loadFeeStructures(), {
        readOnly: true,
      });
      return reply.send({ structures });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load fee structures", error)
      );
    }
  });

  fastify.put("/fee-structures", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(feeStructureInsertSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const structure = await withTenant(
        String(request.tenant?.id),
        () => upsertFeeStructure(parsed.data),
        { readOnly: false },
      );
      return reply.send({ structure });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save fee structure", error)
      );
    }
  });

  fastify.post("/invoices/generate", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(generateInvoicesBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => generateInvoices(parsed.data),
        {
          readOnly: false,
        },
      );
      return reply.send(result);
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to generate invoices", error)
      );
    }
  });

  fastify.delete("/fee-structures/:id", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      await withTenant(String(request.tenant?.id), () => removeFeeStructure(params.data.id), {
        readOnly: false,
      });
      return reply.send({ success: true });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to delete fee structure", error)
      );
    }
  });
};
