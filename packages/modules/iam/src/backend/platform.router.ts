import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  platformIamImpersonationBodySchema,
  platformIamSearchQuerySchema,
  platformIamSetUserStatusBodySchema,
} from "@mms/contracts";
import type { IamPlatformActor } from "../shared/types.js";
import type { IamService } from "./iam.service.js";
import { sendIamError } from "./respond.js";

export interface PlatformIamRouterOptions {
  service: IamService;
  /** App-supplied super-user pre-handler for sensitive IAM mutations. */
  requireSuperUser?: import("fastify").preHandlerAsyncHookHandler;
}

function actor(request: FastifyRequest): IamPlatformActor | null {
  return (request as FastifyRequest & { platformUser?: IamPlatformActor }).platformUser ?? null;
}

const PLATFORM_ADMIN_REQUIRED = {
  type: "forbidden",
  message: "Platform administrator required",
} as const;

export const platformIamRoutes: FastifyPluginAsync<PlatformIamRouterOptions> = async (
  app,
  opts,
) => {
  const service = opts.service;

  app.get("/api/platform/iam/users", async (request, reply) => {
    const platformActor = actor(request);
    if (!platformActor) return reply.status(403).send(PLATFORM_ADMIN_REQUIRED);
    const parsed = platformIamSearchQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success)
      return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
    try {
      return reply.send(
        await service.searchUsers(
          platformActor,
          parsed.data.q,
          parsed.data.page,
          parsed.data.limit,
        ),
      );
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.get("/api/platform/iam/organizations", async (request, reply) => {
    const platformActor = actor(request);
    if (!platformActor) return reply.status(403).send(PLATFORM_ADMIN_REQUIRED);
    const parsed = platformIamSearchQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success)
      return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
    try {
      return reply.send(
        await service.searchOrganizations(
          platformActor,
          parsed.data.q,
          parsed.data.page,
          parsed.data.limit,
        ),
      );
    } catch (error) {
      return sendIamError(reply, error);
    }
  });

  app.patch(
    "/api/platform/iam/users/:tenant/:userId/status",
    { preHandler: opts.requireSuperUser },
    async (request, reply) => {
      const platformActor = actor(request);
      if (!platformActor) return reply.status(403).send(PLATFORM_ADMIN_REQUIRED);
      const params = request.params as { tenant: string; userId: string };
      const parsed = platformIamSetUserStatusBodySchema.safeParse(request.body ?? {});
      if (!parsed.success)
        return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
      try {
        return reply.send(
          await service.setTenantUserStatus(platformActor, {
            tenant: params.tenant,
            userId: params.userId,
            ...parsed.data,
            ip: request.ip,
          }),
        );
      } catch (error) {
        return sendIamError(reply, error);
      }
    },
  );

  app.post(
    "/api/platform/iam/impersonations",
    { preHandler: opts.requireSuperUser },
    async (request, reply) => {
      const platformActor = actor(request);
      if (!platformActor) return reply.status(403).send(PLATFORM_ADMIN_REQUIRED);
      const parsed = platformIamImpersonationBodySchema.safeParse(request.body ?? {});
      if (!parsed.success)
        return reply.status(400).send({ type: "bad_request", message: parsed.error.message });
      try {
        return reply.send(await service.beginImpersonation(platformActor, parsed.data));
      } catch (error) {
        return sendIamError(reply, error);
      }
    },
  );
};
