import { z } from "zod";
import type { SerializedEntityAuditFields } from "./softDelete.js";

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
  label: string;
  number: string;
  countryCode?: string;
  isPrimary?: boolean;
  whatsappStatus?: WhatsAppStatus;
}

/** Email address model for contacts with verification state and primary flag. */
export interface EmailAddress {
  label: string;
  address: string;
  isPrimary?: boolean;
  isVerified?: boolean;
}

/** Physical address model for contacts. */
export interface Address {
  line1?: string;
  city?: string;
  state?: string;
  country?: string;
  label?: string;
  isPrimary?: boolean;
}

/** Social profile link model for contacts. */
export interface SocialLink {
  platform: string;
  url: string;
}

/** Educational qualification / degree record for contacts. */
export interface ContactEducation {
  id?: string;
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
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  sortOrder?: number;
}

export type ContactBankDetailInput = ContactBankDetail;

/** Linked contact entry for the Relationship form tab (reciprocal graph). */
export interface RelationshipContact {
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
export interface Contact extends SerializedEntityAuditFields {
  id: string | number;
  name: string;
  firstName: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  cnic?: string;
  isSyed?: boolean;
  tag?: string;
  tags?: string[];
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
  [key: string]: unknown;
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

/** Payload schema for bulk tagging contact records. */
export const contactsBulkTagBodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "At least one contact ID is required"),
    addTags: z.array(z.string().trim().min(1)).optional(),
    removeTags: z.array(z.string().trim().min(1)).optional(),
  })
  .strict()
  .refine((data) => (data.addTags?.length ?? 0) > 0 || (data.removeTags?.length ?? 0) > 0, {
    message: "At least one tag to add or remove must be provided",
  });

export type ContactsBulkTagBody = z.infer<typeof contactsBulkTagBodySchema>;
