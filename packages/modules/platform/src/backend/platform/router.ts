import type { FastifyPluginAsync } from "fastify";

import platformAdminSystem from "./routes/platformAdminSystem.js";
import platformAiRoutes from "./routes/platformAiRoutes.js";
import platformAuditRoutes from "./routes/platformAuditRoutes.js";
import platformAuth from "./routes/platformAuth.js";
import platformBackup from "./routes/platformBackup.js";
import platformBranding from "./routes/platformBranding.js";
import platformEmailIntegrationRoutes from "./routes/platformEmailIntegrationRoutes.js";
import platformLlm from "./routes/platformLlm.js";
import platformMessaging from "./routes/platformMessaging.js";
import platformModules from "./routes/platformModules.js";
import platformSchemaRoutes from "./routes/platformSchemaRoutes.js";
import platformSettings from "./routes/platformSettings.js";
import platformSmsIntegrationRoutes from "./routes/platformSmsIntegrationRoutes.js";
import platformUsers from "./routes/platformUsers.js";
import platformWorkspaces from "./routes/platformWorkspaces.js";

/** Platform console router: composes every console route plugin (auth/guards applied by the app). */
export const platformRoutes: FastifyPluginAsync = async (app) => {
  await app.register(platformAdminSystem, { prefix: "/api/platform/admin/system" });
  await app.register(platformAiRoutes, { prefix: "/api/platform/ai" });
  await app.register(platformAuditRoutes, { prefix: "/api/platform/audit" });
  await app.register(platformAuth, { prefix: "/api/platform/auth" });
  await app.register(platformBackup);
  await app.register(platformBranding);
  await app.register(platformEmailIntegrationRoutes, { prefix: "/api/platform/email" });
  await app.register(platformLlm);
  await app.register(platformMessaging);
  await app.register(platformModules);
  await app.register(platformSchemaRoutes, { prefix: "/api/platform/schema" });
  await app.register(platformSettings);
  await app.register(platformSmsIntegrationRoutes, { prefix: "/api/platform/sms" });
  await app.register(platformUsers);
  await app.register(platformWorkspaces);
};

export default platformRoutes;
