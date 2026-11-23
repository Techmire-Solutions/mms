import type { SerializedEntityAuditFields } from "../core/softDelete.js";
import type { ContactSystemTag } from "./contactSystemTags.js";

/** Status of WhatsApp registration checks for phone numbers. */
export const WHATSAPP_STATUS_VALUES = [
  "PENDING",
  "REGISTERED",
  "NOT_REGISTERED",
  "FAILED",
] as const;

/** Status of WhatsApp registration checks for phone numbers. */
export type WhatsAppStatus = (typeof WHATSAPP_STATUS_VALUES)[number];

/** Phone number model for contacts with label, country code, and verification status. */
export interface PhoneNumber {
  id?: string;
  _localId?: string;
  label: string;
  number: string;
  countryCode?: string;
  isPrimary?: boolean;
  whatsappStatus?: WhatsAppStatus;
}

/** Email address model for contacts with verification state and primary flag. */
export interface EmailAddress {
  id?: string;
  _localId?: string;
  label: string;
  address: string;
  isPrimary?: boolean;
  isVerified?: boolean;
}

/** Physical address model for contacts. */
export interface Address {
  id?: string;
  _localId?: string;
  line1?: string;
  city?: string;
  state?: string;
  country?: string;
  label?: string;
  isPrimary?: boolean;
}

/** Social profile link model for contacts. */
export interface SocialLink {
  id?: string;
  _localId?: string;
  platform: string;
  url: string;
}

/** Educational qualification / degree record for contacts. */
export interface ContactEducation {
  id?: string;
  _localId?: string;
  degree?: string;
  institution: string;
  fieldOfStudy?: string;
  year?: string;
  grade?: string;
  isCurrentlyEnrolled?: boolean;
  label?: string;
  sortOrder?: number;
}

/** Professional work / employment experience record for contacts. */
export interface ContactExperience {
  id?: string;
  _localId?: string;
  title: string;
  organization: string;
  employmentType?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  label?: string;
  sortOrder?: number;
}

/** Skills, expertise, qualifications, and Sanad/Ijazah records for contacts. */
export interface ContactSkill {
  id?: string;
  _localId?: string;
  name: string;
  category?: string;
  proficiency?: string;
  yearsOfExperience?: string;
  isCertified?: boolean;
  issuer?: string;
  description?: string;
  label?: string;
  sortOrder?: number;
}

/** Bank account details for contacts. */
export interface ContactBankDetail {
  id?: string;
  _localId?: string;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  sortOrder?: number;
}

export type ContactBankDetailInput = ContactBankDetail;

/** Linked contact entry for the Relationship form tab (reciprocal graph). */
export interface RelationshipContact {
  id?: string;
  _localId?: string;
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  gender?: string;
  contactId?: string | number;
  inferred?: boolean;
  inferredFromContactId?: string;
  inferenceDepth?: number;
}

/** Inter-contact relationship reference link. */
export interface ContactRelationship {
  contactId: string | number;
  relationship?: string;
  notes?: string;
}

/** Canonical system relationship pair roles. */
export const DEFAULT_RELATIONSHIP_TYPES = [
  "Parent",
  "Child",
  "Husband",
  "Wife",
  "Guardian",
  "Dependent",
] as const;

export type DefaultRelationshipType = (typeof DEFAULT_RELATIONSHIP_TYPES)[number];

/** Standard genders supported by contact forms and directory filters. */
export const STANDARD_GENDERS = ["Male", "Female"] as const;

export type StandardGender = (typeof STANDARD_GENDERS)[number];

/** Definition for a 2-sided reciprocal relationship pair. */
export interface RelationshipPair {
  id?: string;
  forward: string;
  inverse: string;
  inverseMale?: string;
  inverseFemale?: string;
}

/** Supported activity types recorded on a contact timeline. */
export const CONTACT_ACTIVITY_TYPES = [
  "note",
  "stage_change",
  "whatsapp",
  "email",
  "system",
  "task",
  "call",
] as const;

/** Type representing an activity log category on a contact timeline. */
export type ContactActivityType = (typeof CONTACT_ACTIVITY_TYPES)[number];

/** Audit log activity item recorded on a contact timeline. */
export interface ContactActivity {
  id: string;
  type: ContactActivityType;
  content: string;
  date: string;
  by?: string;
  metadata?: Record<string, unknown>;
}

/** Document attachment associated with a contact record. */
export interface ContactAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  date: string;
}

/** Primary domain model representing a Contact entity across the monorepo. */
export interface Contact<TCustom = Record<string, unknown>> extends SerializedEntityAuditFields {
  id: string | number;
  name: string;
  firstName: string;
  lastName?: string;
  gender?: StandardGender | string;
  dob?: string;
  cnic?: string;
  isSyed?: boolean;
  tag?: string;
  tags?: string[];
  /** Read-only metadata for module-managed tags (`Student`, `faculty-Teacher`, …). */
  systemTags?: ContactSystemTag[];
  avatar?: string | null;
  notes?: string;

  // Status & Scalar Extensions
  whatsappStatus?: WhatsAppStatus | "unknown";
  lastCheckedAt?: string | null;
  phone?: string;
  email?: string;
  line1?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;

  phones?: PhoneNumber[];
  emails?: EmailAddress[];
  addresses?: Address[];
  socials?: SocialLink[];
  education?: ContactEducation[];
  experience?: ContactExperience[];
  skills?: ContactSkill[];
  bankDetails?: ContactBankDetail[];
  relationshipContacts?: RelationshipContact[];
  relationships?: ContactRelationship[];
  activities?: ContactActivity[];
  attachments?: ContactAttachment[];
  aiSummary?: string;
  customFields?: TCustom;
  [key: string]: unknown;
}

/** True when the contact has a non-empty primary phone or at least one non-empty phone entry. */
export function contactHasPhone(contact: Contact | null | undefined): boolean {
  if (!contact) return false;
  if (contact.phones?.some((entry) => typeof entry.number === "string" && entry.number.trim())) {
    return true;
  }
  return typeof contact.phone === "string" && contact.phone.trim().length > 0;
}

/** True when the contact has a non-empty primary email or at least one non-empty email entry. */
export function contactHasEmail(contact: Contact | null | undefined): boolean {
  if (!contact) return false;
  if (contact.emails?.some((entry) => typeof entry.address === "string" && entry.address.trim())) {
    return true;
  }
  return typeof contact.email === "string" && contact.email.trim().length > 0;
}

/** Resolves normalized unique array of tag strings from a Contact (supporting tags array or comma-delimited tag string). */
export function getContactTags(
  contact?: { tag?: string | null; tags?: string[] | null } | null,
): string[] {
  if (!contact) return [];
  if (Array.isArray(contact.tags) && contact.tags.length > 0) {
    return Array.from(new Set(contact.tags.map((t) => String(t).trim()).filter(Boolean)));
  }
  if (typeof contact.tag === "string" && contact.tag.trim()) {
    return Array.from(
      new Set(
        contact.tag
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

// Bulk-tag schema + caps live in their own file (kept this module under the
// 300-line ratchet); re-exported here for existing consumers.
export {
  CONTACTS_BULK_TAG_MAX_TAGS,
  CONTACTS_BULK_TAG_MAX_CONTACTS,
  contactsBulkTagBodySchema,
  type ContactsBulkTagBody,
} from "./contactBulkTag.js";
