import { existsSync } from "node:fs";
import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config/serverConfig.js";
import { resolveBackendRoot } from "../config/loadEnv.js";

import { setStaticAssetHeaders } from "./staticAssets.js";

/** Production: serve built SPA static assets on the API port (Apache → :5002). Returns true when SPA is active. */
export async function registerFrontendSpa(
  app: FastifyInstance,
  config: ServerConfig,
): Promise<boolean> {
  if (!config.isProd) {
    return false;
  }

  const distRoot = join(resolveBackendRoot(), "..", "frontend", "dist");
  const indexHtml = join(distRoot, "index.html");
  if (!existsSync(indexHtml)) {
    app.log.warn({ distRoot }, "Frontend dist missing — skipping SPA static hosting");
    return false;
  }

  await app.register(fastifyStatic, {
    root: distRoot,
    prefix: "/",
    wildcard: true,
    decorateReply: true,
    preCompressed: false,
    // Never serve dotfiles from dist/ (e.g. a stray .env copied at build time).
    dotfiles: "deny",
    setHeaders(res, path) {
      setStaticAssetHeaders(res, path);
    },
  });

  app.log.info({ distRoot }, "Serving frontend SPA from backend");
  return true;
}
