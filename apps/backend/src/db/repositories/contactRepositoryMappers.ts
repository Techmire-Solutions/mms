import { hydrateContactRelationshipFields, type Contact } from "@mms/shared";
import {
  type contacts,
  type contactTags,
  type contactPhones,
  type contactEmails,
  type contactAddresses,
  type contactSocials,
  type contactEducations,
  type contactExperiences,
  type contactSkills,
  type contactRelationships,
  type contactActivities,
  type contactAttachments,
  type contactBankDetails,
} from "../schema.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";
import {
  mapChildPhones,
  mapChildEmails,
  mapChildAddresses,
  mapChildSocials,
  mapChildEducations,
  mapChildExperiences,
  mapChildSkills,
  mapChildRelationships,
  mapChildActivities,
  mapChildAttachments,
  mapChildBankDetails,
} from "./contactChildRowMappers.js";

type ContactRow = typeof contacts.$inferSelect;
type PhoneRow = typeof contactPhones.$inferSelect;
type EmailRow = typeof contactEmails.$inferSelect;
type AddressRow = typeof contactAddresses.$inferSelect;
type TagRow = typeof contactTags.$inferSelect;
type SocialRow = typeof contactSocials.$inferSelect;
type EducationRow = typeof contactEducations.$inferSelect;
type ExperienceRow = typeof contactExperiences.$inferSelect;
type SkillRow = typeof contactSkills.$inferSelect;
type RelationshipRow = typeof contactRelationships.$inferSelect;
type ActivityRow = typeof contactActivities.$inferSelect;
type AttachmentRow = typeof contactAttachments.$inferSelect;
type BankDetailRow = typeof contactBankDetails.$inferSelect;

export function contactRowToRecord(
  row: ContactRow,
  phones: PhoneRow[] = [],
  emails: EmailRow[] = [],
  addresses: AddressRow[] = [],
  tagsRows: TagRow[] = [],
  socials: SocialRow[] = [],
  educations: EducationRow[] = [],
  experiences: ExperienceRow[] = [],
  skills: SkillRow[] = [],
  relationships: RelationshipRow[] = [],
  activities: ActivityRow[] = [],
  attachments: AttachmentRow[] = [],
  bankDetails: BankDetailRow[] = [],
): Contact {
  const contact: Contact = {
    id: row.id,
    firstName: row.firstName,
    name: row.name,
    isSyed: row.isSyed,
    tags: tagsRows.map((t) => t.name),
    tag: tagsRows.map((t) => t.name).join(", "),
    whatsappStatus: (row.whatsappStatus as Contact["whatsappStatus"]) ?? "unknown",
    phones: mapChildPhones(phones),
    emails: mapChildEmails(emails),
    addresses: mapChildAddresses(addresses),
    socials: mapChildSocials(socials),
    education: mapChildEducations(educations),
    experience: mapChildExperiences(experiences),
    skills: mapChildSkills(skills),
    bankDetails: mapChildBankDetails(bankDetails),
    relationshipContacts: mapChildRelationships(relationships),
    activities: mapChildActivities(activities),
    attachments: mapChildAttachments(attachments),
    ...mapAuditTimestamps(row),
  };

  if (row.lastName) contact.lastName = row.lastName;
  if (row.gender) contact.gender = row.gender as Contact["gender"];
  if (row.dob) contact.dob = row.dob;
  if (row.cnic) contact.cnic = row.cnic;
  if (row.avatar) contact.avatar = row.avatar;
  if (row.notes) contact.notes = row.notes;
  if (row.lastCheckedAt) {
    contact.lastCheckedAt =
      row.lastCheckedAt instanceof Date
        ? row.lastCheckedAt.toISOString()
        : String(row.lastCheckedAt);
  }
  if (row.aiSummary) contact.aiSummary = row.aiSummary;

  return hydrateContactRelationshipFields(contact);
}
