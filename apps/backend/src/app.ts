import { randomUUID } from "node:crypto";
import { misconfiguredAppDomainHint } from "@mms/shared";
import fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { loadBackendEnv } from "./config/loadEnv.js";
import { LOG_REDACTION_OPTIONS } from "./lib/logRedaction.js";
import { loadServerConfig } from "./config/serverConfig.js";
import { initDb } from "./db/database.js";
import { registerFrontendSpa } from "./plugins/frontendSpa.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import { registerDefaultBackgroundJobRunners } from "./services/backgroundJobRunnerService.js";
import { setStaticAssetHeaders } from "./plugins/staticAssets.js";

loadBackendEnv();

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadServerConfig();

  const app = fastify({
    logger: { level: config.logLevel, redact: LOG_REDACTION_OPTIONS },
    trustProxy: config.trustProxy,
    bodyLimit: config.bodyLimit,
    requestTimeout: config.requestTimeoutMs,
    keepAliveTimeout: config.keepAliveTimeoutMs,
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      if (typeof incoming === "string" && incoming.length > 0) return incoming;
      return randomUUID();
    },
  });

  if (app.server && "headersTimeout" in app.server) {
    app.server.headersTimeout = config.headersTimeoutMs;
  }

  if (app.server && typeof app.server.on === "function") {
    app.server.on("connection", (socket) => {
      socket.setKeepAlive(true, config.tcpKeepAliveInitialDelayMs);
      socket.setNoDelay(true);
    });
  }

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await initDb();
  registerDefaultBackgroundJobRunners();
  await registerPlugins(app, config);

  if (config.isProd) {
    const appDomain = process.env.MMS_APP_DOMAIN?.trim();
    if (!appDomain) {
      app.log.error(
        "MMS_APP_DOMAIN is not set — tenant subdomains will not resolve. " +
          "Set MMS_APP_DOMAIN in apps/backend/.env (e.g. mmsv2.example.com).",
      );
    } else {
      const sampleHost = appDomain.includes(".") ? appDomain : `platform.${appDomain}`;
      const hint = misconfiguredAppDomainHint(sampleHost, appDomain);
      if (hint) {
        app.log.error({ hint }, "MMS_APP_DOMAIN misconfiguration");
      }
    }
  }

  await registerRoutes(app);

  const spaActive = await registerFrontendSpa(app, config);

  // setNotFoundHandler must be called exactly once per Fastify instance.
  // In production with a built SPA, serve index.html for non-API routes so
  // client-side routing works. Otherwise return a stable JSON 404 shape.
  if (spaActive) {
    app.setNotFoundHandler(async (request, reply) => {
      const pathname = request.url.split("?")[0] ?? "";
      if (pathname.startsWith("/api") || pathname.startsWith("/uploads")) {
        return reply.status(404).send({ type: "not_found", message: "Not found" });
      }
      setStaticAssetHeaders(reply, "index.html");
      return reply.sendFile("index.html");
    });
  } else {
    app.setNotFoundHandler((_request, reply) => {
      reply.status(404).send({ type: "not_found", message: "Route not found" });
    });
  }

  return app;
}
