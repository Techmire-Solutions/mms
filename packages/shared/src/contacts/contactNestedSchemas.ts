import { z } from "zod";
import { WHATSAPP_STATUS_VALUES } from "./contactEntityTypes.js";

export const whatsappStatusSchema = z.enum(WHATSAPP_STATUS_VALUES);

export const whatsappStatusOptionalSchema = z
  .union([
    whatsappStatusSchema,
    z.literal("unknown"),
    z.literal("Unknown"),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((val) =>
    val && val !== "unknown" && val !== "Unknown"
      ? (val as (typeof WHATSAPP_STATUS_VALUES)[number])
      : undefined,
  )
  .optional();

export const phoneNumberSchema = z
  .object({
    label: z.string().optional(),
    number: z.string(),
    countryCode: z.string().optional(),
    isPrimary: z.boolean().optional(),
    whatsappStatus: whatsappStatusOptionalSchema,
  })
  .strict();

export const emailAddressSchema = z
  .object({
    label: z.string().optional(),
    address: z.string(),
    isPrimary: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  })
  .strict();

export const addressSchema = z
  .object({
    label: z.string().optional(),
    line1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const socialLinkSchema = z
  .object({
    platform: z.string(),
    url: z.string(),
  })
  .strict();

export const contactEducationSchema = z
  .object({
    id: z.string().optional(),
    degree: z.string().optional(),
    institution: z.string(),
    fieldOfStudy: z.string().optional(),
    year: z.string().optional(),
    grade: z.string().optional(),
    isCurrentlyEnrolled: z.boolean().optional(),
    label: z.string().optional(),
    sortOrder: z.number().optional(),
  })
  .strict();

export const contactExperienceSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    organization: z.string(),
    employmentType: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
    description: z.string().optional(),
    label: z.string().optional(),
    sortOrder: z.number().optional(),
  })
  .strict();

export const contactSkillSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    category: z.string().optional(),
    proficiency: z.string().optional(),
    yearsOfExperience: z.string().optional(),
    isCertified: z.boolean().optional(),
    issuer: z.string().optional(),
    description: z.string().optional(),
    label: z.string().optional(),
    sortOrder: z.number().optional(),
  })
  .strict();

export const contactBankDetailSchema = z
  .object({
    id: z.string().optional(),
    bankName: z.string().trim().optional().nullable().or(z.literal("")),
    accountTitle: z.string().trim().optional().nullable().or(z.literal("")),
    accountNumber: z.string().trim().optional().nullable().or(z.literal("")),
    sortOrder: z.number().optional(),
  })
  .strict();

export const relationshipContactSchema = z
  .object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
    contactId: z.union([z.string(), z.number()]).optional(),
    inferred: z.boolean().optional(),
    inferredFromContactId: z.union([z.string(), z.number()]).optional(),
    inferenceDepth: z.number().optional(),
  })
  .strict();

export const relationshipSchema = z
  .object({
    contactId: z.union([z.string(), z.number()]),
    relationship: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const activitySchema = z
  .object({
    id: z.string(),
    type: z.enum(["note", "stage_change", "whatsapp", "email", "system", "task", "call"]),
    content: z.string(),
    date: z.string(),
    by: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const attachmentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    size: z.number(),
    url: z.string(),
    date: z.string(),
  })
  .strict();
