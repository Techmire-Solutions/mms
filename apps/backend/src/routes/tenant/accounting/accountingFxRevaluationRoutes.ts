import type { FastifyPluginAsync } from "fastify";
import { ACCOUNTING_MODULE_MANIFEST, fxRevaluationRequestSchema, type User } from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sendForbidden, sendIfHttpDomainError, sendDatabaseError } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  postFxRevaluation,
  previewFxRevaluation,
} from "../../../accounting/use-cases/fxRevaluationUseCases.js";
import { fxRevaluationDeps as deps } from "../../../accounting/use-cases/fxRevaluationDeps.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

/** IAS 21.23 period-end revaluation: history, preview and post (with auto-reversal). */
export const accountingFxRevaluationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/fx-revaluations", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const tenant = String(request.tenant?.id);
    try {
      const runs = await withTenant(tenant, () => deps.listRuns(tenant), { readOnly: true });
      return reply.send({ runs });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load FX revaluations", error)
      );
    }
  });

  fastify.post("/fx-revaluations/preview", { config: { moduleAction: "read" } }, async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(fxRevaluationRequestSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    try {
      const run = await withTenant(tenant, () =>
        previewFxRevaluation(deps, tenant, parsed.data.revaluationDate),
      );
      return reply.send({ run });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to preview FX revaluation", error)
      );
    }
  });

  fastify.post("/fx-revaluations", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(fxRevaluationRequestSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    try {
      const run = await withTenant(tenant, () =>
        postFxRevaluation(deps, { tenant, userId: String(user.id) }, parsed.data.revaluationDate),
      );
      return reply.status(201).send({ run });
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to post FX revaluation", error)
      );
    }
  });
};
