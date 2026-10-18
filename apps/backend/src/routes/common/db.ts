import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { dbSyncRoutes } from "./db/dbSyncRoutes.js";
import { dbCollectionRoutes } from "./db/dbCollectionRoutes.js";
import { dbObjectRoutes } from "./db/dbObjectRoutes.js";

/**
 * Register database sync and CRUD routes on the Fastify instance.
 */
export default async function dbRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);

  await fastify.register(dbSyncRoutes);
  await fastify.register(dbCollectionRoutes);
  await fastify.register(dbObjectRoutes);
}
