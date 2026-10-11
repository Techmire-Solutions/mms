import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { contactsBulkTagBodySchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendDatabaseError } from "../../../lib/httpErrors.js";
import { contactUseCases } from "../../../contacts/use-cases/contactUseCases.js";
import { contactAuditExportRoutes } from "./contactAuditExportRoutes.js";
import { contactDuplicateRoutes } from "./contactDuplicateRoutes.js";
import { contactSoftDeleteRoutes } from "./contactSoftDeleteRoutes.js";
import { auditContact, requireContactPermission } from "./contactRouteHelpers.js";

/** Contact duplicate, trash, export, bulk tag, and audit operation routes. */
export const contactOperationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/bulk-tag", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;

    const parsed = parseRequest(contactsBulkTagBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    try {
      const result = await contactUseCases.bulkTagContacts(parsed.data.ids, {
        addTags: parsed.data.addTags,
        removeTags: parsed.data.removeTags,
      });

      const addSummary = parsed.data.addTags?.length
        ? `Added [${parsed.data.addTags.join(", ")}]`
        : "";
      const removeSummary = parsed.data.removeTags?.length
        ? `Removed [${parsed.data.removeTags.join(", ")}]`
        : "";
      const tagDiff = [addSummary, removeSummary].filter(Boolean).join("; ");

      await auditContact(
        user,
        "contact.bulk_tag",
        `Bulk-tagged ${result.updatedCount} contact(s): ${tagDiff}`,
      );

      return reply.send({ success: true, updatedCount: result.updatedCount });
    } catch (error: unknown) {
      return sendDatabaseError(reply, "Failed to bulk-tag contacts", error);
    }
  });

  await fastify.register(contactDuplicateRoutes);
  await fastify.register(contactAuditExportRoutes);
  await fastify.register(contactSoftDeleteRoutes);
};
