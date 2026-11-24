import { getRequestTenant } from "@mms/db/request-context";
import { logger } from "../logger/index.js";
import { redisDel, redisDelPattern } from "../redis/cacheOperations.js";
import { redisKeys } from "../redis/keys.js";
import {
  WS_TELEMETRY_BUFFERED_LIMIT,
  MAX_WS_BUFFERED_AMOUNT,
  getTenantConnections,
  getTenantSseConnections,
} from "./connections.js";
import { broadcastLocalJobEvent } from "./jobEvents.js";

export { broadcastLocalJobEvent } from "./jobEvents.js";
export * from "./connections.js";

/** Optional hook so the kernel can invalidate app-owned caches on module-access changes. */
type ModuleAccessInvalidator = (tenant: string) => void;
let invalidateModuleAccess: ModuleAccessInvalidator | null = null;

export function configureModuleAccessInvalidator(
  invalidator: ModuleAccessInvalidator | null,
): void {
  invalidateModuleAccess = invalidator;
}

let redisPublisher: { publish: (channel: string, message: string) => Promise<unknown> } | null =
  null;
let redisSubscriber: {
  subscribe: (...channels: string[]) => Promise<unknown>;
  on: (event: string, listener: (...args: string[]) => void) => void;
} | null = null;

const WS_INVALIDATION_CHANNEL = redisKeys.wsInvalidationChannel;
const JOB_EVENT_CHANNEL = redisKeys.jobEventChannel;
const MODULE_ACCESS_INVALIDATION_KEYS = new Set([
  "settings",
  "workspace",
  "branding",
  "global_settings",
]);

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

    let subscribed = false;
    const subscribeChannels = (): void => {
      if (subscribed || !redisSubscriber) return;
      subscribed = true;
      redisSubscriber.subscribe(WS_INVALIDATION_CHANNEL, JOB_EVENT_CHANNEL).catch((err) => {
        subscribed = false;
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
  if (type === "object" && MODULE_ACCESS_INVALIDATION_KEYS.has(key)) {
    invalidateModuleAccess?.(normSubdomain);
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
  broadcastLocalTenantUpdate(subdomain, type, key);

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

  if (redisPublisher) {
    const payload = JSON.stringify({ subdomain, type, key });
    redisPublisher.publish(WS_INVALIDATION_CHANNEL, payload).catch((err) => {
      logger.error({ err }, "Failed to publish WS invalidation to Redis");
    });
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
