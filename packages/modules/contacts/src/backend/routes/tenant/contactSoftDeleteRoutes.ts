import type { FastifyPluginAsync } from "fastify";
import type { Contact, User } from "@mms/contracts";
import { registerResourceRoutes } from "@mms/be-core/http/crud";
import { registerSoftDeletableBulkTrashRoutes } from "@mms/be-core/http/crud";
import { contactUseCases } from "../../use-cases/index.js";
import { ContactUniqueFieldError } from "../../services/index.js";
import { canDeleteContacts } from "@mms/be-core/rbac";
import { contactRecordSchema, bulkIdsBodySchema } from "@mms/contracts";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { sendDatabaseError } from "@mms/be-core/http/errors";
import { auditContact, sanitizeOneForUser } from "./contactRouteHelpers.js";

/** Contact soft-delete, restore, and bulk trash routes. */
export const contactSoftDeleteRoutes: FastifyPluginAsync = async (fastify) => {
  registerResourceRoutes(fastify, {
    collection: "contacts",
    schema: contactRecordSchema,
    nameSingular: "contact",
    namePlural: "contacts",
    customGetRoute: true,
    customGetSingleRoute: true,
    customPostRoute: true,
    customPutRoute: true,
    canDelete: canDeleteContacts,
    restoreFn: (id, userId) => contactUseCases.restoreContactById(id, userId),
    onAfterRestore: async (user, id) => {
      await auditContact(user, "contact.restore", `Restored contact ${id}`, id);
    },
    buildRestoreResponse: async (restored, user) => ({
      success: true,
      contact: await sanitizeOneForUser(restored as Contact, user as User),
    }),
    mapRestoreError: (error) => {
      if (error instanceof ContactUniqueFieldError) {
        return {
          statusCode: 400,
          body: {
            type: "validation_error",
            message: error.message,
            errors: error.errors,
          },
        };
      }
      return null;
    },
  });

  registerSoftDeletableBulkTrashRoutes(fastify, {
    collection: "contacts",
    errorMessagePrefix: "contacts",
    bulkBodySchema: bulkIdsBodySchema,
    canDelete: canDeleteContacts,
    bulkDeleteFn: (ids, user, reason) => contactUseCases.bulkSoftDeleteContacts(ids, user, reason),
    bulkRestoreFn: (ids, userId) => contactUseCases.bulkRestoreContacts(ids, userId),
    onAfterBulkDelete: async (user, result, deletionReason) => {
      const reasonNote = deletionReason?.trim() ? ` — ${deletionReason.trim()}` : "";
      await auditContact(
        user,
        "contact.bulk_soft_delete",
        `Soft-deleted ${result.succeeded} contact(s); ${result.failed} failed${reasonNote}`,
      );
    },
    onAfterBulkRestore: async (user, result) => {
      await auditContact(
        user,
        "contact.bulk_restore",
        `Restored ${result.succeeded} contact(s); ${result.failed} failed`,
      );
    },
  });

  fastify.delete<{ Params: { id: string } }>("/:id/permanent", async (request, reply) => {
    const user = request.user as User;
    if (!canDeleteContacts(user)) {
      return reply.status(403).send({ type: "forbidden", message: "Delete permission required" });
    }
    const id = request.params.id?.trim();
    if (!id) return replyValidationError(reply, "Contact ID is required");
    try {
      const deleted = await contactUseCases.permanentDeleteContactById(id, String(user.id));
      if (!deleted) {
        return reply.status(404).send({ type: "not_found", message: "Archived contact not found" });
      }
      await auditContact(user, "contact.permanent_delete", `Permanently deleted contact ${id}`, id);
      return reply.send({ success: true as const });
    } catch (error) {
      return sendDatabaseError(reply, "Failed to permanently delete contact", error);
    }
  });

  fastify.post("/bulk-permanent-delete", async (request, reply) => {
    const user = request.user as User;
    if (!canDeleteContacts(user)) {
      return reply.status(403).send({ type: "forbidden", message: "Delete permission required" });
    }
    const parsed = parseRequest(bulkIdsBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const result = await contactUseCases.bulkPermanentDeleteContacts(
        parsed.data.ids.map(String),
        String(user.id),
      );
      await auditContact(
        user,
        "contact.bulk_permanent_delete",
        `Permanently deleted ${result.succeeded} contact(s); ${result.failed} failed`,
      );
      return reply.send({ success: true as const, ...result });
    } catch (error) {
      return sendDatabaseError(reply, "Failed to permanently delete contacts", error);
    }
  });
};
