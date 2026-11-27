import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticatePlatform, requirePlatformPermission } from "../deps.js";
import { insertPlatformActivityLog } from "../use-cases/platformUseCases.js";
import { computeAndPublishMerkleCheckpoint } from "../deps.js";
import { listGlobalMerkleRoots } from "../deps.js";

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
    async (request, reply) => {
      const result = await computeAndPublishMerkleCheckpoint();
      const { platformUser } = request as any;
      await insertPlatformActivityLog({
        userId: platformUser.id,
        userEmail: platformUser.email,
        action: "publish_merkle_checkpoint",
        targetResource: "audit_merkle_roots",
        metadataMessage: `rootHash=${result.rootHash} shards=${result.shardCount}`,
        ipAddress: request.ip,
      });
      return reply.send(result);
    },
  );
}
