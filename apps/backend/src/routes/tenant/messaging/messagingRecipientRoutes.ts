import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { messagingRecipientsMatchQuerySchema } from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { entityResolveBodySchema } from "@mms/shared";
import { canReadMessaging } from "../../../services/rbacService.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";

/** Messaging recipient directory and contact resolve routes. */
export const messagingRecipientRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/recipients/match", async (req, reply) => {
    const user = req.user as User;
    if (!canReadMessaging(user)) return sendForbidden(reply);
    const parsedQuery = parseRequest(messagingRecipientsMatchQuerySchema, req.query);
    if (!parsedQuery.ok) return replyValidationError(reply, parsedQuery.message);
    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }
    try {
      const result = await messagingUseCases.matchMessagingRecipients(
        tenantSubdomain,
        parsedQuery.data,
      );
      return reply.send(result);
    } catch (err) {
      return sendDatabaseError(reply, "Failed to match messaging recipients", err);
    }
  });

  fastify.post("/contacts/resolve", async (req, reply) => {
    const user = req.user as User;
    if (!canReadMessaging(user)) return sendForbidden(reply);
    const parsed = parseRequest(entityResolveBodySchema, req.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }
    try {
      const recipients = await messagingUseCases.resolveMessagingRecipients(
        tenantSubdomain,
        parsed.data.ids,
      );
      return reply.send({ recipients });
    } catch (err) {
      return sendDatabaseError(reply, "Failed to resolve messaging contacts", err);
    }
  });
};
