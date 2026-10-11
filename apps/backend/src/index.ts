import process from "node:process";
import { resolveBackendListenPort } from "@mms/shared";
import { buildApp } from "./app.js";
import { closeDatabase } from "./db/database.js";
import { startAuthArtifactPurgeScheduler } from "./services/auth/authArtifactPurgeScheduler.js";
import { startAuditVerificationScheduler } from "./services/auditVerificationScheduler.js";
import { closeAllQueues } from "./worker/queues/index.js";
import { disconnectRedis } from "./lib/redis.js";
import { closeAllConnections } from "./lib/livePush.js";
import { logger } from "./lib/logger.js";
import { markShuttingDown, SHUTDOWN_DRAIN_DELAY_MS, waitForDrain } from "./lib/lifecycle.js";

/**
 * Hard ceiling for the whole shutdown sequence. Must cover the drain wait PLUS
 * time to close connections and the pool, otherwise adding a drain delay would
 * make graceful shutdown more likely to be force-killed, not less.
 */
const FORCE_SHUTDOWN_TIMEOUT_MS = SHUTDOWN_DRAIN_DELAY_MS + 10_000;

/**
 * Boots the Fastify server by building the app and listening on the configured port.
 */
async function startServer(): Promise<void> {
  const app = await buildApp();
  const port = resolveBackendListenPort(process.env);
  const host = process.env.HOST || "0.0.0.0";

  const stopArtifactPurge = startAuthArtifactPurgeScheduler(app.log);
  const stopAuditVerification = startAuditVerificationScheduler(app.log);

  // Encapsulate all resource teardowns inside Fastify's native onClose lifecycle
  app.addHook("onClose", async () => {
    stopAuditVerification();
    stopArtifactPurge();
    await closeAllQueues();
    await disconnectRedis();
    closeAllConnections();
    await closeDatabase();
  });

  await app.listen({ port, host });
  app.log.info(`Backend server listening on http://${host}:${port}`);

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");

    app.log.info({ signal, drainDelayMs: SHUTDOWN_DRAIN_DELAY_MS }, "shutting down");

    const forceExitTimer = setTimeout(() => {
      app.log.fatal("Graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, FORCE_SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref?.();

    try {
      // Phase 1: flip /ready to 503 and stay listening while the load balancer
      // takes this instance out of rotation. Closing first would drop requests
      // the balancer is still routing here (see lib/lifecycle.ts).
      markShuttingDown();
      await waitForDrain();

      // Phase 2: stop accepting new connections and drain in-flight requests.
      await app.close();
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      app.log.error({ err: message }, "shutdown failed");
      process.exit(1);
    }
  };

  process.on("unhandledRejection", (reason) => {
    const err =
      reason instanceof Error
        ? { message: reason.message, stack: reason.stack }
        : { message: String(reason) };
    app.log.error({ err }, "unhandled rejection");
  });

  process.on("uncaughtException", (error) => {
    app.log.fatal({ err: error }, "uncaught exception");
    void shutdown("uncaughtException");
  });

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

startServer().catch((error) => {
  const errDetails = error instanceof Error ? error.stack || error.message : String(error);
  logger.fatal({ err: errDetails }, "Fatal error starting backend server");
  process.exit(1);
});
