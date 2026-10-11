import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import { contacts, tenantUsers } from "../contacts.js";
import {
  faculty,
  facultyDesignations,
  facultyDesignationRoles,
  facultyDepartments,
  facultyAssignments,
  facultyEmployments,
  facultyEmployDesignations,
} from "../faculty.js";
import { hasanatDistributions } from "../hasanat.js";

export const facultyDesignationsRelations = relations(facultyDesignations, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [facultyDesignations.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  department: one(facultyDepartments, {
    fields: [facultyDesignations.workspaceSubdomain, facultyDesignations.departmentId],
    references: [facultyDepartments.workspaceSubdomain, facultyDepartments.id],
  }),
  parent: one(facultyDesignations, {
    fields: [facultyDesignations.workspaceSubdomain, facultyDesignations.parentDesignationId],
    references: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
    relationName: "designation_hierarchy",
  }),
  children: many(facultyDesignations, { relationName: "designation_hierarchy" }),
  roles: many(facultyDesignationRoles),
  facultyAssignments: many(facultyAssignments),
  employDesignations: many(facultyEmployDesignations),
}));

export const facultyDesignationRolesRelations = relations(facultyDesignationRoles, ({ one }) => ({
  designation: one(facultyDesignations, {
    fields: [facultyDesignationRoles.workspaceSubdomain, facultyDesignationRoles.designationId],
    references: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
  }),
}));

export const facultyRelations = relations(faculty, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [faculty.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  user: one(tenantUsers, {
    fields: [faculty.workspaceSubdomain, faculty.userId],
    references: [tenantUsers.workspaceSubdomain, tenantUsers.id],
  }),
  employment: one(facultyEmployments, {
    fields: [faculty.workspaceSubdomain, faculty.employmentId],
    references: [facultyEmployments.workspaceSubdomain, facultyEmployments.id],
  }),
  hasanatDistributions: many(hasanatDistributions),
  assignments: many(facultyAssignments),
}));

export const facultyEmploymentsRelations = relations(facultyEmployments, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [facultyEmployments.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  contact: one(contacts, {
    fields: [facultyEmployments.workspaceSubdomain, facultyEmployments.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
  facultyProfiles: many(faculty),
  employDesignations: many(facultyEmployDesignations),
}));

export const facultyEmployDesignationsRelations = relations(
  facultyEmployDesignations,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [facultyEmployDesignations.workspaceSubdomain],
      references: [workspaces.subdomain],
    }),
    employment: one(facultyEmployments, {
      fields: [
        facultyEmployDesignations.workspaceSubdomain,
        facultyEmployDesignations.employmentId,
      ],
      references: [facultyEmployments.workspaceSubdomain, facultyEmployments.id],
    }),
    designation: one(facultyDesignations, {
      fields: [
        facultyEmployDesignations.workspaceSubdomain,
        facultyEmployDesignations.designationId,
      ],
      references: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
    }),
  }),
);

export const facultyDepartmentsRelations = relations(facultyDepartments, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [facultyDepartments.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  parent: one(facultyDepartments, {
    fields: [facultyDepartments.workspaceSubdomain, facultyDepartments.parentId],
    references: [facultyDepartments.workspaceSubdomain, facultyDepartments.id],
    relationName: "dept_hierarchy",
  }),
  children: many(facultyDepartments, {
    relationName: "dept_hierarchy",
  }),
  designations: many(facultyDesignations),
  assignments: many(facultyAssignments),
}));

export const facultyAssignmentsRelations = relations(facultyAssignments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [facultyAssignments.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  faculty: one(faculty, {
    fields: [facultyAssignments.workspaceSubdomain, facultyAssignments.facultyId],
    references: [faculty.workspaceSubdomain, faculty.id],
  }),
  department: one(facultyDepartments, {
    fields: [facultyAssignments.workspaceSubdomain, facultyAssignments.departmentId],
    references: [facultyDepartments.workspaceSubdomain, facultyDepartments.id],
  }),
  designation: one(facultyDesignations, {
    fields: [facultyAssignments.workspaceSubdomain, facultyAssignments.designationId],
    references: [facultyDesignations.workspaceSubdomain, facultyDesignations.id],
  }),
}));
