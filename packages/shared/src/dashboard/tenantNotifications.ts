import { z } from "zod";

/** Stored notification kinds; each one has its own translated sentence in the UI. */
export const TENANT_NOTIFICATION_KINDS = ["waitlist_seat_offered"] as const;
export type TenantNotificationKind = (typeof TENANT_NOTIFICATION_KINDS)[number];

/** Newest notifications shown to a user, and how far back they reach. */
export const TENANT_NOTIFICATION_LIST_LIMIT = 50;
export const TENANT_NOTIFICATION_RETENTION_DAYS = 90;

/** A stored notification as one user sees it (`read` is that user's receipt). */
export const tenantNotificationRecordSchema = z
  .object({
    id: z.string(),
    kind: z.enum(TENANT_NOTIFICATION_KINDS),
    entityType: z.string(),
    entityId: z.string(),
    /** Who or what it is about, e.g. the applicant's name and reference. */
    subjectLabel: z.string(),
    /** Where, e.g. the class the seat opened in. */
    contextLabel: z.string(),
    createdAt: z.string(),
    read: z.boolean(),
  })
  .strict();
export type TenantNotificationRecord = z.infer<typeof tenantNotificationRecordSchema>;

export const tenantNotificationListSchema = z
  .object({
    notifications: z.array(tenantNotificationRecordSchema),
    unreadCount: z.number().int(),
  })
  .strict();
export type TenantNotificationList = z.infer<typeof tenantNotificationListSchema>;
