import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import { contacts } from "../contacts.js";
import { students, studentEnrolledSessionsLegacy } from "../students.js";
import {
  sessions,
  sessionFaculty,
  sessionClasses,
  sessionClassFees,
  sessionClassSchedules,
  sessionClassBudgets,
  sessionClassDiscounts,
  sessionClassTimetables,
  sessionClassTimetablePeriods,
  sessionClassRefreshments,
  scholarshipEligibilities,
  sessionClassScholarships,
} from "../sessions.js";
import { attendance, attendanceLeaves } from "../attendance.js";
import { enrollments, enrollmentTimelineEvents } from "../enrollments.js";
import { financeInvoices } from "../finance.js";
import { examResults } from "../examinations.js";
import { hasanatDistributions } from "../hasanat.js";
export const attendanceRelations = relations(attendance, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [attendance.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  student: one(students, {
    fields: [attendance.workspaceSubdomain, attendance.studentId],
    references: [students.workspaceSubdomain, students.id],
  }),
}));
export const attendanceLeavesRelations = relations(attendanceLeaves, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [attendanceLeaves.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  student: one(students, {
    fields: [attendanceLeaves.workspaceSubdomain, attendanceLeaves.studentId],
    references: [students.workspaceSubdomain, students.id],
  }),
}));
export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [enrollments.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  student: one(students, {
    fields: [enrollments.workspaceSubdomain, enrollments.studentId],
    references: [students.workspaceSubdomain, students.id],
  }),
  session: one(sessions, {
    fields: [enrollments.workspaceSubdomain, enrollments.sessionId],
    references: [sessions.workspaceSubdomain, sessions.id],
  }),
  sessionClass: one(sessionClasses, {
    fields: [enrollments.workspaceSubdomain, enrollments.sessionId, enrollments.classId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.sessionId, sessionClasses.id],
  }),
  timelineEvents: many(enrollmentTimelineEvents),
  invoices: many(financeInvoices),
}));
export const enrollmentTimelineEventsRelations = relations(enrollmentTimelineEvents, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [enrollmentTimelineEvents.workspaceSubdomain, enrollmentTimelineEvents.enrollmentId],
    references: [enrollments.workspaceSubdomain, enrollments.id],
  }),
}));
export const studentsRelations = relations(students, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [students.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  contact: one(contacts, {
    fields: [students.workspaceSubdomain, students.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
  fatherContact: one(contacts, {
    fields: [students.workspaceSubdomain, students.fatherContactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
  motherContact: one(contacts, {
    fields: [students.workspaceSubdomain, students.motherContactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
  guardianContact: one(contacts, {
    fields: [students.workspaceSubdomain, students.guardianContactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
  legacyEnrolledSessions: many(studentEnrolledSessionsLegacy),
  attendance: many(attendance),
  attendanceLeaves: many(attendanceLeaves),
  enrollments: many(enrollments),
  invoices: many(financeInvoices),
  examResults: many(examResults),
  hasanatDistributions: many(hasanatDistributions),
}));
export const studentEnrolledSessionsLegacyRelations = relations(
  studentEnrolledSessionsLegacy,
  ({ one }) => ({
    student: one(students, {
      fields: [
        studentEnrolledSessionsLegacy.workspaceSubdomain,
        studentEnrolledSessionsLegacy.studentId,
      ],
      references: [students.workspaceSubdomain, students.id],
    }),
    session: one(sessions, {
      fields: [
        studentEnrolledSessionsLegacy.workspaceSubdomain,
        studentEnrolledSessionsLegacy.sessionId,
      ],
      references: [sessions.workspaceSubdomain, sessions.id],
    }),
  }),
);

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sessions.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  faculty: many(sessionFaculty),
  classes: many(sessionClasses),
  enrollments: many(enrollments),
}));
export const sessionFacultyRelations = relations(sessionFaculty, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionFaculty.workspaceSubdomain, sessionFaculty.sessionId],
    references: [sessions.workspaceSubdomain, sessions.id],
  }),
}));
export const sessionClassesRelations = relations(sessionClasses, ({ one, many }) => ({
  session: one(sessions, {
    fields: [sessionClasses.workspaceSubdomain, sessionClasses.sessionId],
    references: [sessions.workspaceSubdomain, sessions.id],
  }),
  fees: many(sessionClassFees),
  schedules: many(sessionClassSchedules),
  budgets: many(sessionClassBudgets),
  discounts: many(sessionClassDiscounts),
  timetables: many(sessionClassTimetables),
  refreshments: many(sessionClassRefreshments),
  scholarships: many(sessionClassScholarships),
  enrollments: many(enrollments),
}));
export const sessionClassFeesRelations = relations(sessionClassFees, ({ one }) => ({
  class: one(sessionClasses, {
    fields: [sessionClassFees.workspaceSubdomain, sessionClassFees.sessionClassId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
  }),
}));
export const sessionClassSchedulesRelations = relations(sessionClassSchedules, ({ one }) => ({
  class: one(sessionClasses, {
    fields: [sessionClassSchedules.workspaceSubdomain, sessionClassSchedules.sessionClassId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
  }),
}));
export const sessionClassBudgetsRelations = relations(sessionClassBudgets, ({ one }) => ({
  class: one(sessionClasses, {
    fields: [sessionClassBudgets.workspaceSubdomain, sessionClassBudgets.sessionClassId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
  }),
}));
export const sessionClassDiscountsRelations = relations(sessionClassDiscounts, ({ one }) => ({
  class: one(sessionClasses, {
    fields: [sessionClassDiscounts.workspaceSubdomain, sessionClassDiscounts.sessionClassId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
  }),
}));
export const sessionClassTimetablesRelations = relations(
  sessionClassTimetables,
  ({ one, many }) => ({
    class: one(sessionClasses, {
      fields: [sessionClassTimetables.workspaceSubdomain, sessionClassTimetables.sessionClassId],
      references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
    }),
    periods: many(sessionClassTimetablePeriods),
  }),
);
export const sessionClassTimetablePeriodsRelations = relations(
  sessionClassTimetablePeriods,
  ({ one }) => ({
    timetable: one(sessionClassTimetables, {
      fields: [
        sessionClassTimetablePeriods.workspaceSubdomain,
        sessionClassTimetablePeriods.timetableId,
      ],
      references: [sessionClassTimetables.workspaceSubdomain, sessionClassTimetables.id],
    }),
  }),
);
export const sessionClassRefreshmentsRelations = relations(sessionClassRefreshments, ({ one }) => ({
  class: one(sessionClasses, {
    fields: [sessionClassRefreshments.workspaceSubdomain, sessionClassRefreshments.sessionClassId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
  }),
}));
export const scholarshipEligibilitiesRelations = relations(
  scholarshipEligibilities,
  ({ many }) => ({
    scholarships: many(sessionClassScholarships),
  }),
);
export const sessionClassScholarshipsRelations = relations(sessionClassScholarships, ({ one }) => ({
  class: one(sessionClasses, {
    fields: [sessionClassScholarships.workspaceSubdomain, sessionClassScholarships.sessionClassId],
    references: [sessionClasses.workspaceSubdomain, sessionClasses.id],
  }),
  eligibility: one(scholarshipEligibilities, {
    fields: [
      sessionClassScholarships.workspaceSubdomain,
      sessionClassScholarships.scholarshipEligibilityId,
    ],
    references: [scholarshipEligibilities.workspaceSubdomain, scholarshipEligibilities.id],
  }),
}));
