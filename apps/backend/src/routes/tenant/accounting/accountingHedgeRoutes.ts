import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z, type ZodType } from "zod";
import {
  ACCOUNTING_MODULE_MANIFEST,
  hedgeReclassificationRequestSchema,
  hedgeRelationshipCreateSchema,
  hedgeSettlementRequestSchema,
  hedgeValuationRequestSchema,
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
  createHedgeRelationship,
  postHedgeValuation,
  previewHedgeValuation,
  reclassifyHedgeReserve,
  settleHedge,
} from "../../../accounting/use-cases/hedgeUseCases.js";
import { hedgeDeps as deps } from "../../../accounting/use-cases/hedgeDeps.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.collectionKey;

type Access = "list" | "read" | "write";
type Handler<T> = (input: {
  tenant: string;
  userId: string;
  id: string;
  body: T;
}) => Promise<unknown>;

/** Gate, parse, run in one tenant transaction, and map domain errors — shared by every hedge endpoint. */
function handle<T>(access: Access, schema: ZodType<T>, failure: string, status: 200 | 201, run: Handler<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const user = request.user as User;
    const allowed = access === "write" ? canWriteCollection(user, COLLECTION) : canReadCollection(user, COLLECTION);
    if (!allowed) return sendForbidden(reply);
    const parsed = parseRequest(schema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const body = parsed.data;
    const tenant = String(request.tenant?.id);
    const id = String((request.params as { id?: string }).id ?? "");
    try {
      const result = await withTenant(
        tenant,
        () => run({ tenant, userId: String(user.id), id, body }),
        {
          readOnly: access === "list",
        },
      );
      return reply.status(status).send(result);
    } catch (error) {
      return sendIfHttpDomainError(reply, error) ?? sendDatabaseError(reply, failure, error);
    }
  };
}

/** IFRS 9 FX forward hedges: designate, value (with auto-reversal), settle and reclassify. */
export const accountingHedgeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/hedges",
    handle("list", z.unknown(), "Failed to load hedges", 200, async ({ tenant }) => ({
      hedges: await deps.store.listHedgeRelationships(tenant),
    })),
  );

  fastify.post(
    "/hedges",
    handle(
      "write",
      hedgeRelationshipCreateSchema,
      "Failed to designate the hedge",
      201,
      async ({ tenant, userId, body }) => ({
        hedge: await createHedgeRelationship(deps, { tenant, userId }, body),
      }),
    ),
  );

  fastify.post(
    "/hedges/:id/valuations/preview",
    { config: { moduleAction: "read" } },
    handle(
      "read",
      hedgeValuationRequestSchema,
      "Failed to preview the hedge valuation",
      200,
      async ({ tenant, id, body }) => ({
        valuation: await previewHedgeValuation(deps, tenant, id, body.valuationDate),
      }),
    ),
  );

  fastify.post(
    "/hedges/:id/valuations",
    handle(
      "write",
      hedgeValuationRequestSchema,
      "Failed to post the hedge valuation",
      201,
      async ({ tenant, userId, id, body }) => ({
        hedge: await postHedgeValuation(deps, { tenant, userId }, id, body.valuationDate),
      }),
    ),
  );

  fastify.post(
    "/hedges/:id/settle",
    handle(
      "write",
      hedgeSettlementRequestSchema,
      "Failed to settle the hedge",
      201,
      async ({ tenant, userId, id, body }) => ({
        hedge: await settleHedge(deps, { tenant, userId }, id, body),
      }),
    ),
  );

  fastify.post(
    "/hedges/:id/reclassify",
    handle(
      "write",
      hedgeReclassificationRequestSchema,
      "Failed to reclassify the hedge reserve",
      201,
      async ({ tenant, userId, id, body }) => ({
        hedge: await reclassifyHedgeReserve(deps, { tenant, userId }, id, body),
      }),
    ),
  );
};
