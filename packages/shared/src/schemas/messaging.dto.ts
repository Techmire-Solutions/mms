import { z } from "zod";
import { messageCategorySchema } from "../messagingCategorySchemas.js";
import { deepSanitizeStrings } from "./sanitize.js";

export const messageStatusSchema = z.enum(["queued", "sent", "delivered", "failed", "skipped"]);

/** Max logs accepted in a single POST /api/messaging/logs body. */
export const MESSAGE_LOG_RECORD_BATCH_MAX = 500;

/** Default page size for messaging reports / log history. */
export const MESSAGE_LOGS_DEFAULT_PAGE_SIZE = 50;

const messageLogCreateBaseSchema = z
  .object({
    contactId: z.union([z.string(), z.number()]),
    channel: z.enum(["sms", "whatsapp", "email"]),
    body: z.string().min(1).max(10_000),
    status: z.enum(["sent", "failed", "skipped"]).optional().default("sent"),
    subject: z.string().max(500).optional(),
    category: messageCategorySchema.optional().default("general"),
    errorMessage: z.string().max(1_000).optional(),
  })
  .strict();

/** Client-submitted dispatch attempt — server assigns id, userId, and sentAt. */
export const messageLogCreateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messageLogCreateBaseSchema);

export const messageRecordSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    contactId: z.union([z.string(), z.number()]),
    channel: z.enum(["sms", "whatsapp", "email"]),
    body: z.string(),
    sentAt: z.string(),
    status: messageStatusSchema.optional().default("sent"),
    subject: z.string().optional(),
    category: messageCategorySchema.optional().default("general"),
    errorMessage: z.string().optional(),
    deletedAt: z.string().optional(),
    deletedBy: z.string().optional(),
    deletionReason: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const messageLogListSchema = z.array(messageRecordSchema);

const messageInsertBaseSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().optional(),
    contactId: z.union([z.string(), z.number()]),
    channel: z.enum(["sms", "whatsapp", "email"]),
    body: z.string().min(1),
    sentAt: z.string().optional(),
    status: messageStatusSchema.optional().default("sent"),
    subject: z.string().optional(),
    category: messageCategorySchema.optional().default("general"),
    errorMessage: z.string().optional(),
    deletedAt: z.string().optional(),
    deletedBy: z.string().optional(),
    deletionReason: z.string().optional(),
  })
  .strict();

export const messageInsertSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messageInsertBaseSchema);

export type MessageInsert = z.infer<typeof messageInsertBaseSchema>;
export const messageUpdateSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messageInsertBaseSchema.partial().strict());
export type MessageUpdate = z.infer<typeof messageUpdateSchema>;

const recordMessageLogsBaseSchema = z
  .object({
    logs: z.array(messageLogCreateBaseSchema).min(1).max(MESSAGE_LOG_RECORD_BATCH_MAX),
    /** Client retry key — duplicate POSTs with the same key return the prior recorded count. */
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export const recordMessageLogsSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, recordMessageLogsBaseSchema);

export const messagingLogsQuerySchema = z
  .object({
    channel: z.string().optional(),
    category: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .default(MESSAGE_LOGS_DEFAULT_PAGE_SIZE),
    includeDeleted: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .transform((value) => value === true || value === "true"),
  })
  .strict();

export const MESSAGING_RECIPIENT_ROLES = [
  "all",
  "students",
  "faculty",
  "staff",
  "contacts",
] as const;

/** Coerce unknown role query values to a known messaging recipient role. */
export function normalizeMessagingRecipientRole(
  role: string | undefined,
): (typeof MESSAGING_RECIPIENT_ROLES)[number] {
  if ((MESSAGING_RECIPIENT_ROLES as readonly string[]).includes(role ?? "")) {
    return role as (typeof MESSAGING_RECIPIENT_ROLES)[number];
  }
  return "all";
}
export const MESSAGING_RECIPIENT_GENDERS = ["all", "male", "female", "unspecified"] as const;

/** Cap for Work “select all reachable” match — same ceiling as the retired FE page-walk. */
export const MESSAGING_RECIPIENTS_MATCH_LIMIT = 10_000;

/** Hard cap for messaging CSV export row count (in-memory job artifact). */
export const MESSAGING_CSV_EXPORT_MAX_ROWS = 50_000;

/** Hard cap for messaging CSV export UTF-8 byte size. */
export const MESSAGING_CSV_EXPORT_MAX_BYTES = 25 * 1024 * 1024;

/** Work-tab recipient directory query (server-paginated under messaging RBAC). */
export const messagingRecipientsQuerySchema = z
  .object({
    role: z
      .preprocess(
        (value) => normalizeMessagingRecipientRole(typeof value === "string" ? value : undefined),
        z.enum(MESSAGING_RECIPIENT_ROLES),
      )
      .optional()
      .default("all"),
    gender: z.enum(MESSAGING_RECIPIENT_GENDERS).optional().default("all"),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(200).optional().default(50),
    hasPhone: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === true || value === "true")),
    hasEmail: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === true || value === "true")),
  })
  .strict();

/** Select-all reachable recipients (no client page-walk). */
export const messagingRecipientsMatchQuerySchema = messagingRecipientsQuerySchema
  .omit({ page: true, pageSize: true, hasPhone: true, hasEmail: true })
  .extend({
    kind: z.enum(["phone", "email"]),
  });

export const messagingRecipientsMatchResponseSchema = z
  .object({
    recipients: z.array(
      z
        .object({
          id: z.union([z.string(), z.number()]),
          name: z.string(),
          phone: z.string(),
          email: z.string().optional(),
        })
        .strict(),
    ),
    total: z.number().int().nonnegative(),
    truncated: z.boolean(),
    limit: z.number().int().positive(),
  })
  .strict();

export const messagingMetricsSchema = z
  .object({
    total: z.number(),
    smsCount: z.number(),
    whatsappCount: z.number(),
    emailCount: z.number(),
    sentCount: z.number(),
    deliveredCount: z.number(),
    failedCount: z.number(),
    skippedCount: z.number(),
    queuedCount: z.number().optional(),
    successRate: z.number(),
    categoryBreakdown: z.record(messageCategorySchema, z.number()).optional(),
  })
  .strict();

/** Date-range query for GET /api/messaging/metrics. */
export const messagingMetricsQuerySchema = messagingLogsQuerySchema.pick({
  startDate: true,
  endDate: true,
});

/** Filter fields accepted when queueing a messaging logs CSV export job. */
export const messagingCsvExportQuerySchema = messagingLogsQuerySchema.pick({
  channel: true,
  category: true,
  search: true,
  status: true,
  startDate: true,
  endDate: true,
});

const messagingCsvExportBodyBaseSchema = z
  .object({
    query: messagingCsvExportQuerySchema.optional(),
    filename: z.string().min(1).max(200).optional(),
    label: z.string().min(1).max(500).optional(),
    /** Client retry key — reused as the background job id when provided. */
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

/** POST /api/messaging/export/csv body. */
export const messagingCsvExportBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, messagingCsvExportBodyBaseSchema);

/** Client dispatch-log create payload (server assigns id/userId/sentAt). */
export type MessageLogCreateDto = z.infer<typeof messageLogCreateBaseSchema>;
/** Recorded message dispatch history DTO payload structure. */
export type MessageRecordDto = z.infer<typeof messageRecordSchema>;
/** Canonical sent-message domain type (Zod-inferred). */
export type Message = MessageRecordDto;
/** Filter and pagination query parameters for message logs. */
export type MessagingLogsQueryDto = z.infer<typeof messagingLogsQuerySchema>;
/** Work recipient directory query parameters. */
export type MessagingRecipientsQueryDto = z.infer<typeof messagingRecipientsQuerySchema>;
/** Select-all reachable match query. */
export type MessagingRecipientsMatchQueryDto = z.infer<typeof messagingRecipientsMatchQuerySchema>;
/** Select-all reachable match response. */
export type MessagingRecipientsMatchResponseDto = z.infer<
  typeof messagingRecipientsMatchResponseSchema
>;
/** Messaging volume and delivery metrics summary DTO. */
export type MessagingMetricsDto = z.infer<typeof messagingMetricsSchema>;
/** Messaging metrics date-range query. */
export type MessagingMetricsQueryDto = z.infer<typeof messagingMetricsQuerySchema>;
/** Messaging CSV export job filter query. */
export type MessagingCsvExportQueryDto = z.infer<typeof messagingCsvExportQuerySchema>;
/** Messaging CSV export enqueue body. */
export type MessagingCsvExportBodyDto = z.infer<typeof messagingCsvExportBodyBaseSchema>;
