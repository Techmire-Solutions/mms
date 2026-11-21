import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { CONTACTS_QUERY_KEY } from "@/tenant/features/contacts/hooks/contactsQueryKeys";

interface ContactsPageBody {
  contacts: Array<{ id: string | number }>;
  total?: number;
}

function isPageBody(value: unknown): value is ContactsPageBody {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { contacts?: unknown }).contacts)
  );
}

function withoutIds(body: ContactsPageBody, ids: ReadonlySet<string>): ContactsPageBody {
  const contacts = body.contacts.filter((contact) => !ids.has(String(contact.id)));
  const removed = body.contacts.length - contacts.length;
  if (removed === 0) return body;
  return {
    ...body,
    contacts,
    ...(typeof body.total === "number" ? { total: Math.max(0, body.total - removed) } : {}),
  };
}

/** Drop `ids` from a cached contacts page in either the raw (`{contacts}`) or contract (`{body}`) shape. */
function hideInCachedPage(data: unknown, ids: ReadonlySet<string>): unknown {
  if (isPageBody(data)) return withoutIds(data, ids);
  if (typeof data === "object" && data !== null && isPageBody((data as { body?: unknown }).body)) {
    const wrapped = data as { body: ContactsPageBody };
    const body = withoutIds(wrapped.body, ids);
    return body === wrapped.body ? data : { ...wrapped, body };
  }
  return data;
}

/**
 * Optimistically removes contacts from every cached Contacts list page so a delete
 * feels instant; returns a rollback that restores the exact snapshots on failure.
 * The caller still invalidates on settle, so the server stays authoritative.
 */
export async function hideContactsInListCaches(
  queryClient: QueryClient,
  ids: ReadonlyArray<string | number>,
): Promise<() => void> {
  const hidden = new Set(ids.map(String));
  await queryClient.cancelQueries({ queryKey: CONTACTS_QUERY_KEY });
  const snapshots: Array<[QueryKey, unknown]> = queryClient.getQueriesData({
    queryKey: CONTACTS_QUERY_KEY,
  });
  for (const [key, data] of snapshots) {
    const next = hideInCachedPage(data, hidden);
    if (next !== data) queryClient.setQueryData(key, next);
  }
  return () => {
    for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
  };
}
