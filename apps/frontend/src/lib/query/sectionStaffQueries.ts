import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  SectionStaffAssignmentSchema,
  SectionStudentRoleSchema,
  type SectionAssignmentEndBody,
  type SectionStaffAssignBody,
  type SectionStudentRoleBody,
} from "@mms/shared";
import { apiJson } from "@/lib/apiClient";

export const sectionStaffQueryKey = (sectionId: string) =>
  ["sessions", "section-staff", sectionId] as const;
export const sectionStudentRolesQueryKey = (sectionId: string) =>
  ["sessions", "section-student-roles", sectionId] as const;

const base = (sectionId: string) => `/api/sessions/sections/${encodeURIComponent(sectionId)}`;
const staffListSchema = z.object({ assignments: z.array(SectionStaffAssignmentSchema) });
const rolesListSchema = z.object({ roles: z.array(SectionStudentRoleSchema) });

/** Current + historical staff of a section (effective-dated). */
export function sectionStaffQueryOptions(sectionId: string | null, enabled: boolean) {
  return queryOptions({
    queryKey: sectionStaffQueryKey(sectionId ?? ""),
    queryFn: async ({ signal }) =>
      staffListSchema.parse(await apiJson<unknown>(`${base(sectionId ?? "")}/staff`, { signal }))
        .assignments,
    enabled: enabled && Boolean(sectionId),
    staleTime: 30_000,
  });
}

export function sectionStudentRolesQueryOptions(sectionId: string | null, enabled: boolean) {
  return queryOptions({
    queryKey: sectionStudentRolesQueryKey(sectionId ?? ""),
    queryFn: async ({ signal }) =>
      rolesListSchema.parse(
        await apiJson<unknown>(`${base(sectionId ?? "")}/student-roles`, { signal }),
      ).roles,
    enabled: enabled && Boolean(sectionId),
    staleTime: 30_000,
  });
}

const post = (sectionId: string, path: string, body: unknown) =>
  apiJson<unknown>(`${base(sectionId)}${path}`, { method: "POST", body: JSON.stringify(body) });

/** Write calls for section staff and student roles. */
export const sectionStaffApi = {
  assign: (sectionId: string, body: SectionStaffAssignBody) => post(sectionId, "/staff", body),
  end: (sectionId: string, assignmentId: string, body: SectionAssignmentEndBody) =>
    post(sectionId, `/staff/${encodeURIComponent(assignmentId)}/end`, body),
  addRole: (sectionId: string, body: SectionStudentRoleBody) =>
    post(sectionId, "/student-roles", body),
  endRole: (sectionId: string, roleId: string, body: SectionAssignmentEndBody) =>
    post(sectionId, `/student-roles/${encodeURIComponent(roleId)}/end`, body),
};
