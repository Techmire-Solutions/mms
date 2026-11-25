import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import {
  addSectionStudentRoleMutationOptions,
  assignSectionStaffMutationOptions,
  endSectionStaffMutationOptions,
  endSectionStudentRoleMutationOptions,
  sectionStaffQueryKey,
  sectionStaffQueryOptions,
  sectionStudentRolesQueryKey,
  sectionStudentRolesQueryOptions,
} from "../hooks/sectionStaffQueries.js";
import { invalidateSessionDependents } from "./invalidateSessionDependents";

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
    invalidateSessionDependents(queryClient);
  };

  return {
    assign: useMutation({ ...assignSectionStaffMutationOptions(sectionId), onSuccess }),
    end: useMutation({ ...endSectionStaffMutationOptions(sectionId), onSuccess }),
    addRole: useMutation({ ...addSectionStudentRoleMutationOptions(sectionId), onSuccess }),
    endRole: useMutation({ ...endSectionStudentRoleMutationOptions(sectionId), onSuccess }),
  };
}
