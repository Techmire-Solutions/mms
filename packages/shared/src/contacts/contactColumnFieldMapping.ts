/**
 * Comprehensive column to form tab/field mapping for Contacts Work table and export.
 * Maps every known export column to its governing tab/field for viewer authorization.
 */
export const COLUMN_FIELD_MAPPING: Record<string, { tabId: string; fieldId: string }> = {
  // Core & Basic
  id: { tabId: "basic", fieldId: "firstName" },
  name: { tabId: "basic", fieldId: "firstName" },
  firstName: { tabId: "basic", fieldId: "firstName" },
  lastName: { tabId: "basic", fieldId: "lastName" },
  gender: { tabId: "basic", fieldId: "gender" },
  dob: { tabId: "basic", fieldId: "dob" },
  solarDob: { tabId: "basic", fieldId: "dob" },
  lunarDob: { tabId: "basic", fieldId: "dob" },
  isSyed: { tabId: "basic", fieldId: "isSyed" },
  tag: { tabId: "basic", fieldId: "tag" },
  cnic: { tabId: "basic", fieldId: "cnic" },
  notes: { tabId: "basic", fieldId: "notes" },
  avatar: { tabId: "basic", fieldId: "firstName" },
  whatsappStatus: { tabId: "phones", fieldId: "whatsapp" },
  lastCheckedAt: { tabId: "phones", fieldId: "whatsapp" },
  aiSummary: { tabId: "basic", fieldId: "notes" },

  // Phones
  phone: { tabId: "phones", fieldId: "number" },
  phone_label: { tabId: "phones", fieldId: "label" },
  phone_number: { tabId: "phones", fieldId: "number" },
  phone_countryCode: { tabId: "phones", fieldId: "number" },
  phone_isPrimary: { tabId: "phones", fieldId: "number" },
  phone_whatsappStatus: { tabId: "phones", fieldId: "whatsapp" },
  whatsapp: { tabId: "phones", fieldId: "whatsapp" },

  // Emails
  email: { tabId: "emails", fieldId: "address" },
  email_label: { tabId: "emails", fieldId: "label" },
  email_address: { tabId: "emails", fieldId: "address" },
  email_isPrimary: { tabId: "emails", fieldId: "address" },
  email_isVerified: { tabId: "emails", fieldId: "address" },

  // Addresses
  address_label: { tabId: "addresses", fieldId: "label" },
  line1: { tabId: "addresses", fieldId: "line1" },
  city: { tabId: "addresses", fieldId: "city" },
  state: { tabId: "addresses", fieldId: "state" },
  country: { tabId: "addresses", fieldId: "country" },
  address_isPrimary: { tabId: "addresses", fieldId: "line1" },

  // Socials
  socials_platform: { tabId: "socials", fieldId: "platform" },
  socials_url: { tabId: "socials", fieldId: "url" },

  // Education
  education_degree: { tabId: "education", fieldId: "degree" },
  education_institution: { tabId: "education", fieldId: "institution" },
  education_fieldOfStudy: { tabId: "education", fieldId: "fieldOfStudy" },
  education_year: { tabId: "education", fieldId: "year" },
  education_grade: { tabId: "education", fieldId: "grade" },
  education_isCurrentlyEnrolled: { tabId: "education", fieldId: "degree" },
  education_label: { tabId: "education", fieldId: "degree" },

  // Experience
  experience_title: { tabId: "experience", fieldId: "title" },
  experience_organization: { tabId: "experience", fieldId: "organization" },
  experience_employmentType: { tabId: "experience", fieldId: "employmentType" },
  experience_location: { tabId: "experience", fieldId: "location" },
  experience_startDate: { tabId: "experience", fieldId: "startDate" },
  experience_endDate: { tabId: "experience", fieldId: "endDate" },
  experience_isCurrent: { tabId: "experience", fieldId: "isCurrent" },
  experience_description: { tabId: "experience", fieldId: "description" },
  experience_label: { tabId: "experience", fieldId: "title" },

  // Skills
  skills: { tabId: "skills", fieldId: "name" },
  skills_name: { tabId: "skills", fieldId: "name" },
  skills_category: { tabId: "skills", fieldId: "category" },
  skills_proficiency: { tabId: "skills", fieldId: "proficiency" },
  skills_yearsOfExperience: { tabId: "skills", fieldId: "yearsOfExperience" },
  skills_isCertified: { tabId: "skills", fieldId: "isCertified" },
  skills_issuer: { tabId: "skills", fieldId: "issuer" },
  skills_description: { tabId: "skills", fieldId: "description" },
  skills_label: { tabId: "skills", fieldId: "name" },

  // Relationships
  relationship_contact: { tabId: "relationship", fieldId: "contactId" },
  relationship_type: { tabId: "relationship", fieldId: "relationship" },
  relationship_phone: { tabId: "relationship", fieldId: "contactId" },
  relationship_email: { tabId: "relationship", fieldId: "contactId" },
  relationship_gender: { tabId: "relationship", fieldId: "contactId" },
  relationship_contactId: { tabId: "relationship", fieldId: "contactId" },
  relationship_inferred: { tabId: "relationship", fieldId: "contactId" },

  // Bank Details
  bank_name: { tabId: "bankDetails", fieldId: "bankName" },
  bank_account: { tabId: "bankDetails", fieldId: "accountNumber" },
  bank_accountTitle: { tabId: "bankDetails", fieldId: "accountTitle" },
  bank_accountNumber: { tabId: "bankDetails", fieldId: "accountNumber" },
  bank_iban: { tabId: "bankDetails", fieldId: "accountNumber" },

  // Activities & Attachments
  activity_type: { tabId: "basic", fieldId: "notes" },
  activity_content: { tabId: "basic", fieldId: "notes" },
  activity_date: { tabId: "basic", fieldId: "notes" },
  activity_by: { tabId: "basic", fieldId: "notes" },
  attachment_name: { tabId: "basic", fieldId: "notes" },
  attachment_type: { tabId: "basic", fieldId: "notes" },
  attachment_size: { tabId: "basic", fieldId: "notes" },
  attachment_url: { tabId: "basic", fieldId: "notes" },
  attachment_date: { tabId: "basic", fieldId: "notes" },

  // Audit
  createdAt: { tabId: "basic", fieldId: "firstName" },
  updatedAt: { tabId: "basic", fieldId: "firstName" },
  createdBy: { tabId: "basic", fieldId: "firstName" },
  updatedBy: { tabId: "basic", fieldId: "firstName" },
};
