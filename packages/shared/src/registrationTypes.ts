import { z } from 'zod';
import { isoDateSchema } from './isoDateSchema.js';
import { ELIGIBILITY_REASONS, type EligibilityReason } from './enrollmentEligibility.js';

/** Applications lifecycle (Enrollments → Admissions). */
export const REGISTRATION_APPLICATION_STATUSES = ['submitted', 'under_review', 'waitlisted', 'approved', 'rejected', 'withdrawn'] as const;
export type RegistrationApplicationStatus = (typeof REGISTRATION_APPLICATION_STATUSES)[number];

const instant = z.string().datetime({ offset: true });
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

/** Public registration link on a session (Sessions → session detail). */
export const registrationLinkSchema = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    slug: z.string(),
    title: z.string().nullable(),
    isActive: z.boolean(),
    opensAt: z.string().nullable(),
    closesAt: z.string().nullable(),
    maxSubmissions: z.number().int().nullable(),
    requiresReview: z.boolean(),
    classIds: z.array(z.string()),
    submissionCount: z.number().int(),
    deletedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type RegistrationLink = z.infer<typeof registrationLinkSchema>;

export const registrationLinkWriteSchema = z
  .object({
    title: optionalText(150),
    isActive: z.boolean().default(true),
    opensAt: instant.nullish().transform((value) => value ?? null),
    closesAt: instant.nullish().transform((value) => value ?? null),
    maxSubmissions: z.number().int().min(1).max(100_000).nullish().transform((value) => value ?? null),
    requiresReview: z.boolean().default(true),
    /** Classes offered on this link (empty = every class of the session). */
    classIds: z.array(z.string().min(1).max(64)).max(200).default([]),
  })
  .strict()
  .refine((body) => !body.opensAt || !body.closesAt || body.closesAt > body.opensAt, { path: ['closesAt'], message: 'Closing time must be after opening time' });
export type RegistrationLinkWrite = z.input<typeof registrationLinkWriteSchema>;

/** Public, PII-free view of a link (GET /api/public/registrations/:slug). */
export const publicRegistrationClassSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    gender: z.string(),
    minAge: z.number(),
    maxAge: z.number(),
    ageCalculationDate: z.string(),
    seatsLeft: z.number().nullable(),
  })
  .strict();
export const publicRegistrationViewSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    madrasaName: z.string(),
    sessionName: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    closesAt: z.string().nullable(),
    acceptingSubmissions: z.boolean(),
    classes: z.array(publicRegistrationClassSchema),
  })
  .strict();
export type PublicRegistrationView = z.infer<typeof publicRegistrationViewSchema>;
export type PublicRegistrationClass = z.infer<typeof publicRegistrationClassSchema>;

/** Public application form body. `website` is a honeypot and must stay empty. */
export const registrationSubmitSchema = z
  .object({
    classId: z.string().min(1).max(64),
    fullName: z.string().trim().min(2, 'Name is required').max(150),
    guardianName: z.string().trim().min(2, 'Guardian name is required').max(150),
    dateOfBirth: isoDateSchema,
    gender: z.enum(['male', 'female']),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
    email: z.string().trim().email().max(200).nullish().or(z.literal('')).transform((value) => (value ? value : null)),
    address: optionalText(500),
    previousMadrasa: optionalText(200),
    website: z.string().max(0).optional(),
  })
  .strict();
export type RegistrationSubmit = z.input<typeof registrationSubmitSchema>;

export const registrationSubmitResultSchema = z
  .object({
    reference: z.string(),
    status: z.enum(REGISTRATION_APPLICATION_STATUSES),
  })
  .strict();

/** Staff view of an application (Enrollments → Admissions). */
export const registrationApplicationSchema = z
  .object({
    id: z.string(),
    reference: z.string(),
    linkId: z.string(),
    sessionId: z.string(),
    sessionName: z.string(),
    classId: z.string(),
    className: z.string(),
    preferredSectionId: z.string().nullable(),
    fullName: z.string(),
    guardianName: z.string(),
    dateOfBirth: z.string(),
    gender: z.string(),
    phone: z.string(),
    email: z.string().nullable(),
    address: z.string().nullable(),
    previousMadrasa: z.string().nullable(),
    status: z.enum(REGISTRATION_APPLICATION_STATUSES),
    eligibilityReasons: z.array(z.enum(ELIGIBILITY_REASONS)),
    matchedStudentId: z.string().nullable(),
    studentId: z.string().nullable(),
    enrollmentId: z.string().nullable(),
    reviewReason: z.string().nullable(),
    reviewedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
export type RegistrationApplication = z.infer<typeof registrationApplicationSchema>;

export const registrationApplicationListQuerySchema = z
  .object({
    sessionId: z.string().max(64).optional(),
    status: z.enum(REGISTRATION_APPLICATION_STATUSES).optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type RegistrationApplicationListQuery = z.input<typeof registrationApplicationListQuerySchema>;

/** Review decision; approval may reuse an existing student instead of creating one. */
export const registrationReviewSchema = z
  .object({
    ids: z.array(z.string().min(1).max(64)).min(1).max(100),
    decision: z.enum(['approve', 'reject', 'waitlist', 'under_review']),
    reason: optionalText(500),
    sectionId: z.string().max(64).nullish().transform((value) => value ?? null),
    existingStudentId: z.string().max(64).nullish().transform((value) => value ?? null),
  })
  .strict()
  .refine((body) => body.decision !== 'reject' || Boolean(body.reason), { path: ['reason'], message: 'A reason is required to reject' })
  .refine((body) => !body.existingStudentId || body.ids.length === 1, { path: ['existingStudentId'], message: 'Match one application at a time' });
export type RegistrationReview = z.input<typeof registrationReviewSchema>;

export const registrationReviewResultSchema = z
  .object({
    updated: z.number().int(),
    failures: z.array(z.object({ id: z.string(), message: z.string() }).strict()),
  })
  .strict();

/** Admissions funnel KPIs. */
export const admissionsMetricsSchema = z
  .object({
    submitted: z.number().int(),
    underReview: z.number().int(),
    waitlisted: z.number().int(),
    approved: z.number().int(),
    rejected: z.number().int(),
    enrolled: z.number().int(),
  })
  .strict();
export type AdmissionsMetrics = z.infer<typeof admissionsMetricsSchema>;

/** Error type returned (422) when a public application fails eligibility. */
export const REGISTRATION_INELIGIBLE_ERROR_TYPE = 'registration_ineligible';
export type RegistrationIneligibleReasons = EligibilityReason[];
