import {
  type Contact,
  type PhoneNumber as ContactPhone,
  type EmailAddress as ContactEmail,
  type Address as ContactAddress,
  type SocialLink as ContactSocial,
  type ContactEducation,
  type ContactExperience,
  type ContactSkill,
  type ContactBankDetail,
  type RelationshipContact,
  type ContactActivity,
  type ContactAttachment,
  getContactTags,
} from "./contactTypes.js";

const EXCLUDED_MERGE_KEYS = new Set([
  "id",
  "name",
  "phones",
  "emails",
  "addresses",
  "socials",
  "education",
  "experience",
  "skills",
  "relationshipContacts",
  "relationships",
  "activities",
  "attachments",
  "tag",
  "tags",
  "notes",
  "createdAt",
  "updatedAt",
]);

export const mergeContacts = (keep: Contact, other: Contact): Contact => {
  const merged: Contact = { ...keep };

  // Merge all basic properties dynamically
  for (const key of Object.keys(other)) {
    if (EXCLUDED_MERGE_KEYS.has(key)) continue;
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
      merged[key] = other[key];
    }
  }

  // Recalculate full name if firstName or lastName was merged/changed
  const first = (merged.firstName as string | undefined) || "";
  const last = (merged.lastName as string | undefined) || "";
  merged.name = [first, last].filter(Boolean).join(" ") || merged.name;

  // Merge tags: union unique tags
  const combinedTags = [...new Set([...getContactTags(keep), ...getContactTags(other)])];
  if (combinedTags.length > 0) {
    merged.tags = combinedTags;
    merged.tag = combinedTags.join(", ");
  }

  // Merge phones list: match by normalized number
  const seenNumbers = new Set<string>();
  const mergedPhones: ContactPhone[] = [];

  const addPhone = (phone: ContactPhone | undefined): void => {
    if (!phone || !phone.number) return;
    const normalizedNumber = phone.number.replace(/[^\d]/g, "");
    if (!seenNumbers.has(normalizedNumber)) {
      seenNumbers.add(normalizedNumber);
      mergedPhones.push({ ...phone });
    }
  };

  (keep.phones || []).forEach(addPhone);
  (other.phones || []).forEach(addPhone);
  merged.phones = mergedPhones;

  // Merge emails list: match by normalized address
  const seenEmails = new Set<string>();
  const mergedEmails: ContactEmail[] = [];

  const addEmail = (email: ContactEmail | undefined): void => {
    if (!email || !email.address) return;
    const normalizedAddress = email.address.trim().toLowerCase();
    if (!seenEmails.has(normalizedAddress)) {
      seenEmails.add(normalizedAddress);
      mergedEmails.push({ ...email });
    }
  };

  (keep.emails || []).forEach(addEmail);
  (other.emails || []).forEach(addEmail);
  merged.emails = mergedEmails;

  // Merge addresses list: match by simple content key
  const seenAddresses = new Set<string>();
  const mergedAddresses: ContactAddress[] = [];

  const addAddress = (address: ContactAddress | undefined): void => {
    if (!address) return;
    const key = [address.line1, address.city, address.state, address.country]
      .filter(Boolean)
      .map((segment) => segment!.trim().toLowerCase())
      .join("|");
    if (!seenAddresses.has(key)) {
      seenAddresses.add(key);
      mergedAddresses.push({ ...address });
    }
  };

  (keep.addresses || []).forEach(addAddress);
  (other.addresses || []).forEach(addAddress);
  merged.addresses = mergedAddresses;

  // Merge socials list: match by normalized URL
  const seenSocials = new Set<string>();
  const mergedSocials: ContactSocial[] = [];

  const addSocial = (social: ContactSocial | undefined): void => {
    if (!social || !social.url) return;
    const normalizedUrl = social.url.trim().toLowerCase();
    if (!seenSocials.has(normalizedUrl)) {
      seenSocials.add(normalizedUrl);
      mergedSocials.push({ ...social });
    }
  };

  (keep.socials || []).forEach(addSocial);
  (other.socials || []).forEach(addSocial);
  merged.socials = mergedSocials;

  // Merge education list: match by degree & institution & year
  const seenEducation = new Set<string>();
  const mergedEducation: ContactEducation[] = [];

  const addEducation = (edu: ContactEducation | undefined): void => {
    if (!edu || !edu.institution) return;
    const key = [edu.degree, edu.institution, edu.fieldOfStudy, edu.year]
      .filter(Boolean)
      .map((seg) => seg!.trim().toLowerCase())
      .join("|");
    if (!seenEducation.has(key)) {
      seenEducation.add(key);
      mergedEducation.push({ ...edu });
    }
  };

  (keep.education || []).forEach(addEducation);
  (other.education || []).forEach(addEducation);
  merged.education = mergedEducation;

  // Merge experience list: match by title & organization & startDate
  const seenExperience = new Set<string>();
  const mergedExperience: ContactExperience[] = [];

  const addExperience = (exp: ContactExperience | undefined): void => {
    if (!exp || !exp.organization || !exp.title) return;
    const key = [exp.title, exp.organization, exp.startDate]
      .filter(Boolean)
      .map((seg) => seg!.trim().toLowerCase())
      .join("|");
    if (!seenExperience.has(key)) {
      seenExperience.add(key);
      mergedExperience.push({ ...exp });
    }
  };

  (keep.experience || []).forEach(addExperience);
  (other.experience || []).forEach(addExperience);
  merged.experience = mergedExperience;

  // Merge skills list: match by name & category
  const seenSkills = new Set<string>();
  const mergedSkills: ContactSkill[] = [];

  const addSkill = (skill: ContactSkill | undefined): void => {
    if (!skill || !skill.name) return;
    const key = [skill.name, skill.category]
      .filter(Boolean)
      .map((seg) => seg!.trim().toLowerCase())
      .join("|");
    if (!seenSkills.has(key)) {
      seenSkills.add(key);
      mergedSkills.push({ ...skill });
    }
  };

  (keep.skills || []).forEach(addSkill);
  (other.skills || []).forEach(addSkill);
  merged.skills = mergedSkills;

  // Merge bank details: match by bankName & accountNumber
  const seenBankAccounts = new Set<string>();
  const mergedBankDetails: ContactBankDetail[] = [];

  const addBankDetail = (bank: ContactBankDetail | undefined): void => {
    if (!bank || !bank.accountNumber) return;
    const key = [bank.bankName, bank.accountNumber]
      .filter(Boolean)
      .map((seg) => seg!.trim().toLowerCase())
      .join("|");
    if (!seenBankAccounts.has(key)) {
      seenBankAccounts.add(key);
      mergedBankDetails.push({ ...bank });
    }
  };

  (keep.bankDetails || []).forEach(addBankDetail);
  (other.bankDetails || []).forEach(addBankDetail);
  merged.bankDetails = mergedBankDetails;

  // Merge relationship contacts: match by contact ID & relationship
  const seenRelationship = new Set<string>();
  const mergedRelationshipContacts: RelationshipContact[] = [];

  const addRelationshipContact = (link: RelationshipContact | undefined): void => {
    if (!link || !link.contactId) return;
    const key = `${link.contactId}-${link.relationship}`;
    if (!seenRelationship.has(key)) {
      seenRelationship.add(key);
      mergedRelationshipContacts.push({ ...link });
    }
  };

  (keep.relationshipContacts || []).forEach(addRelationshipContact);
  (other.relationshipContacts || []).forEach(addRelationshipContact);
  merged.relationshipContacts = mergedRelationshipContacts;

  // Merge activities / timeline notes: match by id & content
  const seenActivities = new Set<string>();
  const mergedActivities: ContactActivity[] = [];

  const addActivity = (act: ContactActivity | undefined): void => {
    if (!act || !act.content) return;
    const key = `${act.id || ""}|${act.type || ""}|${act.date || ""}|${act.content.trim()}`;
    if (!seenActivities.has(key)) {
      seenActivities.add(key);
      mergedActivities.push({ ...act });
    }
  };

  (keep.activities || []).forEach(addActivity);
  (other.activities || []).forEach(addActivity);
  if (mergedActivities.length > 0) {
    merged.activities = mergedActivities;
  }

  // Merge attachments / uploaded files: match by URL or name+size
  const seenAttachments = new Set<string>();
  const mergedAttachments: ContactAttachment[] = [];

  const addAttachment = (att: ContactAttachment | undefined): void => {
    if (!att || (!att.url && !att.name)) return;
    const key = att.url
      ? att.url.trim().toLowerCase()
      : `${att.name.trim().toLowerCase()}|${att.size || 0}`;
    if (!seenAttachments.has(key)) {
      seenAttachments.add(key);
      mergedAttachments.push({ ...att });
    }
  };

  (keep.attachments || []).forEach(addAttachment);
  (other.attachments || []).forEach(addAttachment);
  if (mergedAttachments.length > 0) {
    merged.attachments = mergedAttachments;
  }

  return merged;
};
