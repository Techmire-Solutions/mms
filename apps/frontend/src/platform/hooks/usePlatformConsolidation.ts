import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConsolidationGroup,
  ConsolidationGroupPut,
  ConsolidationReport,
  ConsolidationReportQuery,
} from "@mms/shared";
import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";

const GROUPS_KEY = ["platform", "consolidation", "groups"] as const;
const REPORT_KEY = ["platform", "consolidation", "report"] as const;

function assertOk(response: { status: number; body: unknown }, context: string): void {
  if (response.status >= 200 && response.status < 300) return;
  const errorBody = response.body as { message?: string; type?: string } | undefined;
  throw new ApiError(response.status, errorBody?.message ?? context, errorBody?.type);
}

export function useConsolidationGroups() {
  const { isPlatformAuthenticated, canWorkspaces } = usePlatformPermissions();
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiContract.platformConsolidation.listGroups({
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to load consolidation groups");
      return (response.body as { groups: ConsolidationGroup[] }).groups;
    },
    enabled: isPlatformAuthenticated && canWorkspaces,
  });
}

export function useSaveConsolidationGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ConsolidationGroupPut }) => {
      const response = await apiContract.platformConsolidation.putGroup({ params: { id }, body });
      assertOk(response, "Failed to save consolidation group");
      return (response.body as { group: ConsolidationGroup }).group;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
      void queryClient.invalidateQueries({ queryKey: REPORT_KEY });
    },
  });
}

export function useDeleteConsolidationGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiContract.platformConsolidation.deleteGroup({
        params: { id },
        body: {},
      });
      assertOk(response, "Failed to delete consolidation group");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

/** The consolidated report for a group and period; runs only once both are chosen. */
export function useConsolidationReport(
  groupId: string | null,
  period: ConsolidationReportQuery | null,
) {
  const { isPlatformAuthenticated, canWorkspaces } = usePlatformPermissions();
  return useQuery({
    queryKey: [...REPORT_KEY, groupId, period],
    queryFn: async ({ signal }) => {
      const response = await apiContract.platformConsolidation.getReport({
        params: { id: groupId as string },
        query: period as ConsolidationReportQuery,
        signal,
        fetchOptions: { signal },
      });
      assertOk(response, "Failed to build consolidation report");
      return (response.body as { report: ConsolidationReport }).report;
    },
    enabled: isPlatformAuthenticated && canWorkspaces && Boolean(groupId && period),
    retry: false,
  });
}
