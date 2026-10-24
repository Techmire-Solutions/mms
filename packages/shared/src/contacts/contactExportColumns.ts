export interface ContactExportColumn {
  id: string;
  label: string;
}

export interface ContactExportLabels {
  yes: string;
  no: string;
}

/**
 * Complete registry of exportable columns in the Contacts module.
 * Covers all fields and text attributes across all tables in the Contacts domain:
 * - Core: id, name, firstName, lastName, gender, dob, cnic, isSyed, avatar, tag, notes, whatsappStatus, lastCheckedAt, aiSummary
 * - Phones: label, number, countryCode, isPrimary, whatsappStatus
 * - Emails: label, address, isPrimary, isVerified
 * - Addresses: label, line1, city, state, country, isPrimary
 * - Socials: platform, url
 * - Education: degree, institution, fieldOfStudy, year, grade, isCurrentlyEnrolled, label
 * - Experience: title, organization, employmentType, location, startDate, endDate, isCurrent, description, label
 * - Skills: name, category, proficiency, yearsOfExperience, isCertified, issuer, description, label
 * - Relationships: contact, type, phone, email, gender, contactId, inferred
 * - Bank Details: bankName, accountTitle, accountNumber
 * - Activities: type, content, date, by
 * - Attachments: name, type, size, url, date
 * - Audit: createdAt, updatedAt, createdBy, updatedBy
 */
export const ALL_CONTACT_FORM_EXPORT_COLUMNS: readonly ContactExportColumn[] = [
  // Tab 1: Identity / Basic Core
  { id: "id", label: "Contact ID" },
  { id: "name", label: "Full Name" },
  { id: "firstName", label: "First Name" },
  { id: "lastName", label: "Last Name" },
  { id: "gender", label: "Gender" },
  { id: "dob", label: "Date of Birth" },
  { id: "solarDob", label: "Solar Date of Birth" },
  { id: "lunarDob", label: "Lunar (Hijri) Date of Birth" },
  { id: "cnic", label: "CNIC / National ID" },
  { id: "isSyed", label: "Is Syed" },
  { id: "avatar", label: "Avatar URL" },
  { id: "tag", label: "Tag" },
  { id: "notes", label: "Notes" },
  { id: "whatsappStatus", label: "WhatsApp Status" },
  { id: "lastCheckedAt", label: "WhatsApp Checked At" },
  { id: "aiSummary", label: "AI Summary" },

  // Tab 2: Phones
  { id: "phone_label", label: "Phone Type" },
  { id: "phone_number", label: "Phone Number" },
  { id: "phone_countryCode", label: "Phone Country Code" },
  { id: "phone_isPrimary", label: "Primary Phone" },
  { id: "phone_whatsappStatus", label: "Phone WhatsApp Status" },

  // Tab 3: Emails
  { id: "email_label", label: "Email Type" },
  { id: "email_address", label: "Email Address" },
  { id: "email_isPrimary", label: "Primary Email" },
  { id: "email_isVerified", label: "Verified Email" },

  // Tab 4: Addresses
  { id: "address_label", label: "Address Type" },
  { id: "line1", label: "Street Address" },
  { id: "city", label: "City" },
  { id: "state", label: "State / Province" },
  { id: "country", label: "Country" },
  { id: "address_isPrimary", label: "Primary Address" },

  // Tab 5: Socials
  { id: "socials_platform", label: "Social Platform" },
  { id: "socials_url", label: "Social URL" },

  // Tab 6: Education
  { id: "education_degree", label: "Degree / Qualification" },
  { id: "education_institution", label: "Institution" },
  { id: "education_fieldOfStudy", label: "Field of Study" },
  { id: "education_year", label: "Graduation Year" },
  { id: "education_grade", label: "Grade / Score" },
  { id: "education_isCurrentlyEnrolled", label: "Currently Enrolled" },
  { id: "education_label", label: "Education Label" },

  // Tab 7: Experience
  { id: "experience_title", label: "Job Title" },
  { id: "experience_organization", label: "Organization" },
  { id: "experience_employmentType", label: "Employment Type" },
  { id: "experience_location", label: "Job Location" },
  { id: "experience_startDate", label: "Job Start Date" },
  { id: "experience_endDate", label: "Job End Date" },
  { id: "experience_isCurrent", label: "Currently Working Here" },
  { id: "experience_description", label: "Job Description" },
  { id: "experience_label", label: "Experience Label" },

  // Tab 8: Skills
  { id: "skills_name", label: "Skill Name" },
  { id: "skills_category", label: "Skill Category" },
  { id: "skills_proficiency", label: "Skill Proficiency" },
  { id: "skills_yearsOfExperience", label: "Years of Experience" },
  { id: "skills_isCertified", label: "Certified" },
  { id: "skills_issuer", label: "Certifying Body / Issuer" },
  { id: "skills_description", label: "Skill Notes" },
  { id: "skills_label", label: "Skill Label" },

  // Tab 9: Relationship
  { id: "relationship_contact", label: "Relationship Contact" },
  { id: "relationship_type", label: "Relationship Type" },
  { id: "relationship_phone", label: "Relationship Phone" },
  { id: "relationship_email", label: "Relationship Email" },
  { id: "relationship_gender", label: "Relationship Gender" },
  { id: "relationship_contactId", label: "Related Contact ID" },
  { id: "relationship_inferred", label: "Inferred Relationship" },

  // Tab 10: Bank Details
  { id: "bank_name", label: "Bank Name" },
  { id: "bank_accountTitle", label: "Bank Account Title" },
  { id: "bank_accountNumber", label: "Bank Account Number" },

  // Activities & Attachments
  { id: "activity_type", label: "Activity Type" },
  { id: "activity_content", label: "Activity Content" },
  { id: "activity_date", label: "Activity Date" },
  { id: "activity_by", label: "Activity Logged By" },
  { id: "attachment_name", label: "Attachment Name" },
  { id: "attachment_type", label: "Attachment Type" },
  { id: "attachment_size", label: "Attachment Size" },
  { id: "attachment_url", label: "Attachment URL" },
  { id: "attachment_date", label: "Attachment Date" },

  // Audit
  { id: "createdAt", label: "Created At" },
  { id: "updatedAt", label: "Updated At" },
  { id: "createdBy", label: "Created By" },
  { id: "updatedBy", label: "Updated By" },
] as const;

export const DEFAULT_CONTACT_EXPORT_COLUMNS: readonly ContactExportColumn[] =
  ALL_CONTACT_FORM_EXPORT_COLUMNS;
