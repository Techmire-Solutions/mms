import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { SESSIONS_MODULE_MANIFEST, sessionLifecycleOpsContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sessionLifecycleOpsUseCases as ops } from "../../../sessions/use-cases/sessionLifecycleOpsUseCases.js";

type Contract = typeof sessionLifecycleOpsContract;
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

/** `/api/sessions/:id/{cancel,postpone,activity}` — session lifecycle actions (Phase 9e). */
export const sessionLifecycleOpsRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(sessionLifecycleOpsContract, {
    cancel: async ({ params, body, request }: ContractRouteArgs<Contract["cancel"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: await ops.cancel(tenantOf(request), params.id, body, user),
        };
      } catch (error) {
        return fail(request, error, "Failed to cancel the session");
      }
    },
    postpone: async ({ params, body, request }: ContractRouteArgs<Contract["postpone"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { session: await ops.postpone(tenantOf(request), params.id, body, user) },
        };
      } catch (error) {
        return fail(request, error, "Failed to postpone the session");
      }
    },
    activity: async ({ params, request }: ContractRouteArgs<Contract["activity"]>) => {
      if (!canReadCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { items: await ops.activity(tenantOf(request), params.id) },
        };
      } catch (error) {
        return fail(request, error, "Failed to load session activity");
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
