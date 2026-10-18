import type { FastifyPluginAsync } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { EXAMINATIONS_MODULE_MANIFEST, examinationSubjectsContract, type User } from "@mms/shared";
import { handleContractError } from "../../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../../lib/contractRouterTypes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { academicCatalogUseCases } from "../../../sessions/use-cases/academicCatalogUseCases.js";

type Contract = typeof examinationSubjectsContract;
const s = initServer();

/** `GET /api/examinations/subjects` — read-only subjects catalog for exam forms (Examinations module grant). */
export const examinationSubjectsRouter: FastifyPluginAsync = async (fastify) => {
  const router = s.router(examinationSubjectsContract, {
    list: async ({ request }: ContractRouteArgs<Contract["list"]>) => {
      const user = request.user as User;
      if (!canReadCollection(user, EXAMINATIONS_MODULE_MANIFEST.collectionKey)) {
        return {
          status: 403 as const,
          body: { type: "forbidden", message: "Insufficient permissions" },
        };
      }
      try {
        const items = await academicCatalogUseCases.listActive(
          String(request.tenant?.id ?? ""),
          "subjects",
        );
        return { status: 200 as const, body: { items } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "server_error", message: "Failed to load subjects" },
        });
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
