import { CONTACTS_MODULE_MANIFEST, type ContactsQuickFilter, type Contact } from "@mms/shared";
import { apiContract } from "@/lib/api";
import {
  CONTACTS_API,
  CONTACTS_QUERY_KEY,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";

export interface ContactsPaginatedParams {
  page: number;
  limit?: number;
  search?: string;
  gender?: string;
  includeDeleted?: boolean;
  sortField?: string;
  sortDir?: "asc" | "desc";
  hasPhone?: boolean;
  hasReachable?: boolean;
  quickFilter?: ContactsQuickFilter;
  excludeIds?: Array<string | number>;
  excludeLinkedModules?: Array<"students" | "faculty">;
  enabled?: boolean;
}

export function buildContactsPageUrl(params: ContactsPaginatedParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set("page", String(params.page));
  queryParams.set("limit", String(params.limit ?? CONTACTS_MODULE_MANIFEST.defaultPageSize));
  if (params.search?.trim()) queryParams.set("search", params.search.trim());
  if (params.gender) queryParams.set("gender", params.gender);
  if (params.includeDeleted) queryParams.set("includeDeleted", "true");
  if (params.hasPhone) queryParams.set("hasPhone", "true");
  if (params.hasReachable) queryParams.set("hasReachable", "true");
  if (params.quickFilter && params.quickFilter !== "all") {
    queryParams.set("quickFilter", params.quickFilter);
  }
  if (params.excludeIds && params.excludeIds.length > 0) {
    queryParams.set("excludeIds", params.excludeIds.map(String).join(","));
  }
  if (params.excludeLinkedModules && params.excludeLinkedModules.length > 0) {
    queryParams.set("excludeLinkedModules", params.excludeLinkedModules.join(","));
  }
  if (params.sortField) queryParams.set("sortField", params.sortField);
  if (params.sortDir) queryParams.set("sortDir", params.sortDir);
  return `${CONTACTS_API}?${queryParams.toString()}`;
}

export function contactsListQueryKeyParams(params: ContactsPaginatedParams) {
  return {
    page: params.page,
    limit: params.limit ?? CONTACTS_MODULE_MANIFEST.defaultPageSize,
    search: params.search?.trim() || "",
    gender: params.gender || "",
    includeDeleted: Boolean(params.includeDeleted),
    hasPhone: Boolean(params.hasPhone),
    hasReachable: Boolean(params.hasReachable),
    quickFilter: params.quickFilter ?? "all",
    excludeIds: (params.excludeIds ?? []).map(String).join(","),
    excludeLinkedModules: (params.excludeLinkedModules ?? []).join(","),
    sortField: params.sortField || "",
    sortDir: params.sortDir || "asc",
  };
}

export function contactsPaginatedQueryKey(params: ContactsPaginatedParams) {
  return [...CONTACTS_QUERY_KEY, "page", contactsListQueryKeyParams(params)] as const;
}

export function sameContactsListFilters(
  previous: ReturnType<typeof contactsListQueryKeyParams> | undefined,
  next: ReturnType<typeof contactsListQueryKeyParams>,
): boolean {
  if (!previous) return false;
  return (
    previous.search === next.search &&
    previous.gender === next.gender &&
    previous.includeDeleted === next.includeDeleted &&
    previous.hasPhone === next.hasPhone &&
    previous.hasReachable === next.hasReachable &&
    previous.quickFilter === next.quickFilter &&
    previous.excludeIds === next.excludeIds &&
    previous.excludeLinkedModules === next.excludeLinkedModules &&
    previous.sortField === next.sortField &&
    previous.sortDir === next.sortDir &&
    previous.limit === next.limit
  );
}

/** Single SQL page — preferred for report visualizer (no unbounded walk). */
export async function fetchContactById(
  contactId: string,
  _signal?: AbortSignal,
): Promise<Contact | undefined> {
  const response = await apiContract.contacts.get({ params: { id: contactId } });
  if (response.status !== 200) throw new Error("Failed to fetch contact");
  const body = response.body as { contact?: Contact } | undefined;
  return body?.contact;
}
