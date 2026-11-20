import { mutationOptions, queryOptions } from "@tanstack/react-query";
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

/** Assign staff to a section. */
export function assignSectionStaffMutationOptions(sectionId: string) {
  return mutationOptions({
    mutationKey: ["sessions", "section-staff", sectionId, "assign"] as const,
    mutationFn: (body: SectionStaffAssignBody) => sectionStaffApi.assign(sectionId, body),
  });
}

/** End a staff assignment on a date. */
export function endSectionStaffMutationOptions(sectionId: string) {
  return mutationOptions({
    mutationKey: ["sessions", "section-staff", sectionId, "end"] as const,
    mutationFn: ({ assignmentId, ...body }: SectionAssignmentEndBody & { assignmentId: string }) =>
      sectionStaffApi.end(sectionId, assignmentId, body),
  });
}

/** Add a student role (e.g. class captain) to a section. */
export function addSectionStudentRoleMutationOptions(sectionId: string) {
  return mutationOptions({
    mutationKey: ["sessions", "section-student-roles", sectionId, "add"] as const,
    mutationFn: (body: SectionStudentRoleBody) => sectionStaffApi.addRole(sectionId, body),
  });
}

/** End a student role on a date. */
export function endSectionStudentRoleMutationOptions(sectionId: string) {
  return mutationOptions({
    mutationKey: ["sessions", "section-student-roles", sectionId, "end"] as const,
    mutationFn: ({ roleId, ...body }: SectionAssignmentEndBody & { roleId: string }) =>
      sectionStaffApi.endRole(sectionId, roleId, body),
  });
}
