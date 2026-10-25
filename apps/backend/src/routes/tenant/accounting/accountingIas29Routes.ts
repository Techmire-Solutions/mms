import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  hyperinflationSettingsSchema,
  ias29RequestSchema,
  priceIndexPutSchema,
  type User,
} from "@mms/shared";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sendForbidden, sendIfHttpDomainError, sendDatabaseError } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
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

async function respond<T>(
  reply: FastifyReply,
  failure: string,
  work: () => Promise<T>,
  send: (result: T) => FastifyReply,
): Promise<FastifyReply> {
  try {
    return send(await work());
  } catch (error) {
    return sendIfHttpDomainError(reply, error) ?? sendDatabaseError(reply, failure, error);
  }
}

/** IAS 29 hyperinflation: settings, general price index, and restatement runs (with auto-reversal). */
export const accountingIas29Routes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/hyperinflation-settings", async (request, reply) => {
    if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to load hyperinflation settings",
      () => withTenant(tenant, () => deps.store.getHyperinflationSettings(tenant), { readOnly: true }),
      (settings) => reply.send({ settings }),
    );
  });

  fastify.put("/hyperinflation-settings", { config: SETUP_WRITE }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(hyperinflationSettingsSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to save hyperinflation settings",
      () =>
        withTenant(tenant, () =>
          updateHyperinflationSettings(deps, { tenant, userId: String(user.id) }, parsed.data),
        ),
      (settings) => reply.send({ settings }),
    );
  });

  fastify.get("/price-indices", async (request, reply) => {
    if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to load price indices",
      () => withTenant(tenant, () => deps.store.listPriceIndices(tenant), { readOnly: true }),
      (points) => reply.send({ points }),
    );
  });

  fastify.put("/price-indices", { config: SETUP_WRITE }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(priceIndexPutSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to save price indices",
      () =>
        withTenant(tenant, () => savePriceIndices(deps, { tenant, userId: String(user.id) }, parsed.data.points)),
      (points) => reply.send({ points }),
    );
  });

  fastify.get("/ias29-restatements", async (request, reply) => {
    if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to load IAS 29 restatements",
      () => withTenant(tenant, () => deps.store.listIas29Runs(tenant), { readOnly: true }),
      (runs) => reply.send({ runs }),
    );
  });

  fastify.post("/ias29-restatements/preview", { config: { moduleAction: "read" } }, async (request, reply) => {
    if (!canReadCollection(request.user as User, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(ias29RequestSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to preview IAS 29 restatement",
      () => withTenant(tenant, () => previewIas29Restatement(deps, tenant, parsed.data.restatementDate)),
      (run) => reply.send({ run }),
    );
  });

  fastify.post("/ias29-restatements", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(ias29RequestSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = String(request.tenant?.id);
    return respond(
      reply,
      "Failed to post IAS 29 restatement",
      () =>
        withTenant(tenant, () =>
          postIas29Restatement(deps, { tenant, userId: String(user.id) }, parsed.data.restatementDate),
        ),
      (run) => reply.status(201).send({ run }),
    );
  });
};
