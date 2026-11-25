/**
 * Process lifecycle state, shared between the shutdown sequence and the
 * readiness probe.
 *
 * The problem this solves: a load balancer decides where to send traffic from
 * the readiness probe, but it only re-checks on an interval. If the process goes
 * straight from "ready" to "socket closed" on SIGTERM, the balancer keeps
 * routing to it for a few seconds and those requests fail — a brief but real
 * error spike on every deploy.
 *
 * The fix is a two-phase shutdown:
 *   1. Flip to not-ready and WAIT (`drainDelayMs`) for the balancer to take the
 *      instance out of rotation.
 *   2. Only then stop accepting connections and drain in-flight requests.
 *
 * Phase 1 is what makes deploys zero-downtime; without the wait, flipping the
 * flag and closing immediately is no better than closing outright.
 */

let shuttingDown = false;

/** Marks the process as draining. Idempotent. */
export function markShuttingDown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Restores the initial state. Test-only. */
export function resetLifecycleStateForTesting(): void {
  shuttingDown = false;
}

/**
 * How long to stay not-ready before closing, so whatever routes traffic here can
 * observe the change before the socket closes.
 *
 * This must exceed the *router's* health-check interval — note that is NOT the
 * same as docker-compose's 30s healthcheck, which only reports container state
 * and is not used for routing. Real numbers to size against:
 *   - Behind an orchestrator (k8s/ECS): SIGTERM and endpoint removal happen in
 *     parallel, so a short wait (5s) is ample.
 *   - Behind a health-checking reverse proxy: wait longer than its interval.
 *   - Apache + a single pm2 instance (this repo's deploy): nothing re-checks, so
 *     the wait buys nothing — set `SHUTDOWN_DRAIN_DELAY_MS=0` to deploy faster.
 */
export const SHUTDOWN_DRAIN_DELAY_MS = ((): number => {
  const raw = process.env.SHUTDOWN_DRAIN_DELAY_MS?.trim();
  if (!raw) return 5_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5_000;
})();

/** Resolves after `ms`, or immediately when `ms <= 0`. */
export function waitForDrain(ms: number = SHUTDOWN_DRAIN_DELAY_MS): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Never let the drain wait itself keep the process alive.
    timer.unref?.();
  });
}
