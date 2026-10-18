import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SectionAssignmentEndBody,
  SectionStaffAssignBody,
  SectionStudentRoleBody,
} from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  sectionStaffApi,
  sectionStaffQueryKey,
  sectionStaffQueryOptions,
  sectionStudentRolesQueryKey,
  sectionStudentRolesQueryOptions,
} from "@/lib/query/sectionStaffQueries";
import { SESSIONS_QUERY_KEY } from "@/tenant/features/sessions/hooks/useSessions";

/** Current + historical staff of a section (effective-dated). */
export function useSectionStaff(sectionId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery(sectionStaffQueryOptions(sectionId, isAuthenticated));
}

export function useSectionStudentRoles(sectionId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery(sectionStudentRolesQueryOptions(sectionId, isAuthenticated));
}

/** Assign/end staff and student roles; invalidates the section lists and sessions (class teacher). */
export function useSectionStaffMutations(sectionId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: sectionStaffQueryKey(sectionId) });
    void queryClient.invalidateQueries({ queryKey: sectionStudentRolesQueryKey(sectionId) });
    void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
  };

  return {
    assign: useMutation({
      mutationFn: (body: SectionStaffAssignBody) => sectionStaffApi.assign(sectionId, body),
      onSuccess,
    }),
    end: useMutation({
      mutationFn: ({
        assignmentId,
        ...body
      }: SectionAssignmentEndBody & { assignmentId: string }) =>
        sectionStaffApi.end(sectionId, assignmentId, body),
      onSuccess,
    }),
    addRole: useMutation({
      mutationFn: (body: SectionStudentRoleBody) => sectionStaffApi.addRole(sectionId, body),
      onSuccess,
    }),
    endRole: useMutation({
      mutationFn: ({ roleId, ...body }: SectionAssignmentEndBody & { roleId: string }) =>
        sectionStaffApi.endRole(sectionId, roleId, body),
      onSuccess,
    }),
  };
}
