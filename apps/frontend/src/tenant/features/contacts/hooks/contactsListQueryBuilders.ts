import { CONTACTS_MODULE_MANIFEST, type ContactsQuickFilter, type Contact } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { createModuleListQueryBuilders } from "@/lib/query/createModuleListQueryBuilders";
import {
  CONTACTS_API,
  CONTACTS_QUERY_KEY,
} from "@/tenant/features/contacts/hooks/contactsQueryKeys";
import { assertContractOk } from "@/lib/apiContractError";

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

const builders = createModuleListQueryBuilders<ContactsPaginatedParams>({
  resolveApiPath: () => CONTACTS_API,
  resolveQueryKey: () => CONTACTS_QUERY_KEY,
  defaultPageSize: CONTACTS_MODULE_MANIFEST.defaultPageSize,
  keyStyle: "include",
  fields: [
    { name: "search", kind: "text", keyDefault: "" },
    { name: "gender", kind: "text", keyDefault: "" },
    { name: "includeDeleted", kind: "boolean", keyDefault: false },
    { name: "hasPhone", kind: "boolean", keyDefault: false },
    { name: "hasReachable", kind: "boolean", keyDefault: false },
    { name: "quickFilter", kind: "enum", keyDefault: "all", allValue: "all" },
    { name: "excludeIds", kind: "csv", keyDefault: "" },
    { name: "excludeLinkedModules", kind: "csv", keyDefault: "" },
    { name: "sortField", kind: "text", keyDefault: "" },
    { name: "sortDir", kind: "text", keyDefault: "asc" },
  ],
});

export const buildContactsPageUrl = builders.buildPageUrl;
export const contactsListQueryKeyParams = builders.listQueryKeyParams;
export const contactsPaginatedQueryKey = builders.paginatedQueryKey;
export const sameContactsListFilters = builders.sameListFilters;

/** Single SQL page — preferred for report visualizer (no unbounded walk). */
export async function fetchContactById(
  contactId: string,
  _signal?: AbortSignal,
): Promise<Contact | undefined> {
  const response = await apiContract.contacts.get({ params: { id: contactId } });
  assertContractOk(response, "Failed to fetch contact");
  const body = response.body as { contact?: Contact } | undefined;
  return body?.contact;
}
