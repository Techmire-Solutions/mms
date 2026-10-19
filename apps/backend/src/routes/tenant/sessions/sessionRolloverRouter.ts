import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { SESSIONS_MODULE_MANIFEST, sessionRolloverContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { sessionRolloverUseCases as rollover } from "../../../sessions/use-cases/sessionRolloverUseCases.js";

type Contract = typeof sessionRolloverContract;
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

/** `/api/sessions/:id/rollover{,/preview,/runs}` — duplicate & promote (Phase 10). */
export const sessionRolloverRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(sessionRolloverContract, {
    preview: async ({ params, body, request }: ContractRouteArgs<Contract["preview"]>) => {
      if (!canWriteCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { rows: await rollover.preview(tenantOf(request), params.id, body) },
        };
      } catch (error) {
        return fail(request, error, "Failed to preview the rollover");
      }
    },
    start: async ({ params, body, request }: ContractRouteArgs<Contract["start"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        const run = await rollover.start(tenantOf(request), params.id, body, String(user.id));
        return { status: 202 as const, body: { run } };
      } catch (error) {
        return fail(request, error, "Failed to start the rollover");
      }
    },
    runs: async ({ params, request }: ContractRouteArgs<Contract["runs"]>) => {
      if (!canReadCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { runs: await rollover.listRuns(tenantOf(request), params.id) },
        };
      } catch (error) {
        return fail(request, error, "Failed to load rollover runs");
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
