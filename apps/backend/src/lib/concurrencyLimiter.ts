/**
 * Small concurrency primitives shared by long-running DB work.
 *
 * These exist so long-lived operations (whole-workspace snapshot/backup streams,
 * per-tenant audit chain verification) cannot take an unbounded share of the
 * Postgres connection pool. The pool is the scarcest resource in the request
 * path — `PG_POOL_MAX` defaults to 20 and is shared by every concurrent request
 * — so anything that holds a pooled client for more than a moment needs an
 * explicit budget.
 */

/** Runs `worker` over `items` with at most `limit` promises in flight. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]!) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });

  await Promise.all(runners);
  return results;
}

export interface ConcurrencyLimiter {
  /**
   * Claims a slot. Returns an idempotent release function, or `null` when every
   * slot is taken — the caller decides how to shed the excess work.
   */
  tryAcquire(): (() => void) | null;
  /** Slots currently held. Intended for logging and tests. */
  inFlight(): number;
}

export function createConcurrencyLimiter(max: number): ConcurrencyLimiter {
  const capacity = Math.max(1, max);
  let inFlight = 0;

  return {
    tryAcquire() {
      if (inFlight >= capacity) return null;
      inFlight += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        inFlight -= 1;
      };
    },
    inFlight: () => inFlight,
  };
}
