import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  emptyQuerySchema,
  fxReportQuerySchema,
  fxReportResponseSchema,
  fxRevaluationRequestSchema,
  fxRevaluationRunResponseSchema,
  fxRevaluationRunsResponseSchema,
  type User,
} from "@mms/shared";
import { canManageAccounting, canReadCollection } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendValidated } from "../../../lib/validatedReply.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  postFxRevaluation,
  previewFxRevaluation,
} from "../../../accounting/use-cases/fxRevaluationUseCases.js";
import { buildFxReport } from "../../../accounting/use-cases/fxReportUseCases.js";
import {
  fxReportDeps,
  fxRevaluationDeps as deps,
} from "../../../accounting/use-cases/fxRevaluationDeps.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** IAS 21.23 period-end revaluation: history, preview and post (with auto-reversal). */
export const accountingFxRevaluationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/fx-revaluations", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(emptyQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query);
    const tenant = String(request.tenant?.id);
    try {
      const runs = await withTenant(tenant, () => deps.listRuns(tenant), { readOnly: true });
      return sendValidated(reply, 200, fxRevaluationRunsResponseSchema, { runs });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load FX revaluations", error)
      );
    }
  });

  fastify.get("/fx-report", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(fxReportQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed);
    const tenant = String(request.tenant?.id);
    try {
      const report = await withTenant(
        tenant,
        () => buildFxReport(fxReportDeps, tenant, parsed.data),
        {
          readOnly: true,
        },
      );
      return sendValidated(reply, 200, fxReportResponseSchema, { report });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to build the FX report", error)
      );
    }
  });

  fastify.post(
    "/fx-revaluations/preview",
    { config: { moduleAction: "read" } },
    async (request, reply) => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
      const parsed = parseRequest(fxRevaluationRequestSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed);
      const tenant = String(request.tenant?.id);
      try {
        const run = await withTenant(tenant, () =>
          previewFxRevaluation(deps, tenant, parsed.data.revaluationDate),
        );
        return sendValidated(reply, 200, fxRevaluationRunResponseSchema, { run });
      } catch (error) {
        return (
          sendIfHttpDomainError(reply, error) ??
          sendDatabaseError(reply, "Failed to preview FX revaluation", error)
        );
      }
    },
  );

  fastify.post(
    "/fx-revaluations",
    // Posts a ledger entry plus its next-day reversal: controller authority.
    { config: { moduleAction: "manage" } },
    async (request, reply) => {
      const user = request.user as User;
      if (!canManageAccounting(user)) return sendForbidden(reply);
      const parsed = parseRequest(fxRevaluationRequestSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed);
      const tenant = String(request.tenant?.id);
      try {
        const run = await withTenant(tenant, () =>
          postFxRevaluation(deps, { tenant, userId: String(user.id) }, parsed.data.revaluationDate),
        );
        return sendValidated(reply, 201, fxRevaluationRunResponseSchema, { run });
      } catch (error) {
        return (
          sendIfHttpDomainError(reply, error) ??
          sendDatabaseError(reply, "Failed to post FX revaluation", error)
        );
      }
    },
  );
};
