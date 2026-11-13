import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  closeFiscalYearBodySchema,
  reopenPostingPeriodBodySchema,
  closePostingPeriodBodySchema,
  emptyQuerySchema,
  fiscalYearParamsSchema,
  postingPeriodParamsSchema,
  postingPeriodsQuerySchema,
  openingBalancesQuerySchema,
  openingBalancesReplaceSchema,
  postingRulesUpdateSchema,
  resourceIdParamsSchema,
  fiscalYearCloseResponseSchema,
  openingBalancesPostedResponseSchema,
  openingBalancesResponseSchema,
  postingPeriodResponseSchema,
  postingPeriodsResponseSchema,
  postingRulesResponseSchema,
  type User,
} from "@mms/shared";
import {
  canManageAccounting,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendValidated } from "../../../lib/validatedReply.js";
import { withTenant } from "../../../db/tenant-context.js";
import { loadServerConfig } from "../../../config/serverConfig.js";
import {
  closeFiscalYear,
  closePostingPeriod,
  loadOpeningBalances,
  loadPostingPeriods,
  loadPostingRules,
  postOpeningBalances,
  reopenPostingPeriod,
  upsertOpeningBalances,
  upsertPostingRules,
} from "../../../accounting/use-cases/accountingLedgerOpsUseCases.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** Posting rules, period close, opening balances, bank reconciliation. */
export const accountingLedgerOpsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/posting-rules", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(emptyQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query);
    try {
      const rules = await withTenant(String(request.tenant?.id), () => loadPostingRules(), {
        readOnly: true,
      });
      return sendValidated(reply, 200, postingRulesResponseSchema, { rules });
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
      return sendValidated(reply, 200, postingRulesResponseSchema, { rules });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save posting rules", error)
      );
    }
  });

  fastify.post("/fiscal-years/:id/close", async (request, reply) => {
    const user = request.user as User;
    // Closing a year posts the closing entry and locks it: controller authority.
    if (!canManageAccounting(user)) return sendForbidden(reply);
    const params = parseRequest(resourceIdParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params);
    const body = parseRequest(closeFiscalYearBodySchema, request.body ?? {});
    if (!body.ok) return replyValidationError(reply, body);
    try {
      // A year-end close aggregates the whole year and posts the closing entry.
      // The global 30 s statement budget is too small for that aggregation, so the
      // close gets the full request budget and a short lock wait (a contended
      // fiscal-year lock fails fast as 409 instead of hanging for 30 s).
      const { requestTimeoutMs } = loadServerConfig();
      const fiscalYear = await withTenant(
        String(request.tenant?.id),
        () => closeFiscalYear(params.data.id, String(user.id), body.data.retainedEarningsAccountId),
        { readOnly: false, statementTimeoutMs: requestTimeoutMs, lockTimeoutMs: 15_000 },
      );
      return sendValidated(reply, 200, fiscalYearCloseResponseSchema, { fiscalYear });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to close fiscal year", error)
      );
    }
  });

  fastify.get("/posting-periods", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(postingPeriodsQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const periods = await withTenant(
        String(request.tenant?.id),
        () => loadPostingPeriods(parsed.data.fiscalYearId),
        { readOnly: true },
      );
      return sendValidated(reply, 200, postingPeriodsResponseSchema, { periods });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load posting periods", error)
      );
    }
  });

  fastify.post("/posting-periods/:id/close", async (request, reply) => {
    const user = request.user as User;
    if (!canManageAccounting(user)) return sendForbidden(reply);
    const params = parseRequest(postingPeriodParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params);
    const body = parseRequest(closePostingPeriodBodySchema, request.body ?? {});
    if (!body.ok) return replyValidationError(reply, body);
    try {
      const period = await withTenant(
        String(request.tenant?.id),
        () => closePostingPeriod(params.data.id, String(user.id), body.data.reason),
        { readOnly: false },
      );
      return sendValidated(reply, 200, postingPeriodResponseSchema, { period });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to close posting period", error)
      );
    }
  });

  fastify.post("/posting-periods/:id/reopen", async (request, reply) => {
    const user = request.user as User;
    if (!canManageAccounting(user)) return sendForbidden(reply);
    const params = parseRequest(postingPeriodParamsSchema, request.params);
    if (!params.ok) return replyValidationError(reply, params);
    const body = parseRequest(reopenPostingPeriodBodySchema, request.body ?? {});
    if (!body.ok) return replyValidationError(reply, body);
    try {
      const period = await withTenant(
        String(request.tenant?.id),
        () => reopenPostingPeriod(params.data.id, String(user.id), body.data.reason),
        { readOnly: false },
      );
      return sendValidated(reply, 200, postingPeriodResponseSchema, { period });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to reopen posting period", error)
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
      return sendValidated(reply, 200, openingBalancesResponseSchema, { balances });
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
      return sendValidated(reply, 200, openingBalancesResponseSchema, { balances });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to save opening balances", error)
      );
    }
  });

  fastify.post(
    "/opening-balances/:fiscalYearId/post",
    // Opening balances become a real ledger entry: controller authority.
    { config: { moduleAction: "manage" } },
    async (request, reply) => {
      const user = request.user as User;
      if (!canManageAccounting(user)) return sendForbidden(reply);
      const params = parseRequest(fiscalYearParamsSchema, request.params);
      if (!params.ok) return replyValidationError(reply, params);
      try {
        const outcome = await withTenant(
          String(request.tenant?.id),
          () => postOpeningBalances(params.data.fiscalYearId),
          { readOnly: false },
        );
        // `posted: false` = the balances were already posted unchanged.
        const posted = outcome.posted;
        return sendValidated(reply, 200, openingBalancesPostedResponseSchema, {
          success: true,
          posted,
        });
      } catch (error) {
        return (
          sendIfHttpDomainError(reply, error) ??
          sendDatabaseError(reply, "Failed to post opening balances", error)
        );
      }
    },
  );
};
