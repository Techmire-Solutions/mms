import type { BackgroundJobRecord, Contact } from "@mms/shared";
import { startServerBackgroundJob } from "@/lib/backgroundJobs/startServerBackgroundJob";

/**
 * Queue one contacts import batch and poll until the worker finishes.
 *
 * Replaces the former one-POST-per-contact loop: a batch is a single request, the worker
 * upserts each contact, and the returned terminal job reports the counts via
 * `progress.current` (imported) / `progress.total` (received).
 *
 * The payload deliberately omits `viewerRole` — the route derives it from the session, and
 * `contactsImportBodySchema` validates the body server-side.
 */
export async function startServerContactsImport(options: {
  contacts: Contact[];
  label: string;
  idempotencyKey?: string;
  onProgress?: (job: BackgroundJobRecord) => void;
}): Promise<BackgroundJobRecord> {
  return startServerBackgroundJob({
    path: "/api/contacts/import",
    body: {
      contacts: options.contacts,
      label: options.label,
      idempotencyKey: options.idempotencyKey,
    },
    onProgress: options.onProgress,
  });
}
