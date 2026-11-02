/**
 * Lean contacts picker contract — the smallest possible Contact projection that
 * person-picker surfaces (student guardian, faculty contact, workshop
 * participant, …) need to render a searchable option.
 *
 * Deliberately separate from the full Contact DTO: every module that links a
 * person may read these fields without holding `contacts.read`, so the shape is
 * capped here and the endpoint never returns anything beyond it.
 */
import { z } from "zod";

/** Hard cap on picker rows per request (contract, query schema, and SQL limit). */
export const CONTACT_PICKER_MAX_RESULTS = 20;

/** Rows returned when the caller does not pass `limit`. */
export const CONTACT_PICKER_DEFAULT_RESULTS = 8;

/** One picker row — id, display name, primary phone, and optional email/city. */
export const contactPickerOptionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string(),
    email: z.string().optional(),
    city: z.string().optional(),
  })
  .strict();

export const contactPickerSearchQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(CONTACT_PICKER_MAX_RESULTS).optional(),
    /** Comma-separated contact ids the caller already linked (cap 4000 chars). */
    excludeIds: z.string().max(4000).optional(),
    gender: z.string().max(40).optional(),
    hasPhone: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  })
  .strict();

export const contactPickerSearchResponseSchema = z
  .object({ contacts: z.array(contactPickerOptionSchema) })
  .strict();

export const contactPickerResolveResponseSchema = z
  .object({ contact: contactPickerOptionSchema.nullable() })
  .strict();

export type ContactPickerOption = z.infer<typeof contactPickerOptionSchema>;
export type ContactPickerSearchQuery = z.infer<typeof contactPickerSearchQuerySchema>;
export type ContactPickerSearchResponse = z.infer<typeof contactPickerSearchResponseSchema>;
export type ContactPickerResolveResponse = z.infer<typeof contactPickerResolveResponseSchema>;
