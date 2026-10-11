import type { Contact } from "./contactTypes.js";
import type { ContactExportColumn, ContactExportLabels } from "./contactExportColumns.js";
import {
  isRelationshipContactColumnKey,
  isRelationshipTypeColumnKey,
} from "./contactEmergencyTabMigration.js";
import { formatHijriDate, getPrimaryPhone, hasWhatsApp } from "./utils.js";

/** Formats a multi-item array, preserving positional alignment across related columns. */
function joinCompoundItems<T>(items: T[] | undefined, fn: (item: T) => string): string {
  if (!items || items.length === 0) return "";
  const mapped = items.map(fn);
  if (mapped.every((val) => !val)) return "";
  return mapped.join("; ");
}

/** Formats simple item lists, omitting empty values. */
function joinSimpleItems<T>(items: T[] | undefined, fn: (item: T) => string): string {
  return (items || []).map(fn).filter(Boolean).join("; ");
}

export function compileContactColumnExtractor(
  columnId: string,
  labels: ContactExportLabels,
): (contact: Contact) => string {
  // Core & Basic
  if (columnId === "id") return (c) => (c.id !== undefined && c.id !== null ? String(c.id) : "");
  if (columnId === "name") return (c) => c.name || "";
  if (columnId === "firstName") return (c) => c.firstName || "";
  if (columnId === "lastName") return (c) => c.lastName || "";
  if (columnId === "gender") return (c) => c.gender || "";
  if (columnId === "dob") return (c) => c.dob || "";
  if (columnId === "solarDob") return (c) => c.dob || "";
  if (columnId === "lunarDob") return (c) => (c.dob ? formatHijriDate(c.dob) : "");
  if (columnId === "cnic") return (c) => c.cnic || "";
  if (columnId === "tag") return (c) => c.tag || (Array.isArray(c.tags) ? c.tags.join("; ") : "");
  if (columnId === "notes") return (c) => c.notes || "";
  if (columnId === "avatar") return (c) => c.avatar || "";
  if (columnId === "isSyed") return (c) => (c.isSyed ? labels.yes : labels.no);
  if (columnId === "whatsappStatus") return (c) => c.whatsappStatus || "";
  if (columnId === "lastCheckedAt") return (c) => c.lastCheckedAt || "";
  if (columnId === "aiSummary") return (c) => c.aiSummary || "";

  // Phones
  if (columnId === "phone") return (c) => getPrimaryPhone(c) || "";
  if (columnId === "phone_number") {
    return (c) =>
      c.phones && c.phones.length > 0
        ? joinSimpleItems(c.phones, (p) => p.number)
        : getPrimaryPhone(c) || "";
  }
  if (columnId === "phone_label")
    return (c) => joinCompoundItems(c.phones, (p) => p.label || "Mobile");
  if (columnId === "phone_countryCode")
    return (c) => joinCompoundItems(c.phones, (p) => p.countryCode || "");
  if (columnId === "phone_isPrimary")
    return (c) => joinCompoundItems(c.phones, (p) => (p.isPrimary ? labels.yes : labels.no));
  if (columnId === "phone_whatsappStatus")
    return (c) => joinCompoundItems(c.phones, (p) => p.whatsappStatus || "");
  if (columnId === "whatsapp") return (c) => (hasWhatsApp(c) ? labels.yes : labels.no);

  // Emails
  if (columnId === "email") return (c) => (c.emails || [])[0]?.address || c.email || "";
  if (columnId === "email_address") {
    return (c) =>
      c.emails && c.emails.length > 0 ? joinSimpleItems(c.emails, (e) => e.address) : c.email || "";
  }
  if (columnId === "email_label")
    return (c) => joinCompoundItems(c.emails, (e) => e.label || "Personal");
  if (columnId === "email_isPrimary")
    return (c) => joinCompoundItems(c.emails, (e) => (e.isPrimary ? labels.yes : labels.no));
  if (columnId === "email_isVerified")
    return (c) => joinCompoundItems(c.emails, (e) => (e.isVerified ? labels.yes : labels.no));

  // Addresses
  if (columnId === "address_label")
    return (c) => joinCompoundItems(c.addresses, (a) => a.label || "Home");
  if (columnId === "line1")
    return (c) =>
      joinCompoundItems(c.addresses, (a) => a.line1 || "") || c.line1 || c.address || "";
  if (columnId === "city")
    return (c) => joinCompoundItems(c.addresses, (a) => a.city || "") || c.city || "";
  if (columnId === "state")
    return (c) => joinCompoundItems(c.addresses, (a) => a.state || "") || c.state || "";
  if (columnId === "country")
    return (c) => joinCompoundItems(c.addresses, (a) => a.country || "") || c.country || "";
  if (columnId === "address_isPrimary")
    return (c) => joinCompoundItems(c.addresses, (a) => (a.isPrimary ? labels.yes : labels.no));

  // Socials
  if (columnId === "socials_platform")
    return (c) => joinCompoundItems(c.socials, (s) => s.platform);
  if (columnId === "socials_url") return (c) => joinCompoundItems(c.socials, (s) => s.url);

  // Education
  if (columnId === "education_degree")
    return (c) => joinCompoundItems(c.education, (e) => e.degree || "");
  if (columnId === "education_institution")
    return (c) => joinCompoundItems(c.education, (e) => e.institution || "");
  if (columnId === "education_fieldOfStudy")
    return (c) => joinCompoundItems(c.education, (e) => e.fieldOfStudy || "");
  if (columnId === "education_year")
    return (c) => joinCompoundItems(c.education, (e) => e.year || "");
  if (columnId === "education_grade")
    return (c) => joinCompoundItems(c.education, (e) => e.grade || "");
  if (columnId === "education_isCurrentlyEnrolled")
    return (c) =>
      joinCompoundItems(c.education, (e) => (e.isCurrentlyEnrolled ? labels.yes : labels.no));
  if (columnId === "education_label")
    return (c) => joinCompoundItems(c.education, (e) => e.label || "");

  // Experience
  if (columnId === "experience_title")
    return (c) => joinCompoundItems(c.experience, (e) => e.title || "");
  if (columnId === "experience_organization")
    return (c) => joinCompoundItems(c.experience, (e) => e.organization || "");
  if (columnId === "experience_employmentType")
    return (c) => joinCompoundItems(c.experience, (e) => e.employmentType || "");
  if (columnId === "experience_location")
    return (c) => joinCompoundItems(c.experience, (e) => e.location || "");
  if (columnId === "experience_startDate")
    return (c) => joinCompoundItems(c.experience, (e) => e.startDate || "");
  if (columnId === "experience_endDate")
    return (c) => joinCompoundItems(c.experience, (e) => e.endDate || "");
  if (columnId === "experience_isCurrent")
    return (c) => joinCompoundItems(c.experience, (e) => (e.isCurrent ? labels.yes : labels.no));
  if (columnId === "experience_description")
    return (c) => joinCompoundItems(c.experience, (e) => e.description || "");
  if (columnId === "experience_label")
    return (c) => joinCompoundItems(c.experience, (e) => e.label || "");

  // Skills
  if (columnId === "skills_name" || columnId === "skills")
    return (c) => joinCompoundItems(c.skills, (s) => s.name || "");
  if (columnId === "skills_category")
    return (c) => joinCompoundItems(c.skills, (s) => s.category || "");
  if (columnId === "skills_proficiency")
    return (c) => joinCompoundItems(c.skills, (s) => s.proficiency || "");
  if (columnId === "skills_yearsOfExperience")
    return (c) => joinCompoundItems(c.skills, (s) => s.yearsOfExperience || "");
  if (columnId === "skills_isCertified")
    return (c) => joinCompoundItems(c.skills, (s) => (s.isCertified ? labels.yes : labels.no));
  if (columnId === "skills_issuer")
    return (c) => joinCompoundItems(c.skills, (s) => s.issuer || "");
  if (columnId === "skills_description")
    return (c) => joinCompoundItems(c.skills, (s) => s.description || "");
  if (columnId === "skills_label") return (c) => joinCompoundItems(c.skills, (s) => s.label || "");

  // Relationships
  if (isRelationshipContactColumnKey(columnId)) {
    return (c) =>
      joinCompoundItems(
        c.relationshipContacts,
        (ec) => ec.name || (ec.contactId ? String(ec.contactId) : ""),
      );
  }
  if (isRelationshipTypeColumnKey(columnId)) {
    return (c) => joinCompoundItems(c.relationshipContacts, (ec) => ec.relationship || "");
  }
  if (columnId === "relationship_phone") {
    return (c) => joinCompoundItems(c.relationshipContacts, (ec) => ec.phone || "");
  }
  if (columnId === "relationship_email") {
    return (c) => joinCompoundItems(c.relationshipContacts, (ec) => ec.email || "");
  }
  if (columnId === "relationship_gender") {
    return (c) => joinCompoundItems(c.relationshipContacts, (ec) => ec.gender || "");
  }
  if (columnId === "relationship_contactId") {
    return (c) =>
      joinCompoundItems(c.relationshipContacts, (ec) => (ec.contactId ? String(ec.contactId) : ""));
  }
  if (columnId === "relationship_inferred") {
    return (c) =>
      joinCompoundItems(c.relationshipContacts, (ec) => (ec.inferred ? labels.yes : labels.no));
  }

  // Bank Details
  if (columnId === "bank_name")
    return (c) => joinCompoundItems(c.bankDetails, (b) => b.bankName || "");
  if (columnId === "bank_accountTitle")
    return (c) => joinCompoundItems(c.bankDetails, (b) => b.accountTitle || "");
  if (
    columnId === "bank_accountNumber" ||
    columnId === "bank_account" ||
    columnId === "bank_iban"
  ) {
    return (c) => joinCompoundItems(c.bankDetails, (b) => b.accountNumber || "");
  }

  // Activities & Attachments
  if (columnId === "activity_type")
    return (c) => joinCompoundItems(c.activities, (a) => a.type || "");
  if (columnId === "activity_content")
    return (c) => joinCompoundItems(c.activities, (a) => a.content || "");
  if (columnId === "activity_date")
    return (c) => joinCompoundItems(c.activities, (a) => a.date || "");
  if (columnId === "activity_by") return (c) => joinCompoundItems(c.activities, (a) => a.by || "");
  if (columnId === "attachment_name")
    return (c) => joinCompoundItems(c.attachments, (a) => a.name || "");
  if (columnId === "attachment_type")
    return (c) => joinCompoundItems(c.attachments, (a) => a.type || "");
  if (columnId === "attachment_size")
    return (c) => joinCompoundItems(c.attachments, (a) => (a.size != null ? String(a.size) : ""));
  if (columnId === "attachment_url")
    return (c) => joinCompoundItems(c.attachments, (a) => a.url || "");
  if (columnId === "attachment_date")
    return (c) => joinCompoundItems(c.attachments, (a) => a.date || "");

  // Audit
  if (columnId === "createdAt") return (c) => (c.createdAt ? String(c.createdAt) : "");
  if (columnId === "updatedAt") return (c) => (c.updatedAt ? String(c.updatedAt) : "");
  if (columnId === "createdBy") return (c) => (c.createdBy ? String(c.createdBy) : "");
  if (columnId === "updatedBy") return (c) => (c.updatedBy ? String(c.updatedBy) : "");

  // Custom / dynamic fields
  return (c) => {
    const cellVal = c[columnId as keyof Contact];
    if (cellVal === undefined || cellVal === null) return "";
    if (typeof cellVal === "boolean") return cellVal ? labels.yes : labels.no;
    if (Array.isArray(cellVal)) {
      if (cellVal.every((item) => typeof item === "string" || typeof item === "number")) {
        return cellVal.join("; ");
      }
      return JSON.stringify(cellVal);
    }
    if (typeof cellVal === "object") return JSON.stringify(cellVal);
    return String(cellVal);
  };
}

/** Builds CSV rows (header + data) for the given contacts and visible columns. */
export function buildContactsExportRows(
  contacts: Contact[],
  columns: ContactExportColumn[],
  labels: ContactExportLabels,
): unknown[][] {
  const header = columns.map((column) => column.label);
  const extractors = columns.map(({ id }) => compileContactColumnExtractor(id, labels));
  const rows = contacts.map((contact) => extractors.map((extract) => extract(contact)));
  return [header, ...rows];
}
