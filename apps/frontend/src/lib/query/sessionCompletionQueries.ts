import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  sessionCompletionRowSchema,
  type SessionCertificatesBody,
  type SessionCompletionRow,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export const SESSION_COMPLETION_QUERY_KEY = ["sessions", "completion"] as const;

const base = (id: string) => `/api/sessions/${encodeURIComponent(id)}/completion`;
const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const rowsSchema = z.object({ rows: z.array(sessionCompletionRowSchema) });

/** Completion standing of every enrollment of a session. */
export function sessionCompletionQueryOptions(sessionId: string, enabled: boolean) {
  return queryOptions({
    queryKey: [...SESSION_COMPLETION_QUERY_KEY, sessionId] as const,
    queryFn: async ({ signal }): Promise<SessionCompletionRow[]> =>
      rowsSchema.parse(await apiJson<unknown>(base(sessionId), { signal })).rows,
    enabled: enabled && Boolean(sessionId),
    staleTime: 30_000,
  });
}

export function evaluateCompletionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "completion", "evaluate"] as const,
    mutationFn: async (id: string): Promise<SessionCompletionRow[]> =>
      rowsSchema.parse(await apiJson<unknown>(`${base(id)}/evaluate`, json({}))).rows,
  });
}

export function issueCertificatesMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "completion", "certificates"] as const,
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: SessionCertificatesBody;
    }): Promise<{ issued: string[]; rows: SessionCompletionRow[] }> =>
      z
        .object({ issued: z.array(z.string()), rows: z.array(sessionCompletionRowSchema) })
        .parse(await apiJson<unknown>(`${base(id)}/certificates`, json(body))),
  });
}
