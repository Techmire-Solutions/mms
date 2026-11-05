import type { FastifyPluginAsync } from "fastify";
import { isQueryFlagTrue, type Contact, type User, contactsContract } from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { ConflictError } from "../../../lib/httpErrors.js";
import { getLinkedContactId } from "../../../services/auth/userService.js";
import { contactUseCases } from "../../../contacts/use-cases/contactUseCases.js";
import {
  canWriteContacts,
  canReadCollection,
  canDeleteCollection,
} from "../../../services/rbacService.js";
import { replyValidationError } from "../../../lib/zodRequest.js";

import {
  auditContact,
  formatContactWriteError,
  ownProfileFieldDenial,
  RESERVED_CONTACT_ROUTE_IDS,
  sanitizeOneForUser,
  sanitizeForUser,
} from "./contactRouteHelpers.js";

const s = initServer();

export const contactCrudRoutes: FastifyPluginAsync = async (fastify) => {
  const router = s.router(contactsContract, {
    list: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof contactsContract)["list"]>): Promise<
      ContractRouteResponse<(typeof contactsContract)["list"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "contacts")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "contacts")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const skipCount = isQueryFlagTrue(query?.skipCount);
      try {
        const effectiveQuery = {
          page: 1,
          limit: 25,
          ...query,
          includeDeleted,
          skipCount,
        };
        const result = await contactUseCases.loadContactsPage(effectiveQuery);
        const contacts = result.contacts;
        const sanitized = await sanitizeForUser(contacts, user);
        return {
          status: 200 as const,
          body: { ...result, contacts: sanitized },
        };
      } catch (error) {
        request.log.error(error, "Failed to list contacts");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to list contacts" },
        };
      }
    },
    get: async ({
      params: { id },
      query,
      request,
    }: ContractRouteArgs<(typeof contactsContract)["get"]>): Promise<
      ContractRouteResponse<(typeof contactsContract)["get"]>
    > => {
      if (RESERVED_CONTACT_ROUTE_IDS.has(id)) {
        return { status: 404 as const, body: { type: "not_found", message: "Contact not found" } };
      }
      const user = request.user as User;
      if (!canReadCollection(user, "contacts")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
      if (includeDeleted && !canDeleteCollection(user, "contacts")) {
        return {
          status: 403 as const,
          body: {
            type: "forbidden",
            message: "Viewing deleted contacts requires delete permissions",
          },
        };
      }
      try {
        const contact = await contactUseCases.getContactById(id, includeDeleted);
        if (!contact || (!includeDeleted && contact.deletedAt != null)) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Contact not found" },
          };
        }
        return { status: 200 as const, body: { contact: await sanitizeOneForUser(contact, user) } };
      } catch (error) {
        request.log.error(error, "Failed to load contact");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load contact" },
        };
      }
    },
    create: async ({
      body,
      headers,
      request,
    }: ContractRouteArgs<(typeof contactsContract)["create"]>): Promise<
      ContractRouteResponse<(typeof contactsContract)["create"]>
    > => {
      const user = request.user as User;
      if (!canWriteContacts(user)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      const lang = (request.headers?.["accept-language"] as string | undefined) || "en";

      try {
        // Audit is appended inside the write transaction by the use case
        // (`mms-data-layer` §5.4), so a committed contact is never unaudited.
        const { contact, created } = await contactUseCases.upsertContact(body as Contact, {
          user,
          language: lang,
          // `create` must not silently update: an existing id needs the version
          // token, otherwise this is a conflict (R4-05).
          requireExpectedVersion: true,
          expectedUpdatedAt: headers?.["x-expected-updated-at"],
        });
        return {
          status: created ? (201 as const) : (200 as const),
          body: { success: true, contact: await sanitizeOneForUser(contact, user) },
        };
      } catch (error: unknown) {
        request.log.error(error, "Failed to save contact record");
        return formatContactWriteError(error, "Failed to save contact record");
      }
    },
    update: async ({
      params: { id },
      body,
      headers,
      request,
    }: ContractRouteArgs<(typeof contactsContract)["update"]>): Promise<
      ContractRouteResponse<(typeof contactsContract)["update"]>
    > => {
      if (RESERVED_CONTACT_ROUTE_IDS.has(id)) {
        return { status: 404 as const, body: { type: "not_found", message: "Contact not found" } };
      }
      const user = request.user as User;
      const linkedContactId = await getLinkedContactId(user.id);
      const isOwnContact = linkedContactId != null && String(linkedContactId) === id;
      if (!isOwnContact && !canWriteContacts(user)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      if (isOwnContact && !canWriteContacts(user)) {
        const ownProfileDenial = ownProfileFieldDenial(body);
        if (ownProfileDenial) return ownProfileDenial;
      }
      const lang = (request.headers?.["accept-language"] as string | undefined) || "en";

      try {
        const updatePayload = { ...(body && typeof body === "object" ? body : {}), id } as Contact;
        const updated = await contactUseCases.updateContactById(id, updatePayload, {
          language: lang,
          applyRelationshipInference: canWriteContacts(user),
          actorId: String(user.id),
          viewerRole: user.role,
          expectedUpdatedAt: headers?.["x-expected-updated-at"],
        });
        if (!updated)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Contact not found" },
          };
        // The use case appends the audit row inside the write transaction.
        return {
          status: 200 as const,
          body: { success: true, contact: await sanitizeOneForUser(updated, user) },
        };
      } catch (error: unknown) {
        // A stale-write conflict is an expected outcome, not a server failure.
        if (error instanceof ConflictError) {
          return {
            status: 409 as const,
            body: { type: "conflict" as const, message: error.message },
          };
        }
        request.log.error(error, "Failed to update contact");
        return formatContactWriteError(error, "Failed to update contact");
      }
    },
    delete: async ({
      params: { id },
      body,
      request,
    }: ContractRouteArgs<(typeof contactsContract)["delete"]>): Promise<
      ContractRouteResponse<(typeof contactsContract)["delete"]>
    > => {
      if (RESERVED_CONTACT_ROUTE_IDS.has(id)) {
        return { status: 404 as const, body: { type: "not_found", message: "Contact not found" } };
      }
      const user = request.user as User;
      if (!canDeleteCollection(user, "contacts")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const deleted = await contactUseCases.softDeleteContactById(
          id,
          String(user.id),
          (body as { deletionReason?: string } | undefined)?.deletionReason,
        );
        if (!deleted)
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Contact not found" },
          };
        await auditContact(user, "contact.soft_delete", `Soft-deleted contact ${id}`, id);
        return { status: 200 as const, body: { success: true } };
      } catch (error) {
        request.log.error(error, "Failed to delete contact");
        // A dependent-link guard throws ConflictError (active student/faculty/
        // staff user); the shared formatter keeps that 409 actionable instead of
        // collapsing it into an opaque 500.
        return formatContactWriteError(error, "Failed to delete contact");
      }
    },
    reportAnalytics: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof contactsContract)["reportAnalytics"]>): Promise<
      ContractRouteResponse<(typeof contactsContract)["reportAnalytics"]>
    > => {
      const user = request.user as User;
      if (!canReadCollection(user, "contacts")) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const result = await contactUseCases.loadContactsReportAnalytics({
          compareYears: query.years as number[],
          language: query.lang as string | undefined,
        });
        return { status: 200 as const, body: result };
      } catch (error) {
        request.log.error(error, "Failed to load contact report analytics");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to load contact report analytics" },
        };
      }
    },
  } as unknown as RouterImplementation<typeof contactsContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
};
