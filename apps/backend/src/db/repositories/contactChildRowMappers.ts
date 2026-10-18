import type {
  PhoneNumber,
  EmailAddress,
  Address,
  SocialLink,
  ContactEducation,
  ContactExperience,
  ContactSkill,
  ContactBankDetail,
  RelationshipContact,
  ContactActivity,
  ContactAttachment,
} from "@mms/shared";
import type {
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

type PhoneRow = typeof contactPhones.$inferSelect;
type EmailRow = typeof contactEmails.$inferSelect;
type AddressRow = typeof contactAddresses.$inferSelect;
type SocialRow = typeof contactSocials.$inferSelect;
type EducationRow = typeof contactEducations.$inferSelect;
type ExperienceRow = typeof contactExperiences.$inferSelect;
type SkillRow = typeof contactSkills.$inferSelect;
type RelationshipRow = typeof contactRelationships.$inferSelect;
type ActivityRow = typeof contactActivities.$inferSelect;
type AttachmentRow = typeof contactAttachments.$inferSelect;
type BankDetailRow = typeof contactBankDetails.$inferSelect;

export function mapChildPhones(phones: PhoneRow[] = []): PhoneNumber[] {
  return phones.map((p) => {
    const phone: PhoneNumber = {
      label: p.label || "Main",
      number: p.number,
      isPrimary: p.isPrimary,
    };
    if (p.countryCode) phone.countryCode = p.countryCode;
    if (p.whatsappStatus) phone.whatsappStatus = p.whatsappStatus as PhoneNumber["whatsappStatus"];
    return phone;
  });
}

export function mapChildEmails(emails: EmailRow[] = []): EmailAddress[] {
  return emails.map((e) => ({
    label: e.label || "Primary",
    address: e.address,
    isPrimary: e.isPrimary,
    isVerified: e.isVerified,
  }));
}

export function mapChildAddresses(addresses: AddressRow[] = []): Address[] {
  return addresses.map((a) => {
    const addr: Address = {
      isPrimary: a.isPrimary,
    };
    if (a.label) addr.label = a.label;
    if (a.line1) addr.line1 = a.line1;
    if (a.city) addr.city = a.city;
    if (a.state) addr.state = a.state;
    if (a.country) addr.country = a.country;
    return addr;
  });
}

export function mapChildSocials(socials: SocialRow[] = []): SocialLink[] {
  return socials.map((s) => ({
    platform: s.platform,
    url: s.url,
  }));
}

export function mapChildEducations(educations: EducationRow[] = []): ContactEducation[] {
  return educations.map((edu) => {
    const item: ContactEducation = {
      id: edu.id,
      institution: edu.institution,
      sortOrder: edu.sortOrder,
    };
    if (edu.degree) item.degree = edu.degree;
    if (edu.fieldOfStudy) item.fieldOfStudy = edu.fieldOfStudy;
    if (edu.year) item.year = edu.year;
    if (edu.grade) item.grade = edu.grade;
    if (edu.label) item.label = edu.label;
    return item;
  });
}

export function mapChildExperiences(experiences: ExperienceRow[] = []): ContactExperience[] {
  return experiences.map((exp) => {
    const item: ContactExperience = {
      id: exp.id,
      title: exp.title,
      organization: exp.organization,
      isCurrent: exp.isCurrent,
      sortOrder: exp.sortOrder,
    };
    if (exp.employmentType) item.employmentType = exp.employmentType;
    if (exp.location) item.location = exp.location;
    if (exp.startDate) item.startDate = exp.startDate;
    if (exp.endDate) item.endDate = exp.endDate;
    if (exp.description) item.description = exp.description;
    return item;
  });
}

export function mapChildSkills(skills: SkillRow[] = []): ContactSkill[] {
  return skills.map((s) => {
    const item: ContactSkill = {
      id: s.id,
      name: s.name,
      isCertified: s.isCertified,
      sortOrder: s.sortOrder,
    };
    if (s.category) item.category = s.category;
    if (s.proficiency) item.proficiency = s.proficiency;
    if (s.yearsOfExperience) item.yearsOfExperience = s.yearsOfExperience;
    if (s.issuer) item.issuer = s.issuer;
    if (s.description) item.description = s.description;
    return item;
  });
}

export function mapChildRelationships(
  relationships: RelationshipRow[] = [],
): RelationshipContact[] {
  return relationships.map((r) => {
    const item: RelationshipContact = {
      inferred: r.inferred,
      inferenceDepth: r.inferenceDepth,
    };
    if (r.name) item.name = r.name;
    if (r.relationship) item.relationship = r.relationship;
    if (r.phone) item.phone = r.phone;
    if (r.relatedContactId) item.contactId = r.relatedContactId;
    if (r.inferredFromContactId) item.inferredFromContactId = r.inferredFromContactId;
    return item;
  });
}

export function mapChildActivities(activities: ActivityRow[] = []): ContactActivity[] {
  return activities.map((act) => {
    const item: ContactActivity = {
      id: act.id,
      type: act.type as ContactActivity["type"],
      content: act.content,
      date: act.date,
    };
    if (act.by) item.by = act.by;
    return item;
  });
}

export function mapChildAttachments(attachments: AttachmentRow[] = []): ContactAttachment[] {
  return attachments.map((att) => ({
    id: att.id,
    name: att.name,
    type: att.type,
    size: att.size,
    url: att.url,
    date: att.date,
  }));
}

export function mapChildBankDetails(bankDetails: BankDetailRow[] = []): ContactBankDetail[] {
  return bankDetails.map((b) => ({
    id: b.id,
    bankName: b.bankName,
    accountTitle: b.accountTitle,
    accountNumber: b.accountNumber,
    sortOrder: b.sortOrder,
  }));
}
