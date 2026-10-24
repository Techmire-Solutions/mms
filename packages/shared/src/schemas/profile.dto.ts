import { z } from "zod";
import { phoneNumberSchema, emailAddressSchema } from "../contacts/contactNestedSchemas.js";
import { deepSanitizeStrings } from "./sanitize.js";

const changePasswordBodyBaseSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
  })
  .strict();

export const changePasswordBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, changePasswordBodyBaseSchema);

const verifyPasswordBodyBaseSchema = z
  .object({
    password: z.string().min(1),
    email: z.string().email().optional(),
  })
  .strict();

export const verifyPasswordBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, verifyPasswordBodyBaseSchema);

const requestLoginEmailChangeBodyBaseSchema = z
  .object({
    newLoginEmail: z.string().email(),
    currentPassword: z.string().min(1),
  })
  .strict();

export const requestLoginEmailChangeBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, requestLoginEmailChangeBodyBaseSchema);

const confirmLoginEmailChangeBodyBaseSchema = z
  .object({
    challengeId: z.string().min(1),
    code: z.string().min(4),
  })
  .strict();

export const confirmLoginEmailChangeBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, confirmLoginEmailChangeBodyBaseSchema);

const ownContactPatchBodyBaseSchema = z
  .object({
    name: z.string().min(1).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    gender: z.string().optional(),
    dob: z.string().optional(),
    city: z.string().optional(),
    avatar: z.string().optional(),
    phones: z.array(phoneNumberSchema).optional(),
    emails: z
      .array(
        emailAddressSchema.extend({
          address: z.string().email(),
        }),
      )
      .optional(),
  })
  .strict();

export const ownContactPatchBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, ownContactPatchBodyBaseSchema);
