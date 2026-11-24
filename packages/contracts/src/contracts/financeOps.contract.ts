import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/**
 * Finance operations routes (invoice collection/reminders/cancel, invoice generation,
 * credit notes, fee structures).
 *
 * Served by plain Fastify plugins — kept in their own contract because `financeContract`
 * is consumed wholesale by the backend's ts-rest router. Mirrors the contacts/accounting
 * multi-contract split. Responses stay `unknown` (widened client, ADR-010).
 */
export const financeOpsContract = c.router({
  collectInvoices: {
    method: "POST",
    path: "/api/finance/invoices/collect",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Bulk mark invoices collected",
  },
  remindInvoices: {
    method: "POST",
    path: "/api/finance/invoices/remind",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Bulk remind unpaid invoices",
  },
  cancelInvoice: {
    method: "POST",
    path: "/api/finance/invoices/:id/cancel",
    pathParams: z.object({ id: z.string() }),
    body: z.unknown().optional(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Cancel an invoice",
  },
  createCreditNote: {
    method: "POST",
    path: "/api/finance/credit-notes",
    body: z.unknown(),
    responses: { 200: ok, 201: ok, 400: errorResponse, 403: errorResponse },
    summary: "Create a credit note",
  },
  listCreditNotes: {
    method: "GET",
    path: "/api/finance/credit-notes",
    query: z.object({ invoiceId: z.string().optional() }).passthrough(),
    responses: { 200: ok, 403: errorResponse },
    summary: "List credit notes for an invoice",
  },
  generateInvoices: {
    method: "POST",
    path: "/api/finance/invoices/generate",
    body: z.unknown(),
    responses: { 200: ok, 201: ok, 400: errorResponse, 403: errorResponse },
    summary: "Generate invoices in bulk",
  },
  listFeeStructures: {
    method: "GET",
    path: "/api/finance/fee-structures",
    responses: { 200: ok, 403: errorResponse },
    summary: "List fee structures",
  },
  putFeeStructure: {
    method: "PUT",
    path: "/api/finance/fee-structures",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Create or update a fee structure",
  },
  deleteFeeStructure: {
    method: "DELETE",
    path: "/api/finance/fee-structures/:id",
    pathParams: z.object({ id: z.string() }),
    body: z.unknown().optional(),
    responses: { 200: ok, 403: errorResponse, 404: errorResponse },
    summary: "Delete a fee structure",
  },
});
