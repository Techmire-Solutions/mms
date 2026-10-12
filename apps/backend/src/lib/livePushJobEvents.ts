import { logger } from "./logger.js";
import {
  WS_TELEMETRY_BUFFERED_LIMIT,
  MAX_WS_BUFFERED_AMOUNT,
  getTenantConnections,
  getTenantSseConnections,
} from "./livePushConnections.js";

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
