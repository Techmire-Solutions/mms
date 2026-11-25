import type { FastifyPluginAsync } from "fastify";
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
  await fastify.register(auditEventRoutes);
  await fastify.register(auditIntegrityRoutes);
  await fastify.register(auditPrivacyRoutes);
};

export default auditRoutes;
