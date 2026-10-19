import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { SESSIONS_MODULE_MANIFEST, sessionCompletionContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sessionCompletionUseCases as completion } from "../../../sessions/use-cases/sessionCompletionUseCases.js";

type Contract = typeof sessionCompletionContract;
type Request = Parameters<typeof handleContractError>[0];
const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;
const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};
const s = initServer();
const tenantOf = (request: Request) => String(request.tenant?.id ?? "");
const fail = (request: Request, error: unknown, message: string) =>
  handleContractError(request, error, { status: 500, body: { type: "server_error", message } });

/** `/api/sessions/:id/completion{,/evaluate,/certificates}` — short-course completion (Phase 11). */
export const sessionCompletionRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(sessionCompletionContract, {
    list: async ({ params, request }: ContractRouteArgs<Contract["list"]>) => {
      if (!canReadCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { rows: await completion.list(tenantOf(request), params.id) },
        };
      } catch (error) {
        return fail(request, error, "Failed to load completion");
      }
    },
    evaluate: async ({ params, request }: ContractRouteArgs<Contract["evaluate"]>) => {
      if (!canWriteCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { rows: await completion.evaluate(tenantOf(request), params.id) },
        };
      } catch (error) {
        return fail(request, error, "Failed to evaluate completion");
      }
    },
    certificates: async ({
      params,
      body,
      request,
    }: ContractRouteArgs<Contract["certificates"]>) => {
      if (!canWriteCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: await completion.issueCertificates(tenantOf(request), params.id, body),
        };
      } catch (error) {
        return fail(request, error, "Failed to issue certificates");
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
