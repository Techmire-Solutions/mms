import { sql } from "drizzle-orm";
import { withGlobalTenant } from "../db/tenant-context.js";

/**
 * Shared primitives for leader-only worker sweeps (attendance absence, finance
 * automation).
 *
 * Both sweeps iterate every enabled workspace. The rules learned from the first
 * one apply to both: one hung workspace must never wedge the sweep, and a
 * per-workspace failure must be visible in the summary rather than silently
 * skipped.
 */

/** Enabled workspaces, for a leader-only sweep. */
export async function listEnabledWorkspaces(): Promise<string[]> {
  const result = await withGlobalTenant(async (tx) =>
    tx.execute<{ subdomain: string }>(sql`
      SELECT subdomain FROM workspaces WHERE enabled = true ORDER BY subdomain
    `),
  );
  return (result.rows ?? []).map((row) => String(row.subdomain));
}

/**
 * Rejects when `promise` does not settle within `ms`; the timer is always cleared.
 *
 * `onTimeout` fires before the rejection so the caller can abort the work itself —
 * a race alone would leave a timed-out workspace writing while the sweep moves on.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
