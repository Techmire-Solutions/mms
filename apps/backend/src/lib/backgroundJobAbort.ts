/** Throws a named AbortError when a background job's abort signal has fired. */
export function throwIfBackgroundJobAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("Background job aborted");
  error.name = "AbortError";
  throw error;
}

/**
 * Waits for an in-flight execution to settle, but never longer than `timeoutMs`.
 * Used after a sandbox timeout so the retry cannot overlap the abandoned run.
 */
export async function settleInFlight(promise: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
  });
  try {
    await Promise.race([promise.catch(() => undefined), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
