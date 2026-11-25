import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PlatformContactCreateInput,
  PlatformContactDto,
  PlatformContactUpdateInput,
} from "@mms/contracts";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { assertContractOk } from "@/lib/apiContractError";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { PLATFORM_QUERY_KEYS } from "@/platform/features/shell/lib/platformQueryKeys";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";

export function usePlatformContacts(
  params: {
    search?: string;
    kind?: string;
    limit?: number;
    offset?: number;
    deleted?: boolean;
  } = {},
) {
  const { isPlatformAuthenticated, canContacts } = usePlatformPermissions();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.contacts({
      ...params,
      deleted: params.deleted ? "true" : "false",
    }),
    queryFn: async ({ signal }) => {
      const response = await apiContract.platformContacts.list({
        query: {
          search: params.search,
          kind: params.kind as PlatformContactDto["kind"] | undefined,
          deleted: params.deleted,
          limit: params.limit ?? 100,
          offset: params.offset ?? 0,
        },
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        const body = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(response.status, body?.message ?? "Failed to load contacts", body?.type);
      }
      return (response.body as { contacts: PlatformContactDto[] }).contacts;
    },
    enabled: isPlatformAuthenticated && canContacts,
    staleTime: 30_000,
  });
}

export function usePlatformContactsMetrics() {
  const { isPlatformAuthenticated, canContacts } = usePlatformPermissions();
  return useQuery({
    queryKey: PLATFORM_QUERY_KEYS.contactMetrics,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platformContacts.metrics({
        signal,
        fetchOptions: { signal },
      });
      assertContractOk(response, "Failed to load contact metrics");
      return (response.body as { metrics: unknown }).metrics;
    },
    enabled: isPlatformAuthenticated && canContacts,
    staleTime: 30_000,
  });
}

export function useCreatePlatformContact() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: PlatformContactCreateInput) => {
      const response = await apiContract.platformContacts.create({ body: input });
      assertContractOk(response, "Failed to create contact");
      return (response.body as { contact: PlatformContactDto }).contact;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "contacts"] });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}

export function useUpdatePlatformContact() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PlatformContactUpdateInput }) => {
      const response = await apiContract.platformContacts.update({
        params: { id },
        body: input,
      });
      assertContractOk(response, "Failed to update contact");
      return (response.body as { contact: PlatformContactDto }).contact;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "contacts"] });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}

export function useRestorePlatformContact() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.platformContacts.restore({ params: { id }, body: {} });
      assertContractOk(response, "Failed to restore contact");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "contacts"] });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}

export function useDeletePlatformContact() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.platformContacts.delete({ params: { id }, body: {} });
      assertContractOk(response, "Failed to delete contact");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "contacts"] });
    },
    onError: (error) => notify.error(getPlatformErrorMessage(error, t)),
  });
}
