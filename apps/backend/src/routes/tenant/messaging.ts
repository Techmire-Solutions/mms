import type { FastifyPluginAsync } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";

import { messagingExportRoutes } from "./messaging/messagingExportRoutes.js";
import { messagingLogRoutes } from "./messaging/messagingLogRoutes.js";
import { messagingSmsDispatchRoute } from "./messaging/messagingSmsDispatchRoute.js";
import { messagingEmailDispatchRoute } from "./messaging/messagingEmailDispatchRoute.js";
import { messagingWhatsAppDispatchRoute } from "./messaging/messagingWhatsAppDispatchRoute.js";
import { messagingContractRouter } from "./messaging/messagingContractRouter.js";

const messagingRoutes: FastifyPluginAsync = async (fastify, _options) => {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "messaging");

  await fastify.register(
    async (sub) => {
      await sub.register(messagingLogRoutes);
      await sub.register(messagingExportRoutes);
      await sub.register(messagingSmsDispatchRoute);
      await sub.register(messagingEmailDispatchRoute);
      await sub.register(messagingWhatsAppDispatchRoute);
    },
    { prefix: "/api/messaging" },
  );

  await fastify.register(messagingContractRouter);
};

export default messagingRoutes;
