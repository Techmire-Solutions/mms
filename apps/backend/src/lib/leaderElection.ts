import { getPool } from '../db/dbConnection.js';
import { logger } from './logger.js';

/**
 * Process-wide Postgres advisory locks used for single-leader scheduling.
 * Values are arbitrary but must be stable and unique per concern.
 */
export const LEADER_LOCK_AUDIT_VERIFICATION = 918_273_641;
export const LEADER_LOCK_RETENTION_PURGE = 918_273_642;
export const LEADER_LOCK_SESSION_LIFECYCLE = 918_273_643;

export interface LeaderLease {
  /** True while this process still holds the session-level advisory lock. */
  isHeld(): boolean;
  release(): Promise<void>;
}

/**
 * Attempts to become the single leader for a scheduled concern.
 *
 * Postgres advisory session locks are released automatically when the holding
 * connection drops, so a crashed leader is replaced on the next attempt by a
 * surviving replica. Returns `null` when another replica already holds the lock.
 */
export async function tryAcquireLeaderLease(lockKey: number): Promise<LeaderLease | null> {
  let client;
  try {
    client = await getPool().connect();
  } catch (error) {
    logger.warn({ err: error, lockKey }, '[LeaderElection] could not check out a connection');
    return null;
  }

  try {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [lockKey],
    );
    if (!result.rows[0]?.locked) {
      client.release();
      return null;
    }
  } catch (error) {
    client.release();
    throw error;
  }

  let held = true;
  return {
    isHeld: () => held,
    async release(): Promise<void> {
      if (!held) return;
      held = false;
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
      } catch {
        // Connection may already be gone; the session lock dies with it.
      }
      client.release();
    },
  };
}
