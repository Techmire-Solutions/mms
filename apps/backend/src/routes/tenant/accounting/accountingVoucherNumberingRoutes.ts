import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  voucherNumberingQuerySchema,
  voucherNumberingUpdateSchema,
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
    if (!query.ok) return replyValidationError(reply, query.message);
    try {
      // Primary, not replica: the preview must reflect numbers issued a moment ago.
      const numbering = await withTenant(String(request.tenant?.id), () =>
        loadVoucherNumbering(query.data.date),
      );
      return reply.send({ numbering });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load voucher numbering", error)
      );
    }
  });

  fastify.put("/voucher-numbering", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(voucherNumberingUpdateSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const numbering = await withTenant(String(request.tenant?.id), () =>
        upsertVoucherNumbering(parsed.data),
      );
      return reply.send({ numbering });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save voucher numbering", error)
      );
    }
  });
};
