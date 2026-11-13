import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { accountingErrorEnvelopeSchema } from "../finance/accountingErrorCodes.js";
import {
  bankReconciliationMatchSchema,
  bankStatementInsertSchema,
  closePostingPeriodBodySchema,
  closeFiscalYearBodySchema,
  openingBalancesQuerySchema,
  openingBalancesReplaceSchema,
  postingPeriodsQuerySchema,
  postingRulesUpdateSchema,
  reopenPostingPeriodBodySchema,
} from "../finance/accountingLedgerOps.js";
import { specializedEntrySchema } from "../finance/accountingSpecializedEntries.js";
import { journalReversalRequestSchema } from "../finance/accountingJournalReversal.js";
import {
  voucherNumberingQuerySchema,
  voucherNumberingUpdateSchema,
} from "../finance/accountingVoucherNumbering.js";
import { emptyQuerySchema } from "../core/apiSchemas.js";
import { resourceIdParamsSchema } from "../schemas/api.dto.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = accountingErrorEnvelopeSchema;
const idParams = resourceIdParamsSchema;

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
    query: emptyQuerySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 500: errorResponse },
    summary: "Get posting rules",
  },
  putPostingRules: {
    method: "PUT",
    path: "/api/accounting/posting-rules",
    body: postingRulesUpdateSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Save posting rules",
  },
  closeFiscalYear: {
    method: "POST",
    path: "/api/accounting/fiscal-years/:id/close",
    pathParams: idParams,
    body: closeFiscalYearBodySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Close a fiscal year",
  },
  listOpeningBalances: {
    method: "GET",
    path: "/api/accounting/opening-balances",
    query: openingBalancesQuerySchema,
    responses: { 200: ok, 403: errorResponse },
    summary: "List opening balances for a fiscal year",
  },
  putOpeningBalances: {
    method: "PUT",
    path: "/api/accounting/opening-balances",
    body: openingBalancesReplaceSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Replace opening balances for a fiscal year",
  },
  postOpeningBalances: {
    method: "POST",
    path: "/api/accounting/opening-balances/:fiscalYearId/post",
    pathParams: z.object({ fiscalYearId: z.string().trim().min(1) }).strict(),
    body: z.object({}).strict().optional(),
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Post opening balances",
  },
  listPostingPeriods: {
    method: "GET",
    path: "/api/accounting/posting-periods",
    query: postingPeriodsQuerySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "List posting periods for a fiscal year",
  },
  closePostingPeriod: {
    method: "POST",
    path: "/api/accounting/posting-periods/:id/close",
    pathParams: idParams,
    body: closePostingPeriodBodySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Close a posting period",
  },
  reopenPostingPeriod: {
    method: "POST",
    path: "/api/accounting/posting-periods/:id/reopen",
    pathParams: idParams,
    body: reopenPostingPeriodBodySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Reopen a posting period",
  },
  listBankStatements: {
    method: "GET",
    path: "/api/accounting/bank-statements",
    query: emptyQuerySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "List bank statements",
  },
  putBankStatement: {
    method: "PUT",
    path: "/api/accounting/bank-statements",
    body: bankStatementInsertSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Save a bank statement",
  },
  matchBankReconciliation: {
    method: "POST",
    path: "/api/accounting/bank-reconciliations",
    body: bankReconciliationMatchSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Save a bank reconciliation match",
  },
  processSpecializedEntry: {
    method: "POST",
    path: "/api/accounting/specialized-entries",
    body: specializedEntrySchema,
    responses: { 200: ok, 201: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Post a fee/salary specialized entry",
  },
  reverseJournalEntry: {
    method: "POST",
    path: "/api/accounting/entries/:id/reverse",
    pathParams: idParams,
    body: journalReversalRequestSchema,
    responses: {
      200: ok,
      400: errorResponse,
      403: errorResponse,
      409: errorResponse,
      422: errorResponse,
    },
    summary: "Post a reversing journal entry",
  },
  seedDefaultChart: {
    method: "POST",
    path: "/api/accounting/accounts/seed-default",
    body: z.object({}).strict().optional(),
    responses: { 200: ok, 201: ok, 403: errorResponse, 409: errorResponse },
    summary: "Seed the default chart of accounts",
  },
  getVoucherNumbering: {
    method: "GET",
    path: "/api/accounting/voucher-numbering",
    query: voucherNumberingQuerySchema,
    responses: { 200: ok, 403: errorResponse },
    summary: "Get voucher numbering + next number",
  },
  putVoucherNumbering: {
    method: "PUT",
    path: "/api/accounting/voucher-numbering",
    body: voucherNumberingUpdateSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Save voucher numbering",
  },
});
