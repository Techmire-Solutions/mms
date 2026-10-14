import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const idParams = z.object({ id: z.string() });

/**
 * Accounting ledger-ops routes (posting rules, opening balances, bank statements /
 * reconciliations, specialized entries, reversals, chart seeding, voucher numbering).
 *
 * Served by plain Fastify plugins in the backend — kept in their own contract
 * (like the contacts domain's crud/setup/google-sync split) because `accountingContract`
 * is consumed wholesale by the backend's ts-rest router. Responses stay `unknown`
 * (widened client, ADR-010).
 */
export const accountingLedgerContract = c.router({
  getPostingRules: {
    method: "GET",
    path: "/api/accounting/posting-rules",
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "Get posting rules",
  },
  putPostingRules: {
    method: "PUT",
    path: "/api/accounting/posting-rules",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Save posting rules",
  },
  closeFiscalYear: {
    method: "POST",
    path: "/api/accounting/fiscal-years/:id/close",
    pathParams: idParams,
    body: z.unknown().optional(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Close a fiscal year",
  },
  listOpeningBalances: {
    method: "GET",
    path: "/api/accounting/opening-balances",
    query: z.object({ fiscalYearId: z.string().optional() }).passthrough(),
    responses: { 200: ok, 403: errorResponse },
    summary: "List opening balances for a fiscal year",
  },
  putOpeningBalances: {
    method: "PUT",
    path: "/api/accounting/opening-balances",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Replace opening balances for a fiscal year",
  },
  postOpeningBalances: {
    method: "POST",
    path: "/api/accounting/opening-balances/:fiscalYearId/post",
    pathParams: z.object({ fiscalYearId: z.string() }),
    body: z.unknown().optional(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Post opening balances",
  },
  listBankStatements: {
    method: "GET",
    path: "/api/accounting/bank-statements",
    responses: { 200: ok, 403: errorResponse },
    summary: "List bank statements",
  },
  putBankStatement: {
    method: "PUT",
    path: "/api/accounting/bank-statements",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Save a bank statement",
  },
  matchBankReconciliation: {
    method: "POST",
    path: "/api/accounting/bank-reconciliations",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Save a bank reconciliation match",
  },
  processSpecializedEntry: {
    method: "POST",
    path: "/api/accounting/specialized-entries",
    body: z.unknown(),
    responses: { 200: ok, 201: ok, 400: errorResponse, 403: errorResponse },
    summary: "Post a fee/salary specialized entry",
  },
  reverseJournalEntry: {
    method: "POST",
    path: "/api/accounting/entries/:id/reverse",
    pathParams: idParams,
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 409: errorResponse },
    summary: "Post a reversing journal entry",
  },
  seedDefaultChart: {
    method: "POST",
    path: "/api/accounting/accounts/seed-default",
    body: z.unknown().optional(),
    responses: { 200: ok, 201: ok, 403: errorResponse, 409: errorResponse },
    summary: "Seed the default chart of accounts",
  },
  getVoucherNumbering: {
    method: "GET",
    path: "/api/accounting/voucher-numbering",
    query: z.object({ date: z.string().optional() }).passthrough(),
    responses: { 200: ok, 403: errorResponse },
    summary: "Get voucher numbering + next number",
  },
  putVoucherNumbering: {
    method: "PUT",
    path: "/api/accounting/voucher-numbering",
    body: z.unknown(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Save voucher numbering",
  },
});
