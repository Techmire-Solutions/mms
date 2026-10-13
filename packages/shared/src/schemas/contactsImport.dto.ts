import { z } from "zod";
import { contactRecordSchema } from "../contacts/contactsModuleManifest.js";
import { WHATSAPP_STATUS_VALUES } from "../contacts/contactEntityTypes.js";
import { deepSanitizeStrings } from "./sanitize.js";

/** Parsed contacts may still carry the pre-verification `unknown` WhatsApp state. */
const importContactRecordSchema = contactRecordSchema.extend({
  whatsappStatus: z.union([z.enum(WHATSAPP_STATUS_VALUES), z.literal("unknown")]).optional(),
});

/**
 * Max contacts accepted by one `POST /api/contacts/import` job.
 *
 * Keeps the request body inside the server body limit (default 1 MB) and the per-job
 * progress reporting meaningful; clients chunk larger vCard files into several jobs.
 */
export const CONTACTS_IMPORT_MAX_BATCH = 500;

const importIdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .optional();

/**
 * Queued contacts import body.
 *
 * `contacts` items are validated per record so one malformed card fails on its own instead
 * of rejecting the whole batch: `parseVCard` already drops nameless cards, so `firstName`
 * is guaranteed by the client, and any record-level rejection is counted as a failure.
 */
export const contactsImportBodySchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  },
  z
    .object({
      contacts: z.array(importContactRecordSchema).min(1).max(CONTACTS_IMPORT_MAX_BATCH),
      label: z.string().min(1).max(200).optional(),
      idempotencyKey: importIdempotencyKeySchema,
    })
    .strict(),
);

export type ContactsImportBody = z.infer<typeof contactsImportBodySchema>;

/** Job payload the import route hands to the `contacts:import` worker. */
export interface ContactsImportJobPayload {
  contacts: Array<Record<string, unknown>>;
  label?: string;
  /** Enqueuing user's role — the worker applies delete-permission gating for restores. */
  viewerRole: string;
  language?: string;
}
