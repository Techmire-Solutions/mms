import { getRedisClient } from "../../lib/redis.js";
import type { BackgroundJobEventMessage } from "@mms/shared";
import { logger } from "../../lib/logger.js";

export async function publishJobEvent(eventPayload: BackgroundJobEventMessage): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const raw = JSON.stringify(eventPayload);
    await client.publish("mms:job-event", raw);
  } catch (err) {
    logger.warn({ err }, "Failed to publish job event to Redis");
  }
}
