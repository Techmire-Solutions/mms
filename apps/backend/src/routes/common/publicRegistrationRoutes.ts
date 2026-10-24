import { createHmac } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import { publicRegistrationContract } from "@mms/shared";
import { handleContractError } from "../../lib/contractError.js";
import { standardRequestValidationErrorHandler } from "../../lib/contractRegistration.js";
import type { ContractRouteArgs } from "../../lib/contractRouterTypes.js";
import { resolveSubdomainFromRequest } from "../../lib/tenantContext.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { PUBLIC_REGISTRATION_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { loadServerConfig } from "../../config/serverConfig.js";
import {
  listOpenRegistrations,
  submitPublicRegistration,
  viewPublicRegistration,
} from "../../enrollments/use-cases/registrationPublicUseCases.js";

type Contract = typeof publicRegistrationContract;
const s = initServer();
const notFound = {
  status: 404 as const,
  body: { type: "not_found", message: "This registration link is not available" },
};

/** Tenant comes from the subdomain only — never from the body (no session on this path). */
function subdomainOf(request: FastifyRequest): string | null {
  return resolveSubdomainFromRequest(request.headers.host, request.headers["x-forwarded-host"]);
}

/** Keyed hash of the client IP: lets staff spot floods without storing the address. */
function hashIp(ip: string): string {
  return createHmac("sha256", loadServerConfig().jwtSecret).update(ip).digest("hex");
}

/**
 * `/api/public/registrations` — unauthenticated, PII-free reads and rate-limited submissions for
 * the tenant's public "Apply" pages. Classified public in moduleAccessCoverage (`/api/public/`).
 */
export const publicRegistrationRoutes: FastifyPluginAsync = async (fastify) => {
  const submitGuard = createStrictRateLimitGuard(fastify, PUBLIC_REGISTRATION_RATE_LIMIT);
  fastify.addHook("preHandler", async (request, reply) => {
    if (request.method === "POST") await submitGuard(request, reply);
  });

  const router = s.router(publicRegistrationContract, {
    openSessions: async ({ request }: ContractRouteArgs<Contract["openSessions"]>) => {
      const subdomain = subdomainOf(request);
      if (!subdomain) return notFound;
      try {
        return { status: 200 as const, body: { items: await listOpenRegistrations(subdomain) } };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "server_error", message: "Failed to load open registrations" },
        });
      }
    },
    view: async ({ params, request }: ContractRouteArgs<Contract["view"]>) => {
      const subdomain = subdomainOf(request);
      if (!subdomain) return notFound;
      try {
        return { status: 200 as const, body: await viewPublicRegistration(subdomain, params.slug) };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "server_error", message: "Failed to load the registration" },
        });
      }
    },
    submit: async ({ params, body, request }: ContractRouteArgs<Contract["submit"]>) => {
      const subdomain = subdomainOf(request);
      if (!subdomain) return notFound;
      try {
        const result = await submitPublicRegistration(
          subdomain,
          params.slug,
          body,
          hashIp(request.ip),
        );
        return { status: 201 as const, body: result };
      } catch (error) {
        return handleContractError(request, error, {
          status: 500,
          body: { type: "server_error", message: "Failed to submit the application" },
        });
      }
    },
  } as unknown as RouterImplementation<Contract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: standardRequestValidationErrorHandler,
  });
};
