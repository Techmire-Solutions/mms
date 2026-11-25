import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ServerConfig } from "../config/serverConfig.js";
import { resolveBackendRoot } from "../config/loadEnv.js";

import { setStaticAssetHeaders } from "./staticAssets.js";

/** Paths owned by the API — never fall through to the SPA `index.html`. */
const NON_SPA_PREFIXES = ["/api", "/uploads", "/health"];

function isNonSpaPath(pathname: string): boolean {
  return NON_SPA_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Apex detection mirrors `isApexHost` from `@mms/contracts`: a host is the apex
 * when it is not a tenant subdomain under `MMS_APP_DOMAIN`. With no configured
 * app domain (e.g. a bare host) we treat the request as apex.
 */
function isApexHostname(hostname: string, appDomain: string | undefined): boolean {
  const host = (hostname ?? "").toLowerCase().split(":")[0];
  const domain = (appDomain ?? "").toLowerCase().trim();
  if (!domain) return true;
  if (host === domain || host === `www.${domain}`) return true;
  return !host.endsWith(`.${domain}`);
}

/**
 * Production: serve the two built SPAs on the API port (Apache → :5002).
 *
 * One `@fastify/static` instance is registered with `serve: false` so it only
 * decorates `reply.sendFile`; every request is routed to the host's dist —
 * `apps/platform-web/dist` on the apex, `apps/tenant-web/dist` on tenant hosts.
 * Non-API paths fall back to that host's `index.html` for client-side routing.
 *
 * Returns true when at least one dist is present (SPA hosting active).
 */
export async function registerWebApps(
  app: FastifyInstance,
  config: ServerConfig,
): Promise<boolean> {
  if (!config.isProd) {
    return false;
  }

  const webRoot = join(resolveBackendRoot(), "..");
  const tenantDist = join(webRoot, "tenant-web", "dist");
  const platformDist = join(webRoot, "platform-web", "dist");
  const hasTenant = existsSync(join(tenantDist, "index.html"));
  const hasPlatform = existsSync(join(platformDist, "index.html"));

  if (!hasTenant && !hasPlatform) {
    app.log.warn(
      { tenantDist, platformDist },
      "Web app dist missing — skipping SPA static hosting",
    );
    return false;
  }

  await app.register(fastifyStatic, {
    root: hasTenant ? tenantDist : platformDist,
    // Disable the automatic wildcard route; we route per host in the handler.
    serve: false,
    decorateReply: true,
    preCompressed: false,
    // Never serve dotfiles from dist/ (e.g. a stray .env copied at build time).
    dotfiles: "deny",
    setHeaders(res, path) {
      setStaticAssetHeaders(res, path);
    },
  });

  app.get("/*", async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = request.url.split("?")[0] ?? "/";

    if (isNonSpaPath(pathname)) {
      return reply.status(404).send({ type: "not_found", message: "Not found" });
    }

    const apex = isApexHostname(request.hostname, config.appDomain);
    const root = apex ? platformDist : tenantDist;

    if (!existsSync(root)) {
      const fallbackRoot = apex ? tenantDist : platformDist;
      if (!existsSync(fallbackRoot)) {
        return reply.status(404).send({ type: "not_found", message: "Not found" });
      }
      app.log.warn(
        { requestHost: request.hostname, root },
        "Web dist missing for host — falling back",
      );
      return reply.status(404).send({ type: "not_found", message: "Not found" });
    }

    const relative = pathname.replace(/^\/+/, "");
    const candidate = join(root, relative || "index.html");

    if (relative && existsSync(candidate)) {
      setStaticAssetHeaders(reply, relative);
      return reply.sendFile(relative, root);
    }

    setStaticAssetHeaders(reply, "index.html");
    return reply.sendFile("index.html", root);
  });

  app.log.info(
    { tenantDist, platformDist, hasTenant, hasPlatform },
    "Serving web apps (tenant + platform) from Fastify",
  );
  return true;
}
