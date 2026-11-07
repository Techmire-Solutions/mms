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

export { SESSION_ACTIVITY_QUERY_KEY } from "./sessionQueryKeys.js";
import { SESSION_ACTIVITY_QUERY_KEY } from "./sessionQueryKeys.js";

const base = (id: string) => `/api/sessions/${encodeURIComponent(id)}`;

/** OCC token headers: the state the caller read, echoed so a concurrent change is refused. */
function tokenHeaders(token?: {
  expectedVersion?: number;
  expectedUpdatedAt?: string;
}): Record<string, string> {
  if (!token) return {};
  return {
    ...(token.expectedVersion !== undefined
      ? { "x-expected-version": String(token.expectedVersion) }
      : {}),
    ...(token.expectedUpdatedAt ? { "x-expected-updated-at": token.expectedUpdatedAt } : {}),
  };
}

const json = (
  body: unknown,
  token?: { expectedVersion?: number; expectedUpdatedAt?: string },
): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  headers: { "content-type": "application/json", ...tokenHeaders(token) },
});

export interface SessionOperationToken {
  expectedVersion?: number;
  expectedUpdatedAt?: string;
}

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
      token,
    }: {
      id: string;
      body: SessionCancelBody;
      token?: SessionOperationToken;
    }): Promise<SessionCancelResult> =>
      sessionCancelResultSchema.parse(
        await apiJson<unknown>(`${base(id)}/cancel`, json(body, token)),
      ),
  });
}

export function postponeSessionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "postpone"] as const,
    mutationFn: async ({
      id,
      body,
      token,
    }: {
      id: string;
      body: SessionPostponeBody;
      token?: SessionOperationToken;
    }): Promise<Session> =>
      z
        .object({ session: SessionSchema })
        .parse(await apiJson<unknown>(`${base(id)}/postpone`, json(body, token))).session,
  });
}
