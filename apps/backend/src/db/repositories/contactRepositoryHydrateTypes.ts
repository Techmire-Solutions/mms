import type {
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
} from "../schema.js";
import { type TenantTransaction } from "../tenant-context.js";

export type Transaction = TenantTransaction;
export type PhoneRow = typeof contactPhones.$inferSelect;
export type EmailRow = typeof contactEmails.$inferSelect;
export type AddressRow = typeof contactAddresses.$inferSelect;
export type TagRow = typeof contactTags.$inferSelect;
export type SocialRow = typeof contactSocials.$inferSelect;
export type EducationRow = typeof contactEducations.$inferSelect;
export type ExperienceRow = typeof contactExperiences.$inferSelect;
export type SkillRow = typeof contactSkills.$inferSelect;
export type RelationshipRow = typeof contactRelationships.$inferSelect;
export type ActivityRow = typeof contactActivities.$inferSelect;
export type AttachmentRow = typeof contactAttachments.$inferSelect;
export type BankDetailRow = typeof contactBankDetails.$inferSelect;

export interface ContactChildMaps {
  phonesMap: Map<string, PhoneRow[]>;
  emailsMap: Map<string, EmailRow[]>;
  addressesMap: Map<string, AddressRow[]>;
  tagsMap: Map<string, TagRow[]>;
  socialsMap: Map<string, SocialRow[]>;
  educationsMap: Map<string, EducationRow[]>;
  experiencesMap: Map<string, ExperienceRow[]>;
  skillsMap: Map<string, SkillRow[]>;
  relationshipsMap: Map<string, RelationshipRow[]>;
  activitiesMap: Map<string, ActivityRow[]>;
  attachmentsMap: Map<string, AttachmentRow[]>;
  bankDetailsMap: Map<string, BankDetailRow[]>;
}

export function createEmptyContactChildMaps(): ContactChildMaps {
  return {
    phonesMap: new Map(),
    emailsMap: new Map(),
    addressesMap: new Map(),
    tagsMap: new Map(),
    socialsMap: new Map(),
    educationsMap: new Map(),
    experiencesMap: new Map(),
    skillsMap: new Map(),
    relationshipsMap: new Map(),
    activitiesMap: new Map(),
    attachmentsMap: new Map(),
    bankDetailsMap: new Map(),
  };
}
