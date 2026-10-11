import { getRequestTenant } from "./tenantContext.js";
import { logger } from "./logger.js";
import { redisDel, redisDelPattern, redisKeys } from "./redis.js";
export * from "./livePushConnections.js";
import {
  WS_TELEMETRY_BUFFERED_LIMIT,
  MAX_WS_BUFFERED_AMOUNT,
  getTenantConnections,
  getTenantSseConnections,
} from "./livePushConnections.js";
import { MODULE_ACCESS_INVALIDATION_KEYS } from "@mms/shared";
import { clearModuleAvailabilityCache } from "./moduleAvailabilityService.js";

// Redis Pub/Sub adapter for horizontal multi-node cluster scaling
let redisPublisher: { publish: (channel: string, message: string) => Promise<unknown> } | null =
  null;
let redisSubscriber: {
  subscribe: (...channels: string[]) => Promise<unknown>;
  on: (event: string, listener: (...args: string[]) => void) => void;
} | null = null;

const WS_INVALIDATION_CHANNEL = redisKeys.wsInvalidationChannel;
const JOB_EVENT_CHANNEL = redisKeys.jobEventChannel;

export function configureRedisPubSub(
  publisher: { publish: (channel: string, message: string) => Promise<unknown> },
  subscriber?: {
    subscribe: (...channels: string[]) => Promise<unknown>;
    on: (event: string, listener: (...args: string[]) => void) => void;
  },
): void {
  redisPublisher = publisher;
  if (subscriber) {
    redisSubscriber = subscriber;

    // The Redis subscriber client is created with `lazyConnect: true` and
    // `enableOfflineQueue: false`, so an immediate `subscribe()` at startup
    // can fail if the connection has not finished establishing yet. Subscribing
    // on the `ready` event (plus an immediate best-effort attempt) guarantees
    // the channels are eventually subscribed without a permanent silent gap in
    // cross-node WS invalidation. `subscribed` guards against double-subscribing
    // when both the immediate attempt and the `ready` event fire.
    let subscribed = false;
    const subscribeChannels = (): void => {
      if (subscribed || !redisSubscriber) return;
      subscribed = true;
      redisSubscriber.subscribe(WS_INVALIDATION_CHANNEL, JOB_EVENT_CHANNEL).catch((err) => {
        subscribed = false; // allow a later retry (e.g. on `ready`)
        if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
          logger.warn({ err }, "Failed to subscribe to Redis PubSub channels");
        }
      });
    };

    subscriber.on("ready", subscribeChannels);
    const status = (subscriber as { status?: string }).status;
    if (status === undefined || status === "ready") {
      subscribeChannels();
    }

    redisSubscriber.on("message", (channel: string, message: string) => {
      try {
        if (channel === WS_INVALIDATION_CHANNEL) {
          const { subdomain, type, key } = JSON.parse(message);
          if (subdomain && type && key) {
            broadcastLocalTenantUpdate(subdomain, type, key);
          }
        } else if (channel === JOB_EVENT_CHANNEL) {
          const jobEvent = JSON.parse(message);
          if (jobEvent && jobEvent.tenantId) {
            broadcastLocalJobEvent(jobEvent);
          }
        }
      } catch (err) {
        logger.error({ err }, "Failed to process Redis message");
      }
    });
  }
}

/**
 * Broadcasts a real-time data update notification locally to connected sockets on this process node.
 */
export function broadcastLocalTenantUpdate(
  subdomain: string,
  type: "collection" | "object",
  key: string,
): void {
  const normSubdomain = subdomain.trim().toLowerCase();
  // Runs for local and Redis-relayed updates alike, so every node drops stale module gates.
  if (type === "object" && MODULE_ACCESS_INVALIDATION_KEYS.has(key)) {
    clearModuleAvailabilityCache(normSubdomain);
  }
  const tenantSet = getTenantConnections(normSubdomain);
  const sseSet = getTenantSseConnections(normSubdomain);
  if ((!tenantSet || tenantSet.size === 0) && (!sseSet || sseSet.size === 0)) return;

  const message = JSON.stringify({
    event: "database-update",
    type,
    key,
  });

  let sentCount = 0;
  if (tenantSet) {
    for (const connection of tenantSet) {
      try {
        const buffered =
          typeof connection.socket.bufferedAmount === "number"
            ? connection.socket.bufferedAmount
            : 0;
        if (buffered > MAX_WS_BUFFERED_AMOUNT) {
          logger.warn(
            { userId: connection.userId, subdomain: normSubdomain, bufferedAmount: buffered },
            "WS socket buffer backlog exceeded hard ceiling; terminating stalled connection",
          );
          connection.socket.terminate();
          continue;
        }
        if (buffered > WS_TELEMETRY_BUFFERED_LIMIT) {
          logger.warn(
            { userId: connection.userId, subdomain: normSubdomain, bufferedAmount: buffered },
            "WS socket buffer exceeded 64KB: dropping telemetry update under backpressure",
          );
          continue;
        }
        connection.socket.send(message);
        sentCount++;
      } catch (err) {
        logger.error(
          { userId: connection.userId, subdomain: normSubdomain, err },
          "Failed to send update to user",
        );
      }
    }
  }

  if (sseSet) {
    const ssePayload = `event: database-update\ndata: ${message}\n\n`;
    for (const connection of sseSet) {
      try {
        connection.response.write(ssePayload);
        sentCount++;
      } catch (err) {
        logger.error(
          { userId: connection.userId, subdomain: normSubdomain, err },
          "Failed to send SSE update to user",
        );
      }
    }
  }

  if (sentCount > 0) {
    logger.info({ type, key, sentCount, subdomain: normSubdomain }, "Broadcasted database-update");
  }
}

/**
 * Broadcasts a real-time data update notification to all active client sockets of a tenant subdomain,
 * publishing to Redis Pub/Sub if configured for multi-node cluster scale out.
 */
export function broadcastTenantUpdate(
  subdomain: string,
  type: "collection" | "object",
  key: string,
): void {
  // Always emit locally on current node
  broadcastLocalTenantUpdate(subdomain, type, key);

  // Invalidate Redis domain metrics, dashboard, setup, and workspace caches
  const cleanTenant = subdomain?.trim().toLowerCase();
  if (cleanTenant) {
    if (type === "collection") {
      void redisDel(redisKeys.metrics(cleanTenant, key));
      void redisDelPattern(redisKeys.metricsPattern(cleanTenant, key));
      void redisDelPattern(redisKeys.dashboardSummaryPattern(cleanTenant));
      void redisDelPattern(redisKeys.setupPattern(cleanTenant, key));
    } else if (type === "object") {
      if (
        key === "workspace" ||
        key === "branding" ||
        key === "settings" ||
        key === "global_settings" ||
        key === "fields" ||
        key === "schema"
      ) {
        void redisDel(redisKeys.workspace(cleanTenant));
        void redisDel(redisKeys.globalSettings(cleanTenant));
        void redisDelPattern(redisKeys.setupPattern(cleanTenant, "*"));
      }
    }
  }

  // If Redis Pub/Sub is configured, publish to cluster
  if (redisPublisher) {
    const payload = JSON.stringify({ subdomain, type, key });
    redisPublisher.publish(WS_INVALIDATION_CHANNEL, payload).catch((err) => {
      logger.error({ err }, "Failed to publish WS invalidation to Redis");
    });
  }
}

/**
 * Broadcasts a background job status/progress event locally to connected sockets.
 */
export function broadcastLocalJobEvent(jobEvent: {
  event: string;
  tenantId: string;
  userId?: string;
  jobId: string;
  moduleId?: string;
  kind?: string;
  progress?: { current: number; total: number; percent: number };
  label?: string;
  hasDownload?: boolean;
  error?: string;
}): void {
  const normSubdomain = jobEvent.tenantId.trim().toLowerCase();
  const tenantSet = getTenantConnections(normSubdomain);
  const sseSet = getTenantSseConnections(normSubdomain);
  if ((!tenantSet || tenantSet.size === 0) && (!sseSet || sseSet.size === 0)) return;

  // Sanitize job event payload for multi-tenant egress boundary
  const sanitizedEvent = {
    event: String(jobEvent.event),
    tenantId: normSubdomain,
    ...(jobEvent.userId ? { userId: String(jobEvent.userId) } : {}),
    jobId: String(jobEvent.jobId),
    ...(jobEvent.moduleId ? { moduleId: String(jobEvent.moduleId) } : {}),
    ...(jobEvent.kind ? { kind: String(jobEvent.kind) } : {}),
    ...(jobEvent.progress ? { progress: jobEvent.progress } : {}),
    ...(jobEvent.label ? { label: String(jobEvent.label) } : {}),
    ...(jobEvent.hasDownload !== undefined ? { hasDownload: Boolean(jobEvent.hasDownload) } : {}),
    ...(jobEvent.error ? { error: String(jobEvent.error) } : {}),
  };
  const message = JSON.stringify(sanitizedEvent);

  let sentCount = 0;
  if (tenantSet) {
    for (const connection of tenantSet) {
      if (!jobEvent.userId || connection.userId === jobEvent.userId) {
        try {
          const buffered =
            typeof connection.socket.bufferedAmount === "number"
              ? connection.socket.bufferedAmount
              : 0;
          if (buffered > MAX_WS_BUFFERED_AMOUNT) {
            logger.warn(
              { userId: connection.userId, jobId: jobEvent.jobId, bufferedAmount: buffered },
              "WS socket buffer backlog exceeded hard ceiling; terminating stalled connection",
            );
            connection.socket.terminate();
            continue;
          }
          if (buffered > WS_TELEMETRY_BUFFERED_LIMIT && jobEvent.event === "progress") {
            logger.warn(
              { userId: connection.userId, jobId: jobEvent.jobId, bufferedAmount: buffered },
              "WS socket buffer > 64KB: coalescing intermediate progress frame under backpressure",
            );
            continue;
          }
          connection.socket.send(message);
          sentCount++;
        } catch (err) {
          logger.error({ userId: connection.userId, err }, "Failed to send job event to user");
        }
      }
    }
  }

  if (sseSet) {
    const ssePayload = `event: job-event\ndata: ${message}\n\n`;
    for (const connection of sseSet) {
      if (!jobEvent.userId || connection.userId === jobEvent.userId) {
        try {
          connection.response.write(ssePayload);
          sentCount++;
        } catch (err) {
          logger.error({ userId: connection.userId, err }, "Failed to send SSE job event to user");
        }
      }
    }
  }

  if (sentCount > 0) {
    logger.info(
      { event: jobEvent.event, jobId: jobEvent.jobId, sentCount },
      "Broadcasted job event",
    );
  }
}

/**
 * Convenience helper: broadcasts a collection update for the current request tenant.
 * No-ops if there is no active tenant context.
 */
export async function broadcastCollection(key: string): Promise<void> {
  const tenant = getRequestTenant();
  if (tenant) broadcastTenantUpdate(tenant, "collection", key);
}
