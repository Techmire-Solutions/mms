import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import { backgroundJobs, userActivityLogs } from "../system.js";
import { auditTrailEvents, auditVerificationRuns } from "../auditTrail.js";
import {
  contacts,
  contactTags,
  contactPhones,
  contactEmails,
  contactAddresses,
  contactSocials,
  contactEducations,
  contactExperiences,
  contactSkills,
  contactRelationships,
  contactActivities,
  contactAttachments,
  contactBankDetails,
  tenantUsers,
} from "../contacts.js";
import { students } from "../students.js";
import { faculty } from "../faculty.js";
import { messageLogs } from "../messaging.js";

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [contacts.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  phones: many(contactPhones),
  emails: many(contactEmails),
  addresses: many(contactAddresses),
  tags: many(contactTags),
  socials: many(contactSocials),
  educations: many(contactEducations),
  experiences: many(contactExperiences),
  skills: many(contactSkills),
  relationships: many(contactRelationships),
  activities: many(contactActivities),
  attachments: many(contactAttachments),
  bankDetails: many(contactBankDetails),
  students: many(students),
  faculty: many(faculty),
  tenantUsers: many(tenantUsers),
  messageLogs: many(messageLogs),
}));

export const contactPhonesRelations = relations(contactPhones, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactPhones.workspaceSubdomain, contactPhones.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactEmailsRelations = relations(contactEmails, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactEmails.workspaceSubdomain, contactEmails.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactAddressesRelations = relations(contactAddresses, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactAddresses.workspaceSubdomain, contactAddresses.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.workspaceSubdomain, contactTags.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactSocialsRelations = relations(contactSocials, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactSocials.workspaceSubdomain, contactSocials.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactEducationsRelations = relations(contactEducations, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactEducations.workspaceSubdomain, contactEducations.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactExperiencesRelations = relations(contactExperiences, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactExperiences.workspaceSubdomain, contactExperiences.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactSkillsRelations = relations(contactSkills, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactSkills.workspaceSubdomain, contactSkills.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactRelationshipsRelations = relations(contactRelationships, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactRelationships.workspaceSubdomain, contactRelationships.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactActivitiesRelations = relations(contactActivities, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactActivities.workspaceSubdomain, contactActivities.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactAttachmentsRelations = relations(contactAttachments, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactAttachments.workspaceSubdomain, contactAttachments.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const contactBankDetailsRelations = relations(contactBankDetails, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactBankDetails.workspaceSubdomain, contactBankDetails.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tenantUsers.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  contact: one(contacts, {
    fields: [tenantUsers.workspaceSubdomain, tenantUsers.contactId],
    references: [contacts.workspaceSubdomain, contacts.id],
  }),
  faculty: many(faculty),
  backgroundJobs: many(backgroundJobs),
  userActivityLogs: many(userActivityLogs),
  auditTrailEvents: many(auditTrailEvents),
  auditVerificationRuns: many(auditVerificationRuns),
}));
