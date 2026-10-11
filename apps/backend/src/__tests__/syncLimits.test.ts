import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SYNC_ABORTED_MESSAGE,
  SYNC_MAX_BODY_BYTES,
  SYNC_REQUEST_TIMEOUT_MS,
  throwIfSyncAborted,
  withSyncTimeout,
} from "../lib/syncLimits.js";
import { BACKUP_UPLOAD_MAX_BYTES } from "@mms/shared";

describe("syncLimits", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constants", () => {
    it("provides sensible defaults for sync limits", () => {
      expect(SYNC_MAX_BODY_BYTES).toBe(BACKUP_UPLOAD_MAX_BYTES);
      expect(SYNC_REQUEST_TIMEOUT_MS).toBe(120_000);
      expect(SYNC_ABORTED_MESSAGE).toBe("backup.syncTimeout");
    });
  });

  describe("throwIfSyncAborted", () => {
    it("does nothing when signal is omitted or undefined", () => {
      expect(() => throwIfSyncAborted()).not.toThrow();
      expect(() => throwIfSyncAborted(undefined)).not.toThrow();
    });

    it("does nothing when signal is active and not aborted", () => {
      const controller = new AbortController();
      expect(() => throwIfSyncAborted(controller.signal)).not.toThrow();
    });

    it("throws SYNC_ABORTED_MESSAGE error when signal is aborted", () => {
      const controller = new AbortController();
      controller.abort();
      expect(() => throwIfSyncAborted(controller.signal)).toThrow(SYNC_ABORTED_MESSAGE);
    });
  });

  describe("withSyncTimeout", () => {
    it("returns the operation result when it finishes in time", async () => {
      await expect(withSyncTimeout(async () => "done", 500)).resolves.toBe("done");
    });

    it("uses default SYNC_REQUEST_TIMEOUT_MS when timeout parameter is omitted", async () => {
      await expect(withSyncTimeout(async () => "completed")).resolves.toBe("completed");
    });

    it("aborts the operation and waits for rollback before rejecting with 408", async () => {
      vi.useFakeTimers();
      let rolledBack = false;

      const result = withSyncTimeout(async (signal) => {
        try {
          await new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => resolve(), { once: true });
          });
          throwIfSyncAborted(signal);
        } catch (error) {
          // Simulates the transaction unwinding before the response is sent.
          rolledBack = true;
          throw error;
        }
      }, 20);

      const assertion = expect(result).rejects.toMatchObject({
        message: SYNC_ABORTED_MESSAGE,
        statusCode: 408,
        type: "server_error",
      });

      await vi.advanceTimersByTimeAsync(25);

      await assertion;
      expect(rolledBack).toBe(true);
    });

    it("propagates operation failures unchanged when no timeout fired", async () => {
      await expect(
        withSyncTimeout(async () => {
          throw new Error("backup.missingAdminUser");
        }, 500),
      ).rejects.toThrow("backup.missingAdminUser");
    });
  });
});
