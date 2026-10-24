import type { FastifyPluginAsync } from "fastify";
import {
  FINANCE_MODULE_MANIFEST,
  collectInvoicesBodySchema,
  creditNoteInsertSchema,
  creditNotesQuerySchema,
  remindInvoicesBodySchema,
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
  cancelInvoice,
  collectOverdueInvoices,
  createCreditNote,
  loadCreditNotes,
  remindOpenInvoices,
} from "../../../finance/use-cases/financeCollectUseCases.js";

const COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;

/** Overdue sweep, reminders, cancel, and credit notes. */
export const financeCollectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/invoices/collect", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(collectInvoicesBodySchema, request.body ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => collectOverdueInvoices(parsed.data),
        {
          readOnly: false,
        },
      );
      return reply.send(result);
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to collect overdue invoices", error)
      );
    }
  });

  fastify.post("/invoices/remind", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(remindInvoicesBodySchema, request.body ?? {});
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const result = await withTenant(
        String(request.tenant?.id),
        () => remindOpenInvoices(parsed.data),
        {
          readOnly: false,
        },
      );
      return reply.send(result);
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to prepare invoice reminders", error)
      );
    }
  });

  fastify.post("/invoices/:id/cancel", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const invoice = await withTenant(
        String(request.tenant?.id),
        () => cancelInvoice(params.data.id),
        { readOnly: false },
      );
      return reply.send({ invoice });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to cancel invoice", error)
      );
    }
  });

  fastify.get("/credit-notes", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(creditNotesQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const notes = await withTenant(
        String(request.tenant?.id),
        () => loadCreditNotes(parsed.data.invoiceId),
        {
          readOnly: true,
        },
      );
      return reply.send({ notes });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load credit notes", error)
      );
    }
  });

  fastify.post("/credit-notes", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(creditNoteInsertSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const note = await withTenant(
        String(request.tenant?.id),
        () => createCreditNote(parsed.data),
        {
          readOnly: false,
        },
      );
      return reply.send({ note });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to create credit note", error)
      );
    }
  });
};
