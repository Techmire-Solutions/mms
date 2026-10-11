import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { connectTenantDatabaseSocket } from "@/lib/tenantWebSocket";
import { MODULE_ACCESS_INVALIDATION_KEYS, type BackgroundJobEventMessage } from "@mms/shared";
import { MODULE_ACCESS_QUERY_KEY } from "@/lib/query/moduleAccessQuery";
import {
  patchLocalBackgroundJobOnly,
  upsertLocalBackgroundJob,
} from "@/lib/backgroundJobs/backgroundJobStore";
import { fetchBackgroundJob } from "@/lib/backgroundJobs/pollBackgroundJob";
import { reportClientError } from "@/lib/clientErrorReporting";

let invalidateModulePromise: Promise<typeof import("@/lib/tenant/invalidateModuleQueries")> | null =
  null;

function getInvalidateModuleQueries() {
  if (!invalidateModulePromise) {
    invalidateModulePromise = import("@/lib/tenant/invalidateModuleQueries").catch((err) => {
      invalidateModulePromise = null;
      throw err;
    });
  }
  return invalidateModulePromise;
}

/**
 * Subscribes to tenant `/api/ws` and invalidates Query keys for live collection updates.
 * Also handles job-progress/completed/failed events from the BullMQ worker pipeline,
 * updating the local job store and triggering collection invalidations on completion.
 * Mount once under TenantScopedProviders when authenticated.
 */
export function useTenantDatabaseUpdates(): void {
  const { isAuthenticated, authChecked } = useAuth();
  const queryClient = useQueryClient();

  // Coalesce rapid collection invalidations arriving in the same frame tick
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const cancelScheduleRef = useRef<(() => void) | null>(null);

  const flushInvalidations = useCallback(() => {
    cancelScheduleRef.current = null;
    const keys = Array.from(pendingKeysRef.current);
    pendingKeysRef.current.clear();

    if (keys.length === 0) return;

    void getInvalidateModuleQueries()
      .then(({ invalidateModuleQueries }) => {
        for (const key of keys) {
          invalidateModuleQueries(queryClient, key);
        }
      })
      .catch((err) => {
        reportClientError(err, { context: "useTenantDatabaseUpdates.dispatch" });
      });
  }, [queryClient]);

  const scheduleInvalidate = useCallback(
    (key: string) => {
      pendingKeysRef.current.add(key);
      if (cancelScheduleRef.current === null) {
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          const id = window.requestAnimationFrame(() => {
            cancelScheduleRef.current = null;
            flushInvalidations();
          });
          cancelScheduleRef.current = () => window.cancelAnimationFrame(id);
        } else {
          const id = setTimeout(() => {
            cancelScheduleRef.current = null;
            flushInvalidations();
          }, 16);
          cancelScheduleRef.current = () => clearTimeout(id);
        }
      }
    },
    [flushInvalidations],
  );

  useEffect(() => {
    return () => {
      cancelScheduleRef.current?.();
      cancelScheduleRef.current = null;
      pendingKeysRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !authChecked) return;

    return connectTenantDatabaseSocket({
      onDatabaseUpdate: (message) => {
        if (message.type === "object" && MODULE_ACCESS_INVALIDATION_KEYS.has(message.key)) {
          void queryClient.invalidateQueries({ queryKey: MODULE_ACCESS_QUERY_KEY });
          return;
        }
        if (message.type !== "collection") return;
        scheduleInvalidate(message.key);
      },

      onJobEvent: (message: BackgroundJobEventMessage) => {
        // Optimistically patch local job state to avoid hammering the backend on rapid progress events
        const patched = patchLocalBackgroundJobOnly(message.jobId, {
          status:
            message.event === "job-progress"
              ? "running"
              : message.event === "job-failed"
                ? "failed"
                : "completed",
          progress: message.progress,
          hasDownload: message.hasDownload,
          error: message.error,
          completedAt: message.completedAt,
        });

        // Only fetch if missing locally or if it's the final event (to ensure we don't miss final DB state)
        if (!patched || message.event !== "job-progress") {
          void fetchBackgroundJob(message.jobId)
            .then((job) => {
              if (job) upsertLocalBackgroundJob(job);
            })
            .catch((err) => {
              reportClientError(err, {
                context: "useTenantDatabaseUpdates.fetchJob",
                jobId: message.jobId,
              });
            });
        }

        // On completion, invalidate the relevant module collection so directory
        // refreshes automatically (e.g. after a CSV import or bulk operation).
        if (message.event === "job-completed" && message.moduleId) {
          scheduleInvalidate(message.moduleId);
        }
      },
    });
  }, [authChecked, isAuthenticated, queryClient, scheduleInvalidate]);
}
