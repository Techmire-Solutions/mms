import { upsertReferenceRates } from "../../db/repositories/fxReferenceRatesRepository.js";
import { loadServerConfig } from "../../config/serverConfig.js";
import { logger } from "../../lib/logger.js";
import { LEADER_LOCK_FX_RATE_FEED, tryAcquireLeaderLease } from "../../lib/leaderElection.js";
import { getMsUntilNextUtcHour } from "../retentionPurgeScheduler.js";
import { resolveFxRateProviders, type FxRateProvider } from "./fxRateProviders.js";

/** ECB publishes around 16:00 CET; 17:00 UTC picks up the day's fixing. */
const FEED_UTC_HOUR = 17;

let feedTimer: ReturnType<typeof setTimeout> | null = null;

export function clearFxRateFeedScheduler(): void {
  if (feedTimer !== null) {
    clearTimeout(feedTimer);
    feedTimer = null;
  }
}

/** Fetch every provider and upsert its fixing; one failing provider never blocks the rest. */
export async function runFxRateFeedCycle(
  providers: readonly FxRateProvider[],
  signal: AbortSignal = AbortSignal.timeout(60_000),
): Promise<Record<string, number>> {
  const written: Record<string, number> = {};
  for (const provider of providers) {
    try {
      const snapshot = await provider.fetchLatest(signal);
      written[provider.id] = await upsertReferenceRates(snapshot);
    } catch (err) {
      logger.error({ err, provider: provider.id }, "[FxRateFeed] Provider fetch failed");
    }
  }
  logger.info({ written }, "[FxRateFeed] Completed reference rate refresh");
  return written;
}

/** Schedule the daily reference-rate refresh; a no-op unless providers are configured. */
export function scheduleFxRateFeed(isWorkerRunning: () => boolean): void {
  const providers = resolveFxRateProviders(loadServerConfig().fxRateFeedProviders ?? []);
  if (providers.length === 0 || !isWorkerRunning()) return;
  const delayMs = getMsUntilNextUtcHour(FEED_UTC_HOUR);
  logger.info({ delayMs, providers: providers.map((p) => p.id) }, "[FxRateFeed] Scheduled next run");

  feedTimer = setTimeout(() => {
    void (async () => {
      const lease = await tryAcquireLeaderLease(LEADER_LOCK_FX_RATE_FEED);
      if (!lease) return;
      try {
        await runFxRateFeedCycle(providers);
      } finally {
        await lease.release();
      }
    })()
      .catch((err: unknown) => logger.error({ err }, "[FxRateFeed] Scheduled run failed"))
      .finally(() => scheduleFxRateFeed(isWorkerRunning));
  }, delayMs);
  feedTimer.unref?.();
}
