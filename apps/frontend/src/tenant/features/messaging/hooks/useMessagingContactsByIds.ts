import { useQuery } from "@tanstack/react-query";
import type { StandardMessagingRecipient } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

/** Kept stable so contact mutations keep invalidating Reports hydrate. */
export const MESSAGING_CONTACTS_RESOLVE_QUERY_KEY = ["messaging", "contacts", "resolve"] as const;
const RESOLVE_BATCH_SIZE = 100;

/**
 * Resolve lean messaging recipients under messaging.read (not contacts.read).
 */
export function useMessagingRecipientsByIds(ids: (string | number | null | undefined)[]) {
  const { isAuthenticated } = useAuth();
  const normalized = (() =>
    [
      ...new Set(
        ids.filter((id) => id !== null && id !== undefined && String(id).length > 0).map(String),
      ),
    ].sort())();
  const signature = normalized.join(",");

  const query = useQuery({
    queryKey: [...MESSAGING_CONTACTS_RESOLVE_QUERY_KEY, signature] as const,
    queryFn: async ({ signal }) => {
      const chunks: string[][] = [];
      for (let index = 0; index < normalized.length; index += RESOLVE_BATCH_SIZE) {
        chunks.push(normalized.slice(index, index + RESOLVE_BATCH_SIZE));
      }

      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const response = await apiContract.messaging.resolveContacts({
            body: { ids: chunk },
            signal,
            fetchOptions: { signal },
          });
          if (response.status !== 200) {
            const errorBody = response.body as { message?: string; type?: string } | undefined;
            throw new ApiError(
              response.status,
              errorBody?.message ?? "Failed to resolve messaging contacts",
              errorBody?.type,
            );
          }
          return (response.body as { recipients?: StandardMessagingRecipient[] }).recipients ?? [];
        }),
      );

      return results.flat();
    },
    enabled: isAuthenticated && normalized.length > 0,
    staleTime: 30_000,
  });

  const recipients = query.data ?? [];

  const recipientMap = (() =>
    new Map(
      recipients.flatMap((recipient) => [
        [recipient.id, recipient],
        [String(recipient.id), recipient],
      ]),
    ))();

  const getRecipient = (
    id: string | number | null | undefined,
  ): StandardMessagingRecipient | null => {
    if (id === null || id === undefined) return null;
    return recipientMap.get(id) ?? recipientMap.get(String(id)) ?? null;
  };

  return {
    ...query,
    recipients,
    recipientMap,
    getRecipient,
  };
}
