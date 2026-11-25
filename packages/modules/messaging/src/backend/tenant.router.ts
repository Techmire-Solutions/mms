import type { FastifyPluginAsync } from "fastify";

import { messagingExportRoutes } from "./routes/messagingExportRoutes.js";
import { messagingLogRoutes } from "./routes/messagingLogRoutes.js";
import { messagingSmsDispatchRoute } from "./routes/messagingSmsDispatchRoute.js";
import { messagingEmailDispatchRoute } from "./routes/messagingEmailDispatchRoute.js";
import { messagingWhatsAppDispatchRoute } from "./routes/messagingWhatsAppDispatchRoute.js";
import { messagingContractRouter } from "./routes/messagingContractRouter.js";

const messagingRoutes: FastifyPluginAsync = async (fastify, _options) => {
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
