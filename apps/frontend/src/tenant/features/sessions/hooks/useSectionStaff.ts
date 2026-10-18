import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  SectionStaffAssignmentSchema,
  SectionStudentRoleSchema,
  type SectionAssignmentEndBody,
  type SectionStaffAssignBody,
  type SectionStudentRoleBody,
} from '@mms/shared';
import { apiJson } from '@/lib/apiClient';
import { useAuth } from '@/lib/contexts/AuthContext';
import { SESSIONS_QUERY_KEY } from '@/tenant/features/sessions/hooks/useSessions';

const staffKey = (sectionId: string) => ['sessions', 'section-staff', sectionId] as const;
const rolesKey = (sectionId: string) => ['sessions', 'section-student-roles', sectionId] as const;
const base = (sectionId: string) => `/api/sessions/sections/${encodeURIComponent(sectionId)}`;

const staffListSchema = z.object({ assignments: z.array(SectionStaffAssignmentSchema) });
const rolesListSchema = z.object({ roles: z.array(SectionStudentRoleSchema) });

/** Current + historical staff of a section (effective-dated). */
export function useSectionStaff(sectionId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: staffKey(sectionId ?? ''),
    queryFn: async ({ signal }) => staffListSchema.parse(await apiJson<unknown>(`${base(sectionId ?? '')}/staff`, { signal })).assignments,
    enabled: isAuthenticated && Boolean(sectionId),
    staleTime: 30_000,
  });
}

export function useSectionStudentRoles(sectionId: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: rolesKey(sectionId ?? ''),
    queryFn: async ({ signal }) => rolesListSchema.parse(await apiJson<unknown>(`${base(sectionId ?? '')}/student-roles`, { signal })).roles,
    enabled: isAuthenticated && Boolean(sectionId),
    staleTime: 30_000,
  });
}

/** Assign/end staff and student roles; invalidates the section lists and sessions (class teacher). */
export function useSectionStaffMutations(sectionId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: staffKey(sectionId) });
    void queryClient.invalidateQueries({ queryKey: rolesKey(sectionId) });
    void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
  };
  const post = (path: string, body: unknown) => apiJson<unknown>(`${base(sectionId)}${path}`, { method: 'POST', body: JSON.stringify(body) });

  return {
    assign: useMutation({ mutationFn: (body: SectionStaffAssignBody) => post('/staff', body), onSuccess }),
    end: useMutation({
      mutationFn: ({ assignmentId, ...body }: SectionAssignmentEndBody & { assignmentId: string }) =>
        post(`/staff/${encodeURIComponent(assignmentId)}/end`, body),
      onSuccess,
    }),
    addRole: useMutation({ mutationFn: (body: SectionStudentRoleBody) => post('/student-roles', body), onSuccess }),
    endRole: useMutation({
      mutationFn: ({ roleId, ...body }: SectionAssignmentEndBody & { roleId: string }) =>
        post(`/student-roles/${encodeURIComponent(roleId)}/end`, body),
      onSuccess,
    }),
  };
}
