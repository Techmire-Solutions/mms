import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  SessionSchema,
  sessionActivityItemSchema,
  sessionCancelResultSchema,
  type Session,
  type SessionActivityItem,
  type SessionCancelBody,
  type SessionCancelResult,
  type SessionPostponeBody,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export const SESSION_ACTIVITY_QUERY_KEY = ["sessions", "activity"] as const;

const base = (id: string) => `/api/sessions/${encodeURIComponent(id)}`;
const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

/** Dated activity of one session (newest first). */
export function sessionActivityQueryOptions(sessionId: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...SESSION_ACTIVITY_QUERY_KEY, sessionId] as const,
    queryFn: async ({ signal }): Promise<SessionActivityItem[]> =>
      z
        .object({ items: z.array(sessionActivityItemSchema) })
        .parse(await apiJson<unknown>(`${base(sessionId)}/activity`, { signal })).items,
    enabled: enabled && Boolean(sessionId),
    staleTime: 30_000,
  });
}

export function cancelSessionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "cancel"] as const,
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: SessionCancelBody;
    }): Promise<SessionCancelResult> =>
      sessionCancelResultSchema.parse(await apiJson<unknown>(`${base(id)}/cancel`, json(body))),
  });
}

export function postponeSessionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "postpone"] as const,
    mutationFn: async ({ id, body }: { id: string; body: SessionPostponeBody }): Promise<Session> =>
      z
        .object({ session: SessionSchema })
        .parse(await apiJson<unknown>(`${base(id)}/postpone`, json(body))).session,
  });
}
