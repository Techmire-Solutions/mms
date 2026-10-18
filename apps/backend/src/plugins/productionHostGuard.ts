import type { FastifyInstance } from "fastify";
import { isHostAllowedForAppDomain } from "@mms/shared";
import type { ServerConfig } from "../config/serverConfig.js";
import { requestHostname } from "../lib/requestHost.js";

/** Rejects requests whose Host is not MMS_APP_DOMAIN or a tenant subdomain. */
export function registerProductionHostGuard(app: FastifyInstance, config: ServerConfig): void {
  if (!config.isProd) return;

  const appDomain = process.env.MMS_APP_DOMAIN?.trim();
  if (!appDomain) return;

  app.addHook("onRequest", (request, reply, done) => {
    const host = requestHostname(request);
    if (!host || isHostAllowedForAppDomain(host, appDomain)) {
      done();
      return;
    }
    reply.status(404).send({
      type: "not_found",
      message: "This host is not configured for MMS",
    });
  });
}
