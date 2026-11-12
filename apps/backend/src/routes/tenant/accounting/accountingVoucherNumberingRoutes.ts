import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  voucherNumberingQuerySchema,
  voucherNumberingResponseSchema,
  voucherNumberingUpdateSchema,
  type User,
} from "@mms/shared";
import { canManageAccounting, canReadCollection } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendValidated } from "../../../lib/validatedReply.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  loadVoucherNumbering,
  upsertVoucherNumbering,
} from "../../../accounting/use-cases/accountingVoucherNumberingUseCases.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** Journal voucher numbering format and next-number preview. */
export const accountingVoucherNumberingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/voucher-numbering", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(voucherNumberingQuerySchema, request.query);
    if (!query.ok) return replyValidationError(reply, query);
    try {
      // Primary, not replica: the preview must reflect numbers issued a moment ago.
      const numbering = await withTenant(String(request.tenant?.id), () =>
        loadVoucherNumbering(query.data.date),
      );
      return sendValidated(reply, 200, voucherNumberingResponseSchema, { numbering });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load voucher numbering", error)
      );
    }
  });

  fastify.put("/voucher-numbering", async (request, reply) => {
    const user = request.user as User;
    // Renumbering changes every future voucher reference: controller authority.
    if (!canManageAccounting(user)) return sendForbidden(reply);
    const parsed = parseRequest(voucherNumberingUpdateSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed);
    try {
      const numbering = await withTenant(String(request.tenant?.id), () =>
        upsertVoucherNumbering(parsed.data),
      );
      return sendValidated(reply, 200, voucherNumberingResponseSchema, { numbering });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save voucher numbering", error)
      );
    }
  });
};
