import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  bankReconciliationMatchSchema,
  bankStatementInsertSchema,
  closeFiscalYearBodySchema,
  fiscalYearParamsSchema,
  openingBalancesQuerySchema,
  openingBalancesReplaceSchema,
  postingRulesUpdateSchema,
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
  closeFiscalYear,
  loadBankStatements,
  loadOpeningBalances,
  loadPostingRules,
  matchBankStatementLine,
  postOpeningBalances,
  upsertBankStatement,
  upsertOpeningBalances,
  upsertPostingRules,
} from "../../../accounting/use-cases/accountingLedgerOpsUseCases.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** Posting rules, period close, opening balances, bank reconciliation. */
export const accountingLedgerOpsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/posting-rules", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    try {
      const rules = await withTenant(String(request.tenant?.id), () => loadPostingRules(), {
        readOnly: true,
      });
      return reply.send({ rules });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load posting rules", error)
      );
    }
  });

  fastify.put("/posting-rules", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(postingRulesUpdateSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const rules = await withTenant(
        String(request.tenant?.id),
        () => upsertPostingRules(parsed.data),
        { readOnly: false },
      );
      return reply.send({ rules });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save posting rules", error)
      );
    }
  });

  fastify.post("/fiscal-years/:id/close", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    const body = parseRequest(closeFiscalYearBodySchema, request.body ?? {});
    if (!body.ok) return replyValidationError(reply, body.message);
    try {
      const fiscalYear = await withTenant(
        String(request.tenant?.id),
        () => closeFiscalYear(params.data.id, String(user.id), body.data.retainedEarningsAccountId),
        { readOnly: false },
      );
      return reply.send({ fiscalYear });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to close fiscal year", error)
      );
    }
  });

  fastify.get("/opening-balances", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(openingBalancesQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const balances = await withTenant(
        String(request.tenant?.id),
        () => loadOpeningBalances(parsed.data.fiscalYearId),
        {
          readOnly: true,
        },
      );
      return reply.send({ balances });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load opening balances", error)
      );
    }
  });

  fastify.put("/opening-balances", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(openingBalancesReplaceSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const balances = await withTenant(
        String(request.tenant?.id),
        () => upsertOpeningBalances(parsed.data.fiscalYearId, parsed.data.balances),
        { readOnly: false },
      );
      return reply.send({ balances });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save opening balances", error)
      );
    }
  });

  fastify.post("/opening-balances/:fiscalYearId/post", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const params = parseRequest(fiscalYearParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params.message);
    try {
      const outcome = await withTenant(
        String(request.tenant?.id),
        () => postOpeningBalances(params.data.fiscalYearId),
        { readOnly: false },
      );
      // `posted: false` = the balances were already posted unchanged.
      return reply.send({ success: true, posted: outcome.posted });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to post opening balances", error)
      );
    }
  });

  fastify.get("/bank-statements", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    try {
      const statements = await withTenant(String(request.tenant?.id), () => loadBankStatements(), {
        readOnly: true,
      });
      return reply.send({ statements });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load bank statements", error)
      );
    }
  });

  fastify.put("/bank-statements", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(bankStatementInsertSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const statement = await withTenant(
        String(request.tenant?.id),
        () => upsertBankStatement(parsed.data),
        {
          readOnly: false,
        },
      );
      return reply.send({ statement });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save bank statement", error)
      );
    }
  });

  fastify.post("/bank-reconciliations", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(bankReconciliationMatchSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      await withTenant(String(request.tenant?.id), () => matchBankStatementLine(parsed.data), {
        readOnly: false,
      });
      return reply.send({ success: true });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to match bank line", error)
      );
    }
  });
};
