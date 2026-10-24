import type pg from "pg";
import { getPool } from "../db/dbConnection.js";
import { logger } from "../lib/logger.js";
import { processOutboxCdcBatch } from "./processors/outboxCdcProcessor.js";
import type { SearchIndexAdapter } from "./adapters/searchIndexAdapter.js";

export const OUTBOX_CDC_CHANNEL = "mms_outbox_events";

export interface OutboxCdcListenerOptions {
  fallbackPollIntervalMs?: number;
  coalesceDebounceMs?: number;
}

export interface OutboxCdcHandle {
  stop(): Promise<void>;
  trigger(): Promise<void>;
}

/**
 * Event-driven PostgreSQL LISTEN / NOTIFY worker listener for CDC outbox events.
 * Listens on `mms_outbox_events` and triggers batch processing with debounce coalescing,
 * automatic reconnect on connection drops, and a fallback polling safety net.
 */
export async function startOutboxCdcListener(
  searchAdapter: SearchIndexAdapter,
  options: OutboxCdcListenerOptions = {},
): Promise<OutboxCdcHandle> {
  const fallbackInterval = options.fallbackPollIntervalMs ?? 30_000;
  const debounceMs = options.coalesceDebounceMs ?? 50;

  let isStopped = false;
  let client: pg.PoolClient | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessing = false;
  let rerunRequested = false;

  async function drainQueue(): Promise<void> {
    if (isProcessing) {
      rerunRequested = true;
      return;
    }
    isProcessing = true;
    try {
      let result = await processOutboxCdcBatch(searchAdapter);
      while (result.processed > 0 && !isStopped) {
        result = await processOutboxCdcBatch(searchAdapter);
      }
    } catch (err) {
      logger.error({ err }, "[OutboxCdcListener] Batch process error");
    } finally {
      isProcessing = false;
      if (rerunRequested && !isStopped) {
        rerunRequested = false;
        void drainQueue();
      }
    }
  }

  function scheduleDrain(): void {
    if (isStopped) return;
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void drainQueue();
    }, debounceMs);
    debounceTimer.unref?.();
  }

  async function connectListener(): Promise<void> {
    if (isStopped) return;
    try {
      const pool = getPool();
      client = await pool.connect();

      client.on("notification", (msg) => {
        if (msg.channel === OUTBOX_CDC_CHANNEL) {
          scheduleDrain();
        }
      });

      client.on("error", (err) => {
        logger.warn({ err }, "[OutboxCdcListener] Listener client error, reconnecting");
        cleanupClient();
        scheduleReconnect();
      });

      client.on("end", () => {
        if (!isStopped) {
          cleanupClient();
          scheduleReconnect();
        }
      });

      await client.query(`LISTEN ${OUTBOX_CDC_CHANNEL}`);
      logger.info(
        { channel: OUTBOX_CDC_CHANNEL },
        "[OutboxCdcListener] Listening for outbox events",
      );
    } catch (err) {
      logger.error({ err }, "[OutboxCdcListener] Failed to connect listener");
      cleanupClient();
      scheduleReconnect();
    }
  }

  function cleanupClient(): void {
    if (client) {
      try {
        client.removeAllListeners();
        client.release();
      } catch {
        // ignore client release error
      }
      client = null;
    }
  }

  function scheduleReconnect(): void {
    if (isStopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connectListener();
    }, 2000);
    reconnectTimer.unref?.();
  }

  await connectListener();

  // Fail-safe fallback poller
  fallbackTimer = setInterval(() => {
    scheduleDrain();
  }, fallbackInterval);
  fallbackTimer.unref?.();

  // Initial drain in case events accrued while offline
  scheduleDrain();

  return {
    async stop() {
      isStopped = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (client) {
        try {
          await client.query(`UNLISTEN ${OUTBOX_CDC_CHANNEL}`);
        } catch {
          // ignore unlisten errors during teardown
        }
        cleanupClient();
      }
    },
    async trigger() {
      await drainQueue();
    },
  };
}
