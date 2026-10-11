import { BACKUP_UPLOAD_MAX_BYTES } from "@mms/shared";

/**
 * Max JSON body for bulk sync upload. Defaults to the shared upload cap
 * (`BACKUP_UPLOAD_MAX_BYTES`) so the FE file-picker limit and the BE body limit
 * stay in sync; override via `MMS_SYNC_MAX_BODY_BYTES`.
 */
export const SYNC_MAX_BODY_BYTES =
  Number(process.env.MMS_SYNC_MAX_BODY_BYTES) || BACKUP_UPLOAD_MAX_BYTES;

/** Wall-clock cap for bulk sync processing (default 2 min). Override via `MMS_SYNC_REQUEST_TIMEOUT_MS`. */
export const SYNC_REQUEST_TIMEOUT_MS = Number(process.env.MMS_SYNC_REQUEST_TIMEOUT_MS) || 120_000;

/** Thrown by aborted sync work so the restore transaction rolls back. */
export const SYNC_ABORTED_MESSAGE = "backup.syncTimeout";

export function throwIfSyncAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error(SYNC_ABORTED_MESSAGE);
  }
}

/**
 * Runs bulk sync work under a wall-clock cap.
 *
 * On timeout the signal is aborted and the operation is awaited to settlement, so a
 * partially applied restore transaction is rolled back before the 408 is returned.
 * Never resolve the timeout independently of the operation — that would let the
 * transaction commit after the client was told the restore failed.
 */
export async function withSyncTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = SYNC_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (timedOut) {
      throw Object.assign(new Error(SYNC_ABORTED_MESSAGE), {
        statusCode: 408,
        type: "server_error",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
