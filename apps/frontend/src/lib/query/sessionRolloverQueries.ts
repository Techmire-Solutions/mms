import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  promotionPreviewRowSchema,
  sessionRolloverRunSchema,
  type PromotionPreviewRow,
  type SessionRolloverInput,
  type SessionRolloverRun,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export const SESSION_ROLLOVER_RUNS_QUERY_KEY = ["sessions", "rollover-runs"] as const;

const base = (id: string) => `/api/sessions/${encodeURIComponent(id)}/rollover`;
const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

/** Recent rollover runs started from one session (polls while one is queued or running). */
export function sessionRolloverRunsQueryOptions(sessionId: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...SESSION_ROLLOVER_RUNS_QUERY_KEY, sessionId] as const,
    queryFn: async ({ signal }): Promise<SessionRolloverRun[]> =>
      z
        .object({ runs: z.array(sessionRolloverRunSchema) })
        .parse(await apiJson<unknown>(`${base(sessionId)}/runs`, { signal })).runs,
    enabled: enabled && Boolean(sessionId),
    staleTime: 10_000,
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "queued" || run.status === "running")
        ? 3_000
        : false,
  });
}

export function previewRolloverMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "rollover", "preview"] as const,
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: SessionRolloverInput;
    }): Promise<PromotionPreviewRow[]> =>
      z
        .object({ rows: z.array(promotionPreviewRowSchema) })
        .parse(await apiJson<unknown>(`${base(id)}/preview`, json(body))).rows,
  });
}

export function startRolloverMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "rollover", "start"] as const,
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: SessionRolloverInput;
    }): Promise<SessionRolloverRun> =>
      z
        .object({ run: sessionRolloverRunSchema })
        .parse(await apiJson<unknown>(base(id), json(body))).run,
  });
}
