import { z } from "zod";
import { SessionSchema } from "./sessionTypes.js";

/** Built-in academic category codes (tenant catalogs may add custom codes). */
export const SESSION_TERM_TYPES = [
  "academic_year",
  "term",
  "short_course",
  "workshop",
  "camp",
] as const;
export type TermType = (typeof SESSION_TERM_TYPES)[number];
export const sessionTermTypeSchema = z.enum(SESSION_TERM_TYPES);

/** Minimal hydrated catalog reference; `type` is null for tenant-custom categories. */
export const sessionCategoryRefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    code: z.string().nullable(),
    type: sessionTermTypeSchema.nullable(),
  })
  .strict();
export type SessionCategoryRef = z.infer<typeof sessionCategoryRefSchema>;

/**
 * Read-model composition: the nested classes/timetables from the canonical `SessionSchema` plus
 * optional hydrated category/program references. This is not a wire endpoint by itself; clients
 * that resolve catalog refs can validate their view model with it instead of widening `Session`.
 */
export const sessionWithTermsAndClassesSchema = SessionSchema.extend({
  category: sessionCategoryRefSchema.nullable().optional(),
  program: sessionCategoryRefSchema.nullable().optional(),
});
export type SessionWithTermsAndClasses = z.infer<typeof sessionWithTermsAndClassesSchema>;
