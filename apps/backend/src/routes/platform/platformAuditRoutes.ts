import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  authenticatePlatform,
  requirePlatformPermission,
} from "../../middleware/authenticatePlatform.js";
import { computeAndPublishMerkleCheckpoint } from "../../services/auditVerificationService.js";
import { listGlobalMerkleRoots } from "../../audit/use-cases/auditQueryUseCases.js";

/**
 * Platform apex audit-integrity operations. Publishing a Merkle checkpoint rolls
 * up every workspace shard, so it is not a tenant operation.
 */
export default async function platformAuditRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticatePlatform);

  fastify.get(
    "/merkle-roots",
    { preHandler: requirePlatformPermission("system") },
    async (_request, reply) => {
      return reply.send({ items: await listGlobalMerkleRoots(20) });
    },
  );

  fastify.post(
    "/merkle-roots",
    { preHandler: requirePlatformPermission("system") },
    async (_request, reply) => {
      return reply.send(await computeAndPublishMerkleCheckpoint());
    },
  );
}
