import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { workshopsCompletionContract, WORKSHOPS_MODULE_MANIFEST } from "@mms/shared";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { guarded } from "./workshopsRouteGuard.js";
import { workshopsCompletionUseCases as useCases } from "../../../workshops/use-cases/workshopsCompletionUseCases.js";

type Contract = typeof workshopsCompletionContract;

const {
  collectionKey: EVENTS,
  participantCollectionKey: PARTICIPANTS,
  permissions,
} = WORKSHOPS_MODULE_MANIFEST;
const s = initServer();

/**
 * `/api/workshops` — completion, participation certificates, Reports and Setup defaults.
 * Defaults are readable by anyone who can read workshops (the create form prefills them);
 * only `setupWrite` may change them.
 */
export const workshopsCompletionRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(workshopsCompletionContract, {
    getCompletion: async ({ params, request }: ContractRouteArgs<Contract["getCompletion"]>) =>
      guarded(
        request,
        { collection: PARTICIPANTS, access: "read" },
        "Failed to load completion",
        async () => ({
          status: 200 as const,
          body: { rows: await useCases.getCompletion(params.id) },
        }),
      ),
    evaluateCompletion: async ({
      params,
      request,
    }: ContractRouteArgs<Contract["evaluateCompletion"]>) =>
      guarded(
        request,
        { collection: PARTICIPANTS, access: "write" },
        "Failed to evaluate completion",
        async () => ({
          status: 200 as const,
          body: { rows: await useCases.evaluateCompletion(params.id) },
        }),
      ),
    issueCertificates: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["issueCertificates"]>) =>
      guarded(
        request,
        { collection: PARTICIPANTS, access: "write" },
        "Failed to issue certificates",
        async () => ({
          status: 200 as const,
          body: await useCases.issueCertificates(params.id, body),
        }),
      ),
    getReport: async ({ request }: ContractRouteArgs<Contract["getReport"]>) =>
      guarded(
        request,
        { permission: permissions.reports },
        "Failed to load the workshops report",
        async () => ({
          status: 200 as const,
          body: { rows: await useCases.getReport() },
        }),
      ),
    getPreferences: async ({ request }: ContractRouteArgs<Contract["getPreferences"]>) =>
      guarded(
        request,
        { collection: EVENTS, access: "read" },
        "Failed to load workshop settings",
        async () => ({
          status: 200 as const,
          body: await useCases.getPreferences(),
        }),
      ),
    savePreferences: async ({ body, request }: ContractRouteArgs<Contract["savePreferences"]>) =>
      guarded(
        request,
        { permission: permissions.setupWrite },
        "Failed to save workshop settings",
        async () => ({
          status: 200 as const,
          body: await useCases.savePreferences(body),
        }),
      ),
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
