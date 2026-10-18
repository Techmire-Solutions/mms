import { z } from "zod";
import { stripStudentClientSoftDeleteFields } from "../students/studentUtils.js";
import { deepSanitizeStrings } from "./sanitize.js";
import { STUDENT_WRITE_SYSTEM_KEYS } from "../students/studentValidation.js";

const STUDENT_WRITE_SYSTEM_KEY_SET = new Set<string>(STUDENT_WRITE_SYSTEM_KEYS);

const studentWriteBaseObjectSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    contactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    fatherContactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    motherContactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    guardianContactId: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((v) => (v === null ? undefined : v)),
    studentId: z.string().optional(),
    grNumber: z.string().optional(),
    status: z.string().optional(),
    enrollmentDate: z.string().optional(),
    registeredDate: z.string().optional(),
    cnic: z.string().optional(),
    enrolledSessions: z.array(z.string()).optional(),
    discountType: z.string().optional(),
    discountPct: z.number().optional(),
    registrationType: z.string().optional(),
    avatar: z.union([z.string(), z.null()]).optional(),
    notes: z.string().optional(),
    name: z.string().optional(),
    gender: z.string().optional(),
    dob: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    city: z.string().optional(),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    guardianName: z.string().optional(),
    _blueprintId: z.union([z.string(), z.number()]).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
  })
  .strict();

/**
 * Student write DTO: soft-delete strip, then strict allowlist (system keys ∪
 * Setup custom field keys). Unknown top-level keys are rejected.
 */
export function buildStudentWriteSchema(extraFieldKeys: string[] = []): z.ZodTypeAny {
  const extras = [...new Set(extraFieldKeys.map((key) => key.trim()).filter(Boolean))].filter(
    (key) => !STUDENT_WRITE_SYSTEM_KEY_SET.has(key),
  );
  const extraShape = Object.fromEntries(extras.map((key) => [key, z.unknown().optional()]));
  const shapeSchema =
    extras.length > 0
      ? studentWriteBaseObjectSchema.extend(extraShape).strict()
      : studentWriteBaseObjectSchema;

  return z.preprocess((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const stripped = stripStudentClientSoftDeleteFields(raw as Record<string, unknown>);
    return deepSanitizeStrings(stripped);
  }, shapeSchema);
}

/** System-keys-only write schema (no Setup custom keys). Prefer `buildStudentWriteSchema` on tenant writes. */
export const studentWriteSchema = buildStudentWriteSchema();

/**
 * Wire-level student write DTO allowing custom setup fields to pass through to tenant dynamic validation.
 * Used at the @ts-rest contract gateway boundary.
 */
export const studentWireWriteSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const stripped = stripStudentClientSoftDeleteFields(raw as Record<string, unknown>);
  return deepSanitizeStrings(stripped);
}, studentWriteBaseObjectSchema.passthrough());

/**
 * Bulk enrollment goes through `enrollments` (source of truth): `add` needs a class (section is
 * defaulted server-side when omitted); `remove` cancels active enrollments in the session.
 */
export const studentsBulkEnrollBodySchema = z
  .object({
    studentIds: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
    sessionId: z.string().min(1),
    classId: z.string().min(1).optional(),
    sectionId: z.string().min(1).optional(),
    mode: z.enum(["add", "remove"]).default("add"),
  })
  .strict()
  .refine((body) => body.mode === "remove" || Boolean(body.classId), {
    message: "Class is required",
    path: ["classId"],
  });

export type StudentsBulkEnrollBody = z.infer<typeof studentsBulkEnrollBodySchema>;
/** Bulk-enroll target chosen in the UI (student ids come from the selection). */
export type StudentsBulkEnrollPlacement = Omit<StudentsBulkEnrollBody, "studentIds">;

const studentsDuplicateCheckBodyBaseSchema = z
  .object({
    excludeId: z.string().optional(),
    contactId: z.union([z.string(), z.number()]).optional(),
    email: z.string().max(320).optional(),
    name: z.string().max(500).optional(),
    dob: z.string().max(32).optional(),
    grNumber: z.string().max(64).optional(),
  })
  .strict();

export type StudentsDuplicateCheckBody = z.infer<typeof studentsDuplicateCheckBodyBaseSchema>;

export const studentsDuplicateCheckBodySchema: z.ZodType<StudentsDuplicateCheckBody> = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  },
  studentsDuplicateCheckBodyBaseSchema,
);

const studentsBulkStatusBaseSchema = z
  .object({
    ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(500),
    status: z.string().min(1).max(64),
  })
  .strict();

export const studentsBulkStatusSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, studentsBulkStatusBaseSchema);
