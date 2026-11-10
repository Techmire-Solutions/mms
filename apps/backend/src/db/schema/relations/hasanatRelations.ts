import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import { students } from "../students.js";
import { faculty } from "../faculty.js";
import { sessionClasses, sessions } from "../sessions.js";
import {
  hasanatDenoms,
  hasanatBatches,
  hasanatDistributions,
  hasanatRedemptions,
} from "../hasanat.js";

export const hasanatDenomsRelations = relations(hasanatDenoms, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [hasanatDenoms.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  batches: many(hasanatBatches),
  distributions: many(hasanatDistributions),
}));

export const hasanatBatchesRelations = relations(hasanatBatches, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [hasanatBatches.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  denomination: one(hasanatDenoms, {
    fields: [hasanatBatches.workspaceSubdomain, hasanatBatches.denominationId],
    references: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
  }),
  distributions: many(hasanatDistributions),
}));

export const hasanatDistributionsRelations = relations(hasanatDistributions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [hasanatDistributions.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  batch: one(hasanatBatches, {
    fields: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.batchId],
    references: [hasanatBatches.workspaceSubdomain, hasanatBatches.id],
  }),
  denomination: one(hasanatDenoms, {
    fields: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.denominationId],
    references: [hasanatDenoms.workspaceSubdomain, hasanatDenoms.id],
  }),
  recipientStudent: one(students, {
    fields: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.recipientStudentId],
    references: [students.workspaceSubdomain, students.id],
  }),
  recipientFaculty: one(faculty, {
    fields: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.recipientFacultyId],
    references: [faculty.workspaceSubdomain, faculty.id],
  }),
  sessionClass: one(sessionClasses, {
    fields: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.classId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
  }),
  session: one(sessions, {
    fields: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.sessionId],
    references: [sessions.workspaceSubdomain, sessions.id],
  }),
  redemptions: many(hasanatRedemptions),
}));

export const hasanatRedemptionsRelations = relations(hasanatRedemptions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [hasanatRedemptions.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  distribution: one(hasanatDistributions, {
    fields: [hasanatRedemptions.workspaceSubdomain, hasanatRedemptions.distributionId],
    references: [hasanatDistributions.workspaceSubdomain, hasanatDistributions.id],
  }),
  student: one(students, {
    fields: [hasanatRedemptions.workspaceSubdomain, hasanatRedemptions.studentId],
    references: [students.workspaceSubdomain, students.id],
  }),
}));
