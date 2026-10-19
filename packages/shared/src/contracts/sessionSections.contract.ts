import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  SectionStaffAssignmentSchema,
  SectionStudentRoleSchema,
  sectionAssignmentEndBodySchema,
  sectionStaffAssignBodySchema,
  sectionStudentRoleBodySchema,
} from "../sessions/sessionSectionTypes.js";

const c = initContract();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const sectionParams = z.object({ sectionId: z.string().min(1).max(64) });
const writeErrors = {
  400: errorResponse,
  403: errorResponse,
  404: errorResponse,
  409: errorResponse,
  500: errorResponse,
};

/** Section staff (effective-dated teachers/assistants) and student roles (monitors). */
export const sessionSectionsContract = c.router({
  listStaff: {
    method: "GET",
    path: "/api/sessions/sections/:sectionId/staff",
    pathParams: sectionParams,
    responses: {
      200: z.object({ assignments: z.array(SectionStaffAssignmentSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Section staff assignments (current and history)",
  },
  assignStaff: {
    method: "POST",
    path: "/api/sessions/sections/:sectionId/staff",
    pathParams: sectionParams,
    body: sectionStaffAssignBodySchema,
    responses: { 201: z.object({ assignment: SectionStaffAssignmentSchema }), ...writeErrors },
    summary:
      "Assign or change a section teacher/assistant from a date (closes the previous holder)",
  },
  endStaff: {
    method: "POST",
    path: "/api/sessions/sections/:sectionId/staff/:assignmentId/end",
    pathParams: sectionParams.extend({ assignmentId: z.string().min(1).max(64) }),
    body: sectionAssignmentEndBodySchema,
    responses: { 200: z.object({ assignment: SectionStaffAssignmentSchema }), ...writeErrors },
    summary: "End a staff assignment on a date",
  },
  listStudentRoles: {
    method: "GET",
    path: "/api/sessions/sections/:sectionId/student-roles",
    pathParams: sectionParams,
    responses: {
      200: z.object({ roles: z.array(SectionStudentRoleSchema) }),
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Section student roles (monitors / assistants)",
  },
  addStudentRole: {
    method: "POST",
    path: "/api/sessions/sections/:sectionId/student-roles",
    pathParams: sectionParams,
    body: sectionStudentRoleBodySchema,
    responses: { 201: z.object({ role: SectionStudentRoleSchema }), ...writeErrors },
    summary: "Give an enrolled student a section role",
  },
  endStudentRole: {
    method: "POST",
    path: "/api/sessions/sections/:sectionId/student-roles/:roleId/end",
    pathParams: sectionParams.extend({ roleId: z.string().min(1).max(64) }),
    body: sectionAssignmentEndBodySchema,
    responses: { 200: z.object({ role: SectionStudentRoleSchema }), ...writeErrors },
    summary: "End a student role on a date",
  },
});
