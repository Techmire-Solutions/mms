import { z } from "zod";

/**
 * Bulk-tagging payload schema and request caps. The caps are mirrored by the
 * Contacts bulk-tag modal (the server rejects requests beyond these).
 */

/** Maximum tags per bulk-tag request. */
export const CONTACTS_BULK_TAG_MAX_TAGS = 100;

/** Maximum contacts per bulk-tag request. */
export const CONTACTS_BULK_TAG_MAX_CONTACTS = 500;

/** Payload schema for bulk tagging contact records. */
export const contactsBulkTagBodySchema = z
  .object({
    // Same ceiling as `bulkIdsBodySchema`: one request may not force an unbounded
    // `IN (...)` write (PostgreSQL caps bind parameters at 65 535).
    ids: z
      .array(z.string().min(1))
      .min(1, "At least one contact ID is required")
      .max(
        CONTACTS_BULK_TAG_MAX_CONTACTS,
        `At most ${CONTACTS_BULK_TAG_MAX_CONTACTS} contacts can be tagged at once`,
      ),
    addTags: z.array(z.string().trim().min(1)).max(CONTACTS_BULK_TAG_MAX_TAGS).optional(),
    removeTags: z.array(z.string().trim().min(1)).max(CONTACTS_BULK_TAG_MAX_TAGS).optional(),
  })
  .strict()
  .refine((data) => (data.addTags?.length ?? 0) > 0 || (data.removeTags?.length ?? 0) > 0, {
    message: "At least one tag to add or remove must be provided",
  });

export type ContactsBulkTagBody = z.infer<typeof contactsBulkTagBodySchema>;
