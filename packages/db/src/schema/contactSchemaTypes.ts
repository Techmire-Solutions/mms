import {
  type contacts,
  type contactPhones,
  type contactEmails,
  type contactAddresses,
} from "./contactCoreTables.js";
import {
  type contactSocials,
  type contactEducations,
  type contactExperiences,
  type contactSkills,
  type contactTags,
  type contactRelationships,
  type contactActivities,
  type contactAttachments,
  type contactBankDetails,
} from "./contactProfileTables.js";
import {
  type tenantUsers,
  type contactGoogleSyncCredentials,
  type contactLookups,
  type contactFieldConfigs,
  type contactModulePreferences,
} from "./contactSetupTables.js";

export type ContactRow = typeof contacts.$inferSelect;
export type InsertContactRow = typeof contacts.$inferInsert;
export type ContactPhoneRow = typeof contactPhones.$inferSelect;
export type InsertContactPhoneRow = typeof contactPhones.$inferInsert;
export type ContactEmailRow = typeof contactEmails.$inferSelect;
export type InsertContactEmailRow = typeof contactEmails.$inferInsert;
export type ContactAddressRow = typeof contactAddresses.$inferSelect;
export type InsertContactAddressRow = typeof contactAddresses.$inferInsert;
export type ContactSocialRow = typeof contactSocials.$inferSelect;
export type InsertContactSocialRow = typeof contactSocials.$inferInsert;
export type ContactEducationRow = typeof contactEducations.$inferSelect;
export type InsertContactEducationRow = typeof contactEducations.$inferInsert;
export type ContactExperienceRow = typeof contactExperiences.$inferSelect;
export type InsertContactExperienceRow = typeof contactExperiences.$inferInsert;
export type ContactSkillRow = typeof contactSkills.$inferSelect;
export type InsertContactSkillRow = typeof contactSkills.$inferInsert;

export type ContactTagRow = typeof contactTags.$inferSelect;
export type InsertContactTagRow = typeof contactTags.$inferInsert;
export type ContactRelationshipRow = typeof contactRelationships.$inferSelect;
export type InsertContactRelationshipRow = typeof contactRelationships.$inferInsert;
export type ContactActivityRow = typeof contactActivities.$inferSelect;
export type InsertContactActivityRow = typeof contactActivities.$inferInsert;
export type ContactAttachmentRow = typeof contactAttachments.$inferSelect;
export type InsertContactAttachmentRow = typeof contactAttachments.$inferInsert;
export type ContactBankDetailRow = typeof contactBankDetails.$inferSelect;
export type InsertContactBankDetailRow = typeof contactBankDetails.$inferInsert;
export type TenantUserRow = typeof tenantUsers.$inferSelect;
export type InsertTenantUserRow = typeof tenantUsers.$inferInsert;
export type ContactGoogleSyncCredentialRow = typeof contactGoogleSyncCredentials.$inferSelect;
export type InsertContactGoogleSyncCredentialRow = typeof contactGoogleSyncCredentials.$inferInsert;
export type ContactLookupsRow = typeof contactLookups.$inferSelect;
export type InsertContactLookupsRow = typeof contactLookups.$inferInsert;
export type ContactFieldConfigsRow = typeof contactFieldConfigs.$inferSelect;
export type InsertContactFieldConfigsRow = typeof contactFieldConfigs.$inferInsert;
export type ContactModulePreferencesRow = typeof contactModulePreferences.$inferSelect;
export type InsertContactModulePreferencesRow = typeof contactModulePreferences.$inferInsert;
