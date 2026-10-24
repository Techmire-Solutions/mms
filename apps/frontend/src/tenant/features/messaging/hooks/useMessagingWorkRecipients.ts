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
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/lib/contexts/AuthContext";

export const MESSAGING_RECIPIENTS_QUERY_KEY = ["messaging", "recipients"] as const;

export interface UseMessagingWorkRecipientsParams {
  roleFilter: MessagingRoleFilter;
  genderFilter: MessagingGenderFilter;
  search: string;
  page: number;
  pageSize?: number;
  hasPhone?: boolean;
  hasEmail?: boolean;
  kind?: "phone" | "email";
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
  const response = await apiContract.messaging.matchRecipients({
    query: {
      kind: params.kind,
      ...(params.roleFilter && params.roleFilter !== "all" ? { role: params.roleFilter } : {}),
      ...(params.genderFilter && params.genderFilter !== "all"
        ? { gender: params.genderFilter }
        : {}),
      ...(search ? { search } : {}),
    },
    signal: params.signal,
    fetchOptions: { signal: params.signal },
  });
  if (response.status !== 200) {
    const errorBody = response.body as { message?: string; type?: string } | undefined;
    throw new ApiError(
      response.status,
      errorBody?.message ?? "Failed to load matching recipients",
      errorBody?.type,
    );
  }

  const data = response.body as MessagingRecipientsMatchResponseDto;
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
  const hasPhone = params.kind === "phone" ? true : params.hasPhone;
  const hasEmail = params.kind === "email" ? true : params.hasEmail;

  const query = useQuery({
    queryKey: [
      ...MESSAGING_RECIPIENTS_QUERY_KEY,
      role,
      gender,
      search,
      hasPhone,
      hasEmail,
      page,
      pageSize,
    ] as const,
    queryFn: async ({ signal }) => {
      const response = await apiContract.messaging.listRecipients({
        query: {
          page,
          pageSize,
          ...(role !== "all" ? { role } : {}),
          ...(gender !== "all" ? { gender } : {}),
          ...(search ? { search } : {}),
          ...(hasPhone ? { hasPhone: "true" } : {}),
          ...(hasEmail ? { hasEmail: "true" } : {}),
        },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to load messaging recipients",
          errorBody?.type,
        );
      }
      return response.body as ContactsListPageResult;
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
