import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import {
  ACCOUNTING_MODULE_MANIFEST,
  hedgeDiscontinuationRequestSchema,
  hedgeListQuerySchema,
  hedgeReclassificationRequestSchema,
  hedgeRelationshipCreateSchema,
  hedgeRelationshipListResponseSchema,
  hedgeRelationshipResponseSchema,
  hedgeSettlementRequestSchema,
  hedgeValuationRequestSchema,
  hedgeValuationResponseSchema,
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
import { sendValidated } from "../../../lib/validatedReply.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  createHedgeRelationship,
  discontinueHedge,
  postHedgeValuation,
  previewHedgeValuation,
  reclassifyHedgeReserve,
  settleHedge,
} from "../../../accounting/use-cases/hedgeUseCases.js";
import { hedgeDeps as deps } from "../../../accounting/use-cases/hedgeDeps.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;
const DEFAULT_LIMIT = 100;

type Handler<T> = (input: {
  tenant: string;
  userId: string;
  id: string;
  body: T;
}) => Promise<unknown>;

/**
 * Every hedge write shares the gate, the body schema, the declared response
 * schema and the error mapping. `withId` adds the `:id` params check; designation
 * (`POST /hedges`) has no path parameter.
 */
function handleWrite<T>(
  bodySchema: ZodType<T>,
  responseSchema: ZodType,
  failure: string,
  status: 200 | 201,
  run: Handler<T>,
  withId = true,
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const user = request.user as User;
    if (!canWriteCollection(user, COLLECTION)) return sendForbidden(reply);
    // `:id` was read straight off `request.params` before; the shared params
    // schema bounds it and rejects a non-object params shape.
    const params = withId
      ? parseRequest(resourceIdParamsSchema, request.params)
      : ({ ok: true as const, data: { id: "" } } as const);
    if (!params.ok) return replyValidationError(reply, params);
    const parsed = parseRequest(bodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed);
    const tenant = String(request.tenant?.id);
    try {
      const result = await withTenant(
        tenant,
        () =>
          run({
            tenant,
            userId: String(user.id),
            id: params.data.id,
            body: parsed.data,
          }),
        { readOnly: false },
      );
      return sendValidated(reply, status, responseSchema, result);
    } catch (error) {
      return sendIfHttpDomainError(reply, error) ?? sendDatabaseError(reply, failure, error);
    }
  };
}

/**
 * IFRS 9 FX forward hedges: designate, value (with auto-reversal), settle,
 * discontinue prospectively (6.5.6) and reclassify the OCI reserve.
 */
export const accountingHedgeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/hedges", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const query = parseRequest(hedgeListQuerySchema, request.query ?? {});
    if (!query.ok) return replyValidationError(reply, query);
    const tenant = String(request.tenant?.id);
    try {
      const page = await withTenant(
        tenant,
        () => deps.store.listHedgeRelationshipsPage(tenant, query.data.limit ?? DEFAULT_LIMIT),
        { readOnly: true },
      );
      return sendValidated(reply, 200, hedgeRelationshipListResponseSchema, page);
    } catch (error) {
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load hedges", error)
      );
    }
  });

  fastify.post(
    "/hedges",
    handleWrite(
      hedgeRelationshipCreateSchema,
      hedgeRelationshipResponseSchema,
      "Failed to designate the hedge",
      201,
      async ({ tenant, userId, body }) => ({
        hedge: await createHedgeRelationship(deps, { tenant, userId }, body),
      }),
      false,
    ),
  );

  fastify.post(
    "/hedges/:id/valuations/preview",
    { config: { moduleAction: "read" } },
    async (request, reply) => {
      const user = request.user as User;
      if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
      const params = parseRequest(resourceIdParamsSchema, request.params);
      if (!params.ok) return replyValidationError(reply, params);
      const parsed = parseRequest(hedgeValuationRequestSchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed);
      const tenant = String(request.tenant?.id);
      try {
        const valuation = await withTenant(
          tenant,
          () => previewHedgeValuation(deps, tenant, params.data.id, parsed.data.valuationDate),
          { readOnly: true },
        );
        return sendValidated(reply, 200, hedgeValuationResponseSchema, { valuation });
      } catch (error) {
        return (
          sendIfHttpDomainError(reply, error) ??
          sendDatabaseError(reply, "Failed to preview the hedge valuation", error)
        );
      }
    },
  );

  fastify.post(
    "/hedges/:id/valuations",
    handleWrite(
      hedgeValuationRequestSchema,
      hedgeRelationshipResponseSchema,
      "Failed to post the hedge valuation",
      201,
      async ({ tenant, userId, id, body }) => ({
        hedge: await postHedgeValuation(deps, { tenant, userId }, id, body.valuationDate),
      }),
    ),
  );

  fastify.post(
    "/hedges/:id/settle",
    handleWrite(
      hedgeSettlementRequestSchema,
      hedgeRelationshipResponseSchema,
      "Failed to settle the hedge",
      201,
      async ({ tenant, userId, id, body }) => ({
        hedge: await settleHedge(deps, { tenant, userId }, id, body),
      }),
    ),
  );

  fastify.post(
    "/hedges/:id/discontinue",
    handleWrite(
      hedgeDiscontinuationRequestSchema,
      hedgeRelationshipResponseSchema,
      "Failed to discontinue the hedge",
      201,
      async ({ tenant, userId, id, body }) => ({
        hedge: await discontinueHedge(deps, { tenant, userId }, id, body),
      }),
    ),
  );

  fastify.post(
    "/hedges/:id/reclassify",
    handleWrite(
      hedgeReclassificationRequestSchema,
      hedgeRelationshipResponseSchema,
      "Failed to reclassify the hedge reserve",
      201,
      async ({ tenant, userId, id, body }) => ({
        hedge: await reclassifyHedgeReserve(deps, { tenant, userId }, id, body),
      }),
    ),
  );
};
