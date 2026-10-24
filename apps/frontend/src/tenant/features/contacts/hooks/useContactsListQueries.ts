import { useQuery } from "@tanstack/react-query";
import type { Contact } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";

import { uniqueRegistryIds } from "@/lib/registryResolve";
import { apiContract } from "@/lib/api";
import {
  CONTACTS_QUERY_KEY,
  contactDetailQueryKey,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";
import { fetchContactById } from "@/tenant/features/contacts/hooks/contactsListQueryBuilders";

export type { ContactsPaginatedParams } from "@/tenant/features/contacts/hooks/contactsListQueryBuilders";
export {
  contactsPaginatedQueryKey,
  fetchContactById,
} from "@/tenant/features/contacts/hooks/contactsListQueryBuilders";

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
export function useContactsByIds(ids: (string | number | null | undefined)[]) {
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
    enabled: isAuthenticated && normalized.length > 0,
    staleTime: 30_000,
  });
}
