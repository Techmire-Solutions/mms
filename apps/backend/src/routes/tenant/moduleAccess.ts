import type { FastifyPluginAsync } from "fastify";
import { moduleAccessContract, type ModuleAccessResponse } from "@mms/shared";
import { loadModuleAvailability } from "../../lib/moduleAvailabilityService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { logger } from "../../lib/logger.js";

/**
 * Authoritative module availability (platform grant + tenant enablement) for the
 * signed-in workspace — `moduleAccessContract.get`. Non-module route: every
 * tenant user needs it to render navigation; permissions are evaluated
 * client-side from the session role and re-enforced by `registerModuleAccess`
 * on every module request.
 */
const moduleAccessRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticateTenant);

  fastify.get(moduleAccessContract.get.path, async (request, reply) => {
    const tenant = request.tenant?.id;
    if (!tenant) return sendForbidden(reply, "Missing tenant context");
    try {
      const body: ModuleAccessResponse = { modules: await loadModuleAvailability(tenant) };
      reply.header("Cache-Control", "private, no-store");
      return reply.send(body);
    } catch (err) {
      logger.error({ err, tenant }, "Failed to load module availability");
      return reply
        .status(503)
        .send({ type: "service_unavailable", message: "Module access could not be verified" });
    }
  });
};

export default moduleAccessRoutes;
