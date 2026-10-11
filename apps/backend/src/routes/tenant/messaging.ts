import type { FastifyPluginAsync } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";

import { messagingExportRoutes } from "./messaging/messagingExportRoutes.js";
import { messagingLogRoutes } from "./messaging/messagingLogRoutes.js";
import { messagingRecipientRoutes } from "./messaging/messagingRecipientRoutes.js";
import { messagingTemplateRoutes } from "./messaging/messagingTemplateRoutes.js";
import { messagingContractRouter } from "./messaging/messagingContractRouter.js";

const messagingRoutes: FastifyPluginAsync = async (fastify, _options) => {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "messaging");

  await fastify.register(
    async (sub) => {
      await sub.register(messagingRecipientRoutes);
      await sub.register(messagingTemplateRoutes);
      await sub.register(messagingLogRoutes);
      await sub.register(messagingExportRoutes);
    },
    { prefix: "/api/messaging" },
  );

  await fastify.register(messagingContractRouter);
};

export default messagingRoutes;
