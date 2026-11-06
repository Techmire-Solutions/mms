import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "../lib/logger.js";

/**
 * Post-commit effect scope (no `dbTransactions` import — avoids a module cycle).
 *
 * Callbacks registered with {@link runAfterCommit} during a transaction are held until the owning
 * transaction commits; a rollback discards them. This keeps live-update broadcasts and cache
 * invalidation from announcing a state the database refused to store.
 */

export interface CommitScope {
  callbacks: Array<() => void | Promise<void>>;
}

const commitScopeStorage = new AsyncLocalStorage<CommitScope>();

export function createCommitScope(): CommitScope {
  return { callbacks: [] };
}

/** Runs `cb` (and everything it awaits) bound to `scope`, so nested helpers can enqueue effects. */
export function runInCommitScope<T>(scope: CommitScope, cb: () => Promise<T>): Promise<T> {
  return commitScopeStorage.run(scope, cb);
}

/**
 * Queues `fn` until the surrounding transaction commits. Without an ambient transaction the effect
 * runs on the next microtask (there is nothing to wait for); a failure is logged, never thrown at a
 * caller whose write already succeeded.
 */
export function runAfterCommit(fn: () => void | Promise<void>): void {
  const scope = commitScopeStorage.getStore();
  if (scope) {
    scope.callbacks.push(fn);
    return;
  }
  void Promise.resolve()
    .then(fn)
    .catch((error: unknown) => logger.warn({ err: error }, "after-commit effect failed"));
}

/** Drops every queued effect (transaction failed / rolled back). */
export function discardCommitScope(scope: CommitScope): void {
  scope.callbacks.length = 0;
}

/** Runs queued effects in order after a successful commit; a failing effect never breaks the caller. */
export async function flushCommitScope(scope: CommitScope): Promise<void> {
  const callbacks = scope.callbacks.splice(0);
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (error) {
      logger.warn({ err: error }, "after-commit effect failed");
    }
  }
}

/**
 * Runs a root transaction with a commit scope attached: effects queued inside `work` (or by any code
 * it calls) flush after the commit and are discarded when the transaction throws.
 */
export async function runCommitScopedTransaction<T>(work: () => Promise<T>): Promise<T> {
  const scope = createCommitScope();
  let result: T;
  try {
    result = await runInCommitScope(scope, work);
  } catch (error) {
    discardCommitScope(scope);
    throw error;
  }
  await flushCommitScope(scope);
  return result;
}
