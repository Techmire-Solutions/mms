import { type FastifyInstance } from "fastify";
import { metrics } from "../../lib/metrics.js";
import { isLoopbackRequest } from "../../lib/requestHost.js";
import {
  isMetricsEndpointEnabled,
  isMetricsRequestAuthorized,
} from "../../plugins/metricsPlugin.js";

/**
 * Prometheus scrape endpoint.
 *
 * Disabled unless `METRICS_ENABLED=true` (returns 404 otherwise, so the route's
 * existence is not advertised). When `METRICS_TOKEN` is set, requests must carry
 * `Authorization: Bearer <token>` — the payload reveals internal topology, so a
 * token is the minimum for any non-loopback scrape path.
 */
export default async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/metrics", async (request, reply) => {
    if (!isMetricsEndpointEnabled()) {
      return reply.status(404).send({ type: "not_found", message: "Not found" });
    }

    // Topology is loopback-or-token, matching `/health`: a missing METRICS_TOKEN
    // must never make a non-loopback scrape public (the plugin helper returns
    // true when no token is configured).
    const loopback = isLoopbackRequest(request);
    const tokenConfigured = Boolean(process.env.METRICS_TOKEN?.trim());
    if (
      !loopback &&
      (!tokenConfigured || !isMetricsRequestAuthorized(request.headers.authorization))
    ) {
      return reply
        .status(401)
        .header("WWW-Authenticate", "Bearer")
        .send({ type: "unauthorized", message: "A valid metrics token is required" });
    }

    const { contentType, body } = metrics.render();
    return reply.header("Content-Type", contentType).send(body);
  });
}
