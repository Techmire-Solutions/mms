import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BackgroundJobRecord } from "@mms/shared";
import { fetchBackgroundJobs } from "@/lib/backgroundJobs/backgroundJobApi";
import {
  BACKGROUND_JOBS_EVENT,
  clearFinishedBackgroundJobs,
  dismissBackgroundJob,
  getAllBackgroundJobs,
  mergeServerBackgroundJobs,
} from "@/lib/backgroundJobs/backgroundJobStore";
import { useAuth } from "@/lib/contexts/AuthContext";

/**
 * Background-job cache key carries the `auth` segment so `canPersistQuery` never
 * restores a previous session's job list from IndexedDB.
 */
export const BACKGROUND_JOBS_QUERY_KEY = ["auth", "background-jobs"] as const;

/**
 * Background jobs for the signed-in user: server list refreshed on store change
 * events (no ad-hoc polling), merged with the locally-tracked running jobs.
 */
export function useBackgroundJobs() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [localTick, setLocalTick] = useState(0);

  const { data: serverJobs = [] } = useQuery({
    queryKey: BACKGROUND_JOBS_QUERY_KEY,
    queryFn: ({ signal }) => fetchBackgroundJobs(signal),
    enabled: isAuthenticated,
    staleTime: 5_000,
  });

  useEffect(() => {
    const handler = () => {
      setLocalTick((n) => n + 1);
      void queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEY });
    };
    window.addEventListener(BACKGROUND_JOBS_EVENT, handler);
    return () => window.removeEventListener(BACKGROUND_JOBS_EVENT, handler);
  }, [queryClient]);

  // `localTick` forces the local-store merge to re-evaluate on every change
  // event, mirroring the server list once it arrives.
  const jobs = (() => {
    const _tick = localTick;
    return mergeServerBackgroundJobs(serverJobs.length > 0 ? serverJobs : getAllBackgroundJobs());
  })();
  const activeJobs = jobs.filter((j) => j.status === "running");

  const refresh = () => {
    setLocalTick((n) => n + 1);
    void queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEY });
  };

  return {
    jobs,
    activeJobs,
    activeCount: activeJobs.length,
    dismiss: dismissBackgroundJob,
    clearFinished: clearFinishedBackgroundJobs,
    refresh,
  };
}

export type { BackgroundJobRecord };
