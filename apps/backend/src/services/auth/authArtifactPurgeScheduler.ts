import { purgeExpiredAuthArtifacts } from "./authArtifactService.js";

const DEFAULT_AUTH_ARTIFACT_PURGE_MS = 15 * 60 * 1000;

/**
 * Periodically deletes expired auth_artifacts. Cleared when the Fastify app closes.
 * Interval is short enough for OTP TTL hygiene without hammering Postgres.
 */
export function startAuthArtifactPurgeScheduler(
  log: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void },
  intervalMs = DEFAULT_AUTH_ARTIFACT_PURGE_MS,
): () => void {
  const tick = async (): Promise<void> => {
    try {
      await purgeExpiredAuthArtifacts();
    } catch (error) {
      log.warn({ err: error }, "auth artifact purge failed");
    }
  };

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();

  log.info({ intervalMs }, "auth artifact purge scheduler started");

  return () => {
    clearInterval(timer);
  };
}
