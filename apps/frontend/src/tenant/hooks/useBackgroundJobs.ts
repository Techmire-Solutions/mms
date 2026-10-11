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

export const BACKGROUND_JOBS_QUERY_KEY = ["background-jobs"] as const;

export function useBackgroundJobs() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [localTick, setLocalTick] = useState(0);

  const { data: serverJobs = [] } = useQuery({
    queryKey: BACKGROUND_JOBS_QUERY_KEY,
    queryFn: fetchBackgroundJobs,
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

  const jobs = (() => {
    const _tick = localTick; // forces local cache re-evaluation
    return mergeServerBackgroundJobs(serverJobs.length > 0 ? serverJobs : getAllBackgroundJobs());
  })();

  const refresh = () => {
    setLocalTick((n) => n + 1);
    void queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEY });
  };

  return {
    jobs,
    activeJobs: jobs.filter((j) => j.status === "running"),
    activeCount: jobs.filter((j) => j.status === "running").length,
    dismiss: dismissBackgroundJob,
    clearFinished: clearFinishedBackgroundJobs,
    refresh,
  };
}

export type { BackgroundJobRecord };
