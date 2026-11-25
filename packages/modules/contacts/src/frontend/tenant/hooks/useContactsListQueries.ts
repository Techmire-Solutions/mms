import { useQuery } from "@tanstack/react-query";
import type { Contact } from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";

import { uniqueRegistryIds } from "@mms/fe-core/lib/registryResolve";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { CONTACTS_QUERY_KEY, contactDetailQueryKey } from "./contactsQueryKeys.js";
import { fetchContactById } from "./contactsListQueryBuilders.js";

export type { ContactsPaginatedParams } from "./contactsListQueryBuilders.js";
export { contactsPaginatedQueryKey, fetchContactById } from "./contactsListQueryBuilders.js";

export function useContactById(contactId: string | undefined, enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: contactDetailQueryKey(contactId ?? ""),
    queryFn: ({ signal }) => fetchContactById(contactId!, signal),
    enabled: isAuthenticated && enabled && Boolean(contactId),
    staleTime: 10_000,
  });
}

/** Batch-resolve contact labels by id (pickers & cross-module links). */
export function useContactsByIds(ids: (string | number | null | undefined)[], enabled = true) {
  const { isAuthenticated } = useAuth();
  const normalized = uniqueRegistryIds(ids);
  return useQuery({
    queryKey: [...CONTACTS_QUERY_KEY, "resolve", normalized.join(",")] as const,
    queryFn: async ({ signal }) => {
      const hydrated: Contact[] = [];
      const resolveChunk = async (chunk: string[]) => {
        const response = await apiContract.contacts.resolve({
          body: { ids: chunk },
          signal,
          fetchOptions: { signal },
        });
        if (response.status === 200) {
          const body = response.body as { contacts?: Contact[] } | undefined;
          hydrated.push(...(body?.contacts ?? []));
        }
      };

      const chunkSize = 100;
      for (let index = 0; index < normalized.length; index += chunkSize) {
        await resolveChunk(normalized.slice(index, index + chunkSize));
      }

      return hydrated;
    },
    enabled: isAuthenticated && enabled && normalized.length > 0,
    staleTime: 60_000,
  });
}
