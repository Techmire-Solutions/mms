/**
 * Submission idempotency key for a composer dispatch.
 *
 * The key must distinguish a *retry* of one submission (dedupe server-side) from
 * a *deliberate repeat* of the same campaign (must send again). Deriving it from
 * the payload alone — the previous approach — made every repeat within the 24 h
 * idempotency TTL replay the first response as a silent no-op.
 */
export interface SubmissionKeyState {
  digest: string;
  key: string;
  completed: boolean;
}

export interface ResolvedSubmissionKey {
  key: string;
  state: SubmissionKeyState;
}

/**
 * Reuses the key while the same composition is being retried, and mints a new one
 * when the composition changed or the previous submission already completed.
 */
export function resolveSubmissionKey(
  current: SubmissionKeyState | null,
  digest: string,
  mint: () => string,
): ResolvedSubmissionKey {
  if (current && current.digest === digest && !current.completed) {
    return { key: current.key, state: current };
  }
  const key = mint();
  return { key, state: { digest, key, completed: false } };
}
