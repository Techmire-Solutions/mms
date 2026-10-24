import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import {
  isQueryFlagTrue,
  workshopsContract,
  WORKSHOPS_MODULE_MANIFEST,
  type User,
} from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { HttpDomainError } from "../../../lib/httpErrors.js";
import { runWithTenant } from "../../../lib/tenantContext.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { workshopsUseCases } from "../../../workshops/use-cases/workshopsUseCases.js";

type Contract = typeof workshopsContract;
type AnyRequest = ContractRouteArgs<Contract["listWorkshops"]>["request"];
type Access = "read" | "write" | "delete";

const EVENTS = WORKSHOPS_MODULE_MANIFEST.collectionKey;
const PARTICIPANTS = WORKSHOPS_MODULE_MANIFEST.participantCollectionKey;
const ATTENDANCE = WORKSHOPS_MODULE_MANIFEST.attendanceCollectionKey;
const SCORES = WORKSHOPS_MODULE_MANIFEST.scoreCollectionKey;

const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};
const s = initServer();

function allowed(user: User, collection: string, access: Access): boolean {
  if (access === "read") return canReadCollection(user, collection);
  if (access === "write") return canWriteCollection(user, collection);
  return canDeleteCollection(user, collection);
}

/**
 * Permission check → tenant-bound use-case call → domain errors (400/404/409) keep their
 * status, anything else is logged and becomes a 500 with `failure`.
 */
async function guarded<T>(
  request: AnyRequest,
  rule: { collection: string; access: Access },
  failure: string,
  work: (user: User) => Promise<T>,
): Promise<T | typeof forbidden | { status: number; body: { type: string; message: string } }> {
  const user = request.user as User;
  if (!allowed(user, rule.collection, rule.access)) return forbidden;
  try {
    return await runWithTenant(String(request.tenant?.id ?? ""), () => work(user));
  } catch (error) {
    if (error instanceof HttpDomainError) {
      return { status: error.statusCode, body: { type: error.type, message: error.message } };
    }
    return handleContractError(request, error, {
      status: 500,
      body: { type: "server_error", message: failure },
    });
  }
}

/** `/api/workshops` — events, registration, per-day check-in and scores. */
export const workshopsContractRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(workshopsContract, {
    listWorkshops: async ({ query, request }: ContractRouteArgs<Contract["listWorkshops"]>) => {
      const trash = isQueryFlagTrue(query?.includeDeleted);
      return guarded(
        request,
        { collection: EVENTS, access: trash ? "delete" : "read" },
        "Failed to list workshops",
        async () => ({
          status: 200 as const,
          body: await workshopsUseCases.listWorkshops({ ...query, includeDeleted: trash }),
        }),
      );
    },
    getWorkshop: async ({ params, request }: ContractRouteArgs<Contract["getWorkshop"]>) =>
      guarded(
        request,
        { collection: EVENTS, access: "read" },
        "Failed to load the workshop",
        async () => ({
          status: 200 as const,
          body: await workshopsUseCases.getWorkshop(params.id),
        }),
      ),
    createWorkshop: async ({ body, request }: ContractRouteArgs<Contract["createWorkshop"]>) =>
      guarded(
        request,
        { collection: EVENTS, access: "write" },
        "Failed to create the workshop",
        async () => ({
          status: 201 as const,
          body: { workshop: await workshopsUseCases.createWorkshop(body) },
        }),
      ),
    updateWorkshop: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["updateWorkshop"]>) =>
      guarded(
        request,
        { collection: EVENTS, access: "write" },
        "Failed to update the workshop",
        async () => ({
          status: 200 as const,
          body: { workshop: await workshopsUseCases.updateWorkshop(params.id, body) },
        }),
      ),
    deleteWorkshop: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["deleteWorkshop"]>) =>
      guarded(
        request,
        { collection: EVENTS, access: "delete" },
        "Failed to delete the workshop",
        async (user) => {
          const result = await workshopsUseCases.deleteWorkshops(
            [params.id],
            user.id ?? null,
            body?.deletionReason ?? null,
          );
          if (result.succeeded === 0) {
            return {
              status: 404 as const,
              body: { type: "not_found", message: "Workshop not found" },
            };
          }
          return { status: 200 as const, body: { success: true as const } };
        },
      ),
    restoreWorkshop: async ({ params, request }: ContractRouteArgs<Contract["restoreWorkshop"]>) =>
      guarded(
        request,
        { collection: EVENTS, access: "delete" },
        "Failed to restore the workshop",
        async (user) => {
          await workshopsUseCases.restoreWorkshop(params.id, user.id ?? null);
          return { status: 200 as const, body: { success: true as const } };
        },
      ),
    bulkDeleteWorkshops: async ({
      body,
      request,
    }: ContractRouteArgs<Contract["bulkDeleteWorkshops"]>) =>
      guarded(
        request,
        { collection: EVENTS, access: "delete" },
        "Failed to delete workshops",
        async (user) => {
          const result = await workshopsUseCases.deleteWorkshops(body.ids, user.id ?? null, null);
          return { status: 200 as const, body: { success: true as const, ...result } };
        },
      ),
    addParticipant: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["addParticipant"]>) =>
      guarded(
        request,
        { collection: PARTICIPANTS, access: "write" },
        "Failed to register the participant",
        async () => ({
          status: 201 as const,
          body: { participant: await workshopsUseCases.addParticipant(params.id, body.contactId) },
        }),
      ),
    removeParticipant: async ({
      params,
      request,
    }: ContractRouteArgs<Contract["removeParticipant"]>) =>
      guarded(
        request,
        { collection: PARTICIPANTS, access: "delete" },
        "Failed to withdraw the participant",
        async (user) => {
          await workshopsUseCases.removeParticipant(
            params.id,
            params.participantId,
            user.id ?? null,
          );
          return { status: 200 as const, body: { success: true as const } };
        },
      ),
    saveAttendanceDay: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["saveAttendanceDay"]>) =>
      guarded(
        request,
        { collection: ATTENDANCE, access: "write" },
        "Failed to save check-ins",
        async (user) => ({
          status: 200 as const,
          body: {
            attendance: await workshopsUseCases.saveAttendanceDay(params.id, body, user.id ?? null),
          },
        }),
      ),
    saveScores: async ({ params, body, request }: ContractRouteArgs<Contract["saveScores"]>) =>
      guarded(
        request,
        { collection: SCORES, access: "write" },
        "Failed to save scores",
        async () => ({
          status: 200 as const,
          body: { scores: await workshopsUseCases.saveScores(params.id, body) },
        }),
      ),
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
