import type { FastifyInstance } from "fastify";
import type { ServerConfig } from "../config/serverConfig.js";
import { registerErrorHandlers } from "../lib/errorHandler.js";
import { registerCsrfOriginGuard } from "./csrfOriginGuard.js";
import { registerHttpPlugins } from "./http.js";
import { registerProductionHostGuard } from "./productionHostGuard.js";
import { registerRequestHooks } from "./requestHooks.js";
import { registerSecurityPlugins } from "./security.js";
import { registerStaticAssets } from "./staticAssets.js";
import { registerTelemetryPlugin } from "./telemetryPlugin.js";
import { registerMetricsPlugin } from "./metricsPlugin.js";

export async function registerPlugins(app: FastifyInstance, config: ServerConfig): Promise<void> {
  registerTelemetryPlugin(app);
  registerMetricsPlugin(app);
  registerErrorHandlers(app, config.isProd);
  // Bind the tenant (from the verified host) BEFORE the security plugins: the
  // rate limiter's key generator reads it, and keying on a client-supplied
  // header/subdomain let a caller mint a fresh bucket per request.
  registerRequestHooks(app);
  await registerSecurityPlugins(app, config);
  registerCsrfOriginGuard(app, config);
  await registerHttpPlugins(app, config);
  registerProductionHostGuard(app, config);
  await registerStaticAssets(app);
}
