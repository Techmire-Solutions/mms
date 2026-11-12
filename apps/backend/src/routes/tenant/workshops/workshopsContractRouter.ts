import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import {
  isQueryFlagTrue,
  toWorkshopParticipantSummary,
  workshopsContract,
  WORKSHOPS_MODULE_MANIFEST,
} from "@mms/shared";
import { parseOccHeaders } from "../../../lib/occHeaders.js";
import { ValidationError } from "../../../lib/httpErrors.js";
import { buildBackgroundJobId, buildDeterministicJobKey } from "../../../lib/backgroundJobIds.js";
import {
  enqueueBackgroundJob,
  QueueUnavailableError,
} from "../../../services/backgroundJobEnqueue.js";
import { getUserBackgroundJob } from "../../../services/backgroundJobService.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { guarded } from "./workshopsRouteGuard.js";
import { canWriteCollection } from "../../../services/rbacService.js";
import { workshopsUseCases } from "../../../workshops/use-cases/workshopsUseCases.js";

type Contract = typeof workshopsContract;

const EVENTS = WORKSHOPS_MODULE_MANIFEST.collectionKey;
const PARTICIPANTS = WORKSHOPS_MODULE_MANIFEST.participantCollectionKey;
const ATTENDANCE = WORKSHOPS_MODULE_MANIFEST.attendanceCollectionKey;
const SCORES = WORKSHOPS_MODULE_MANIFEST.scoreCollectionKey;
const s = initServer();

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
        async (user) => ({
          status: 200 as const,
          body: await workshopsUseCases.getWorkshop(params.id, {
            // Contact details are operational data; read-only staff see names but not phones.
            includeContactDetails: canWriteCollection(user, PARTICIPANTS),
          }),
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
          // The use case owns the not-found decision; the controller only maps the success shape.
          await workshopsUseCases.deleteWorkshop(
            params.id,
            user.id ?? null,
            body?.deletionReason ?? null,
          );
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
    transitionWorkshop: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["transitionWorkshop"]>) =>
      guarded(
        request,
        // Publishing/unpublishing is a writer action; completing or cancelling the workshop is an
        // administrative one (`workshops.manage`, admin/principal by default).
        body.to === "completed" || body.to === "cancelled"
          ? { permission: "workshops.manage" }
          : { collection: EVENTS, access: "write" },
        "Failed to change the workshop lifecycle",
        async (user) => {
          const { expectedUpdatedAt, expectedVersion } = parseOccHeaders(request);
          if (expectedVersion !== undefined) {
            throw new ValidationError(
              "Workshops use x-expected-updated-at; x-expected-version is not supported",
            );
          }
          return {
            status: 200 as const,
            body: {
              workshop: await workshopsUseCases.transitionWorkshop(
                params.id,
                body,
                { id: user.id ?? null, label: user.name },
                expectedUpdatedAt,
              ),
            },
          };
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
          body: {
            participant: toWorkshopParticipantSummary(
              await workshopsUseCases.addParticipant(params.id, body.contactId),
            ),
          },
        }),
      ),
    importParticipants: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["importParticipants"]>) =>
      guarded(
        request,
        { collection: PARTICIPANTS, access: "write" },
        "Failed to queue the participant import",
        async (user) => {
          const tenant = String(request.tenant?.id ?? "");
          const userId = String(user.id ?? "");
          await workshopsUseCases.ensureWorkshop(params.id);
          const key = buildDeterministicJobKey({
            moduleId: "workshops",
            kind: "import",
            payload: { workshopId: params.id, contactIds: body.contactIds },
          });
          const jobId = buildBackgroundJobId(tenant, userId, key);
          const existing = await getUserBackgroundJob(userId, jobId, tenant);
          if (existing) return { status: 202 as const, body: { job: existing } };
          try {
            const job = await enqueueBackgroundJob(
              tenant,
              userId,
              {
                id: jobId,
                moduleId: "workshops",
                kind: "import",
                status: "running",
                label: "Importing workshop participants…",
                createdAt: new Date().toISOString(),
              },
              { workshopId: params.id, contactIds: body.contactIds },
            );
            return { status: 202 as const, body: { job } };
          } catch (error) {
            if (error instanceof QueueUnavailableError) {
              return {
                status: 503 as const,
                body: { type: "service_unavailable", message: error.message },
              };
            }
            throw error;
          }
        },
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
          const promoted = await workshopsUseCases.removeParticipant(
            params.id,
            params.participantId,
            user.id ?? null,
          );
          return {
            status: 200 as const,
            body: {
              success: true as const,
              promoted: promoted ? toWorkshopParticipantSummary(promoted) : null,
            },
          };
        },
      ),
    addParticipants: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["addParticipants"]>) =>
      guarded(
        request,
        { collection: PARTICIPANTS, access: "write" },
        "Failed to register the participants",
        async () => {
          const result = await workshopsUseCases.addParticipants(params.id, body.contactIds);
          return {
            status: 201 as const,
            body: {
              added: result.added.map(toWorkshopParticipantSummary),
              waitlisted: result.waitlisted.map(toWorkshopParticipantSummary),
            },
          };
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
    // Declared response schemas are the wire contract — validate them at runtime.
    responseValidation: true,
  });
};
