import type { FastifyPluginAsync } from "fastify";
import { authenticateTenant } from "../../../middleware/authenticate.js";
import { auditEventRoutes } from "./auditEventRoutes.js";
import { auditIntegrityRoutes } from "./auditIntegrityRoutes.js";
import { auditPrivacyRoutes } from "./auditPrivacyRoutes.js";

/**
 * Modern 5-dimension audit trail routes barrel plugin.
 * Strictly adheres to 300-line ceiling by modularizing into:
 * - auditEventRoutes: Querying, paginated projection, viewing, and export
 * - auditIntegrityRoutes: Verification, Merkle transparency rollups, anomaly detection
 * - auditPrivacyRoutes: Crypto-shredding right-to-erasure, retention floors and purging
 */
export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticateTenant);

  await fastify.register(auditEventRoutes);
  await fastify.register(auditIntegrityRoutes);
  await fastify.register(auditPrivacyRoutes);
};

export default auditRoutes;
