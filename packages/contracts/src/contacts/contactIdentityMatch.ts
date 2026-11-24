import { z } from "zod";

const identityValueListSchema = z
  .array(z.string().max(320))
  .max(2000)
  .transform((values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))]);

/** POST /api/contacts/identity-match — scoped existence check for Apple import dedupe. */
export const contactIdentityMatchBodySchema = z.object({
  /** Digits-only E.164 phone keys (same as unique-field normalization). */
  phones: identityValueListSchema.default([]),
  /** Lowercased email addresses. */
  emails: identityValueListSchema.default([]),
  /** Lower/trim display names (name-only import rows). */
  names: identityValueListSchema.default([]),
});

export type ContactIdentityMatchBody = z.infer<typeof contactIdentityMatchBodySchema>;

export const contactIdentityMatchResultSchema = z.object({
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  names: z.array(z.string()),
});

export type ContactIdentityMatchResult = z.infer<typeof contactIdentityMatchResultSchema>;
