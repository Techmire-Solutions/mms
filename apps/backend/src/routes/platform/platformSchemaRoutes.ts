import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  authenticatePlatform,
  requirePlatformPermission,
} from "../../middleware/authenticatePlatform.js";
import { getIntrospectedErdDomains } from "../../services/platform/platformErdService.js";

/**
 * Platform schema routes providing dynamic database introspection and live ERD catalogs.
 * Restricted to platform operators with the `system` capability.
 */
export default async function platformSchemaRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get(
    "/erd",
    {
      preHandler: [authenticatePlatform, requirePlatformPermission("system")],
    },
    async (_request, reply) => {
      const erdData = getIntrospectedErdDomains();
      return reply.status(200).send(erdData);
    },
  );
}
