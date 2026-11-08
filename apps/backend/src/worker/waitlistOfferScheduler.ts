import { logger } from "../lib/logger.js";
import { LEADER_LOCK_WAITLIST_OFFERS, tryAcquireLeaderLease } from "../lib/leaderElection.js";
import { expireWaitlistOffers } from "../enrollments/use-cases/admissionsWaitlistExpiry.js";

/** Every 15 minutes: offers lapse back to the waitlist when their window closes. */
const INTERVAL_MS = 15 * 60 * 1000;
let offerTimer: ReturnType<typeof setTimeout> | null = null;

export async function runWaitlistOfferExpiry(): Promise<{
  reverted: number;
  workspaces: string[];
}> {
  return expireWaitlistOffers();
}

export function clearWaitlistOfferScheduler(): void {
  if (offerTimer !== null) {
    clearTimeout(offerTimer);
    offerTimer = null;
  }
}

/** Leader-only sweep; idempotent (expired offers are only under_review with an expiry). */
export function scheduleWaitlistOffers(isWorkerRunning: () => boolean, delayMs = 60_000): void {
  if (!isWorkerRunning()) return;
  offerTimer = setTimeout(() => {
    void (async () => {
      const lease = await tryAcquireLeaderLease(LEADER_LOCK_WAITLIST_OFFERS);
      if (!lease) return;
      try {
        const result = await runWaitlistOfferExpiry();
        if (result.reverted > 0)
          logger.info({ count: result.reverted }, "[WaitlistOffers] Reverted expired offers");
      } catch (err) {
        logger.error({ err }, "[WaitlistOffers] Expiry sweep failed");
      } finally {
        await lease.release();
      }
    })()
      .catch((err: unknown) => {
        logger.error({ err }, "[WaitlistOffers] Failed to acquire leader lease");
      })
      .finally(() => scheduleWaitlistOffers(isWorkerRunning, INTERVAL_MS));
  }, delayMs);
  offerTimer.unref?.();
}
