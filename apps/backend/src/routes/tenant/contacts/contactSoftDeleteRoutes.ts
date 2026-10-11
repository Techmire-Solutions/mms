import type { FastifyPluginAsync } from "fastify";
import type { Contact, User } from "@mms/shared";
import { registerResourceRoutes } from "../../../lib/crudResourceRoutes.js";
import { registerSoftDeletableBulkTrashRoutes } from "../../../lib/crudBulkRoutes.js";
import { contactUseCases } from "../../../contacts/use-cases/contactUseCases.js";
import { ContactUniqueFieldError } from "../../../services/contactService.js";
import { canDeleteContacts } from "../../../services/rbacService.js";
import { contactRecordSchema, bulkIdsBodySchema } from "@mms/shared";
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
};
