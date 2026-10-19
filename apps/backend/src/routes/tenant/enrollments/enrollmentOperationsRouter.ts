import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { enrollmentOperationsContract, ENROLLMENTS_MODULE_MANIFEST, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { canReadCollection, canWriteCollection } from "../../../services/rbacService.js";
import { enrollmentOperationsUseCases as ops } from "../../../enrollments/use-cases/enrollmentOperationsUseCases.js";

type Contract = typeof enrollmentOperationsContract;
const COLLECTION = ENROLLMENTS_MODULE_MANIFEST.collectionKey;
const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};
const s = initServer();
const tenantOf = (request: { tenant?: { id?: unknown } }) => String(request.tenant?.id ?? "");

/** `/api/enrollments/:id/{placements,transfer,withdraw}` — dated mid-session operations. */
export const enrollmentOperationsRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(enrollmentOperationsContract, {
    placements: async ({ params, request }: ContractRouteArgs<Contract["placements"]>) => {
      if (!canReadCollection(request.user as User, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { placements: await ops.placements(tenantOf(request), params.id) },
        };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "server_error", message: "Failed to load placement history" },
        });
      }
    },
    transfer: async ({ params, body, request }: ContractRouteArgs<Contract["transfer"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: { enrollment: await ops.transfer(tenantOf(request), params.id, body, user) },
        };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "server_error", message: "Failed to transfer the enrollment" },
        });
      }
    },
    withdraw: async ({ params, body, request }: ContractRouteArgs<Contract["withdraw"]>) => {
      const user = request.user as User;
      if (!canWriteCollection(user, COLLECTION)) return forbidden;
      try {
        return {
          status: 200 as const,
          body: await ops.withdraw(tenantOf(request), params.id, body, user),
        };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "server_error", message: "Failed to withdraw the enrollment" },
        });
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
