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
    // Length bounds mirror the Drizzle column widths so oversized input is a 400 validation error
    // instead of a database error surfacing as 500 (mms-backend-api §validation).
    studentId: z.string().max(100).optional(),
    grNumber: z.string().max(100).optional(),
    status: z.string().max(50).optional(),
    enrollmentDate: z.string().max(32).optional(),
    registeredDate: z.string().max(32).optional(),
    cnic: z.string().max(32).optional(),
    enrolledSessions: z.array(z.string()).optional(),
    discountType: z.string().max(100).optional(),
    discountPct: z.number().optional(),
    registrationType: z.string().max(100).optional(),
    avatar: z.union([z.string(), z.null()]).optional(),
    notes: z.string().max(4000).optional(),
    name: z.string().max(200).optional(),
    gender: z.string().max(50).optional(),
    dob: z.string().max(32).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    fatherName: z.string().max(255).optional(),
    motherName: z.string().max(255).optional(),
    guardianName: z.string().max(255).optional(),
    _blueprintId: z.union([z.string(), z.number()]).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    // The read mapper emits both the flattened custom keys and this nested map, so rejecting it
    // made GET -> PUT fail with `Unknown field "customFields"`. Accepted for round-trips and then
    // dropped during normalization — the flattened keys stay the only write surface.
    customFields: z.record(z.string(), z.unknown()).optional(),
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
