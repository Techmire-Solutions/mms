import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { resolveAppDomainForRequest } from "@mms/shared";
import { requestHostname } from "../../lib/requestHost.js";

export default async function publicRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/deployment-config", async (request, reply) => {
    const hostname = requestHostname(
      request as FastifyRequest & { headers: Record<string, unknown> },
    );
    const configured = process.env.MMS_APP_DOMAIN?.trim();
    const appDomain = resolveAppDomainForRequest(hostname, configured);
    return reply.send({ appDomain });
  });
}
