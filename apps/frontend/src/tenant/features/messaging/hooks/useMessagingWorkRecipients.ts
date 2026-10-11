import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  Contact,
  MessagingRoleFilter,
  MessagingGenderFilter,
  ContactsListPageResult,
  MessagingRecipientsMatchResponseDto,
  StandardMessagingRecipient,
} from "@mms/shared";
import { CONTACTS_MODULE_MANIFEST } from "@mms/shared";
import { apiJson } from "@/lib/apiClient";
import { useAuth } from "@/lib/contexts/AuthContext";

export const MESSAGING_RECIPIENTS_QUERY_KEY = ["messaging", "recipients"] as const;

export interface UseMessagingWorkRecipientsParams {
  roleFilter: MessagingRoleFilter;
  genderFilter: MessagingGenderFilter;
  search: string;
  page: number;
  pageSize?: number;
  enabled?: boolean;
}

export interface MessagingWorkRecipientsResult {
  contacts: Contact[];
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
  isError: boolean;
  isPending: boolean;
  isFetching: boolean;
  refetch: () => void;
}

/**
 * Loads matching lean recipients for “Select All With Phone/Email” via one server call.
 */
export async function loadMatchingRecipients(params: {
  roleFilter?: MessagingRoleFilter;
  genderFilter?: MessagingGenderFilter;
  search?: string;
  kind: "phone" | "email";
  signal?: AbortSignal;
}): Promise<{ recipients: StandardMessagingRecipient[]; truncated: boolean }> {
  const search = (params.search || "").trim();
  const searchParams = new URLSearchParams();
  searchParams.set("kind", params.kind);
  if (params.roleFilter && params.roleFilter !== "all") searchParams.set("role", params.roleFilter);
  if (params.genderFilter && params.genderFilter !== "all")
    searchParams.set("gender", params.genderFilter);
  if (search) searchParams.set("search", search);

  const data = await apiJson<MessagingRecipientsMatchResponseDto>(
    `/api/messaging/recipients/match?${searchParams.toString()}`,
    { signal: params.signal },
  );

  return {
    recipients: data.recipients ?? [],
    truncated: Boolean(data.truncated),
  };
}

/**
 * Work-tab recipients via GET /api/messaging/recipients (messaging RBAC + server pagination).
 */
export function useMessagingWorkRecipients(
  params: UseMessagingWorkRecipientsParams,
): MessagingWorkRecipientsResult {
  const { isAuthenticated } = useAuth();
  const pageSize = params.pageSize ?? CONTACTS_MODULE_MANIFEST.defaultPageSize;
  const enabled = params.enabled !== false && isAuthenticated;
  const role = params.roleFilter;
  const gender = params.genderFilter;
  const search = params.search.trim();
  const page = params.page;

  const query = useQuery({
    queryKey: [...MESSAGING_RECIPIENTS_QUERY_KEY, role, gender, search, page, pageSize] as const,
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("pageSize", String(pageSize));
      if (role !== "all") searchParams.set("role", role);
      if (gender !== "all") searchParams.set("gender", gender);
      if (search) searchParams.set("search", search);

      return apiJson<ContactsListPageResult>(
        `/api/messaging/recipients?${searchParams.toString()}`,
        { signal },
      );
    },
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const data = query.data;

  return (() => ({
    contacts: data?.contacts ?? [],
    page: data?.page ?? page,
    total: data?.total ?? 0,
    limit: data?.limit ?? pageSize,
    hasMore: Boolean(data?.hasMore),
    isError: query.isError,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: () => {
      void query.refetch();
    },
  }))();
}
