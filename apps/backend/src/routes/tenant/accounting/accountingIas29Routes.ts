import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { ZodType } from "zod";
import {
  ACCOUNTING_MODULE_MANIFEST,
  emptyQuerySchema,
  hyperinflationSettingsResponseSchema,
  hyperinflationSettingsSchema,
  ias29RequestSchema,
  ias29RunResponseSchema,
  ias29RunsResponseSchema,
  priceIndexPutSchema,
  priceIndicesResponseSchema,
  type User,
} from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import {
  sendForbidden,
  sendIfHttpDomainError,
  sendDatabaseError,
} from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendValidated } from "../../../lib/validatedReply.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  postIas29Restatement,
  previewIas29Restatement,
  savePriceIndices,
  updateHyperinflationSettings,
} from "../../../accounting/use-cases/ias29UseCases.js";
import { ias29Deps as deps } from "../../../accounting/use-cases/ias29Deps.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;
const SETUP_WRITE = { moduleAction: "setupWrite" } as const;

async function respond<T, R>(
  reply: FastifyReply,
  failure: string,
  work: () => Promise<T>,
  schema: ZodType<R>,
  wrap: (result: T) => unknown,
  status: 200 | 201 = 200,
): Promise<FastifyReply> {
  try {
    return sendValidated(reply, status, schema, wrap(await work()));
  } catch (error) {
    return sendIfHttpDomainError(reply, error) ?? sendDatabaseError(reply, failure, error);
  }
}

/** IAS 29 hyperinflation: settings, general price index, and restatement runs (with auto-reversal). */
export const accountingIas29Routes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/hyperinflation-settings", async (request, reply) => {
    if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(emptyQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to load hyperinflation settings",
      () =>
        withTenant(tenant, () => deps.store.getHyperinflationSettings(tenant), { readOnly: true }),
      hyperinflationSettingsResponseSchema,
      (settings) => ({ settings }),
    );
  });

  fastify.put("/hyperinflation-settings", { config: SETUP_WRITE }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(hyperinflationSettingsSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to save hyperinflation settings",
      () =>
        withTenant(tenant, () =>
          updateHyperinflationSettings(deps, { tenant, userId: String(user.id) }, parsed.data),
        ),
      hyperinflationSettingsResponseSchema,
      (settings) => ({ settings }),
    );
  });

  fastify.get("/price-indices", async (request, reply) => {
    if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(emptyQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to load price indices",
      () => withTenant(tenant, () => deps.store.listPriceIndices(tenant), { readOnly: true }),
      priceIndicesResponseSchema,
      (points) => ({ points }),
    );
  });

  fastify.put("/price-indices", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(priceIndexPutSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to save price indices",
      () =>
        withTenant(tenant, () =>
          savePriceIndices(deps, { tenant, userId: String(user.id) }, parsed.data.points),
        ),
      priceIndicesResponseSchema,
      (points) => ({ points }),
    );
  });

  fastify.get("/ias29-restatements", async (request, reply) => {
    if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(emptyQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to load IAS 29 restatements",
      () => withTenant(tenant, () => deps.store.listIas29Runs(tenant), { readOnly: true }),
      ias29RunsResponseSchema,
      (runs) => ({ runs }),
    );
  });

  fastify.post(
    "/ias29-restatements/preview",
    { config: { moduleAction: "read" } },
    async (request, reply) => {
      if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
      const parsed = parseRequest(ias29RequestSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed);
      const tenant = String(request.tenant?.id);
      return respond(
        reply,
        "Failed to preview IAS 29 restatement",
        () =>
          withTenant(tenant, () =>
            previewIas29Restatement(deps, tenant, parsed.data.restatementDate),
          ),
        ias29RunResponseSchema,
        (run) => ({ run }),
      );
    },
  );

  fastify.post("/ias29-restatements", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(ias29RequestSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to post IAS 29 restatement",
      () =>
        withTenant(tenant, () =>
          postIas29Restatement(
            deps,
            { tenant, userId: String(user.id) },
            parsed.data.restatementDate,
          ),
        ),
      ias29RunResponseSchema,
      (run) => ({ run }),
      201,
    );
  });
};
