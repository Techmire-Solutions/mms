import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InviteWorkspaceUserInput, WorkspaceRole } from "@mms/contracts";
import { apiFetch, apiJson } from "@mms/fe-core/api";
import { iamTenantKeys } from "../queryKeys.js";
import type { IamMemberSummary } from "../../../shared/types.js";

export interface TeamMembersPageResult {
  users: IamMemberSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

async function fetchMembers(): Promise<TeamMembersPageResult> {
  const response = await apiFetch("/api/iam/members?page=1&limit=50");
  if (!response.ok) throw new Error(`Failed to load team members (${response.status})`);
  return (await response.json()) as TeamMembersPageResult;
}

export function useTeamMembers() {
  return useQuery({ queryKey: iamTenantKeys.members({}), queryFn: fetchMembers });
}

export function useWorkspaceRoles() {
  return useQuery({
    queryKey: iamTenantKeys.roles(),
    queryFn: async (): Promise<WorkspaceRole[]> => {
      const body = await apiJson<{ roles: WorkspaceRole[] }>("/api/iam/roles");
      return body.roles;
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteWorkspaceUserInput) =>
      apiJson<{ user: IamMemberSummary; inviteEmailSent?: boolean; inviteEmailError?: string }>(
        "/api/iam/members/invite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: iamTenantKeys.all }),
  });
}
