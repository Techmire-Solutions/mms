import { CONTACTS_MODULE_MANIFEST, type Contact, type ContactsImportJobPayload } from "@mms/shared";
import { roleHasPermission } from "@mms/shared";
import { upsertContact } from "./contactWriteUseCases.js";
import { reconcileContactSystemTags } from "../systemTags/contactSystemTagUseCases.js";
import { loadContactWriteContext } from "./contactWriteContext.js";
import { invalidateDuplicateScanCache } from "./contactDuplicateScanUseCases.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { logger } from "../../lib/logger.js";
import {
  mapActionStringToAuditType,
  recordModernAuditEvent,
} from "../../services/auditTrailService.js";

/** Per-item failure detail captured for the job label / logs (bounded). */
const MAX_RECORDED_FAILURES = 5;

export interface ContactsImportJobRunContext {
  tenant: string;
  userId: string;
  jobId: string;
  updateProgress: (current: number, total: number) => Promise<void>;
}

export interface ContactsImportJobResult {
  imported: number;
  failed: number;
  total: number;
  failures: string[];
}

/**
 * Runs a queued contacts import batch.
 *
 * Replaces the former N-sequential-POST loop: one job upserts the batch in the worker, reports
 * progress per contact, and writes **one** aggregate `contact.import` audit row rather than
 * relying on the client to recount. Per-item failures never abort the batch.
 */
export async function runContactsImportJob(
  payload: ContactsImportJobPayload,
  context: ContactsImportJobRunContext,
): Promise<ContactsImportJobResult> {
  const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
  const total = contacts.length;
  const canRestore = Boolean(
    payload.viewerRole &&
    roleHasPermission(payload.viewerRole, CONTACTS_MODULE_MANIFEST.permissions.delete),
  );
  const language = payload.language || "en";
  const failures: string[] = [];
  const importedContactIds = new Set<string>();
  let imported = 0;

  await context.updateProgress(0, total);
  // Tenant configuration is identical for every record in the batch: read it
  // once instead of once per contact (each read was ~5 queries).
  const writeContext = await loadContactWriteContext();

  for (let index = 0; index < total; index += 1) {
    try {
      const saved = await upsertContact(contacts[index] as Contact, {
        canRestore,
        language,
        actorId: context.userId,
        context: writeContext,
        batchMode: true,
      });
      if (saved?.contact?.id != null) importedContactIds.add(String(saved.contact.id));
      imported += 1;
    } catch (error) {
      if (failures.length < MAX_RECORDED_FAILURES) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    // Every write is a round-trip; report progress often enough to feel live without
    // hammering the job row.
    if ((index + 1) % 10 === 0 || index + 1 === total) {
      await context.updateProgress(index + 1, total);
    }
  }

  // Per-record side effects were suppressed by `batchMode`; run each once for
  // the whole batch instead of once per contact.
  if (imported > 0) {
    // Batch writes skip per-record role probes; reconcile the imported contacts once.
    if (importedContactIds.size > 0) {
      await reconcileContactSystemTags(context.tenant, [...importedContactIds], {
        actorId: context.userId,
        touchContacts: false,
      });
    }
    await invalidateDuplicateScanCache();
    await broadcastCollection("contacts");
  }

  const failed = total - imported;
  await recordContactsImportAudit(context, imported, failed, total);

  return { imported, failed, total, failures };
}

async function recordContactsImportAudit(
  context: ContactsImportJobRunContext,
  imported: number,
  failed: number,
  total: number,
): Promise<void> {
  try {
    await recordModernAuditEvent({
      workspaceSubdomain: context.tenant,
      tableName: CONTACTS_MODULE_MANIFEST.moduleId,
      recordId: context.jobId,
      actionType: mapActionStringToAuditType("contact.import"),
      realUserId: context.userId,
      newState: {
        summary:
          failed > 0
            ? `Imported ${imported}/${total} contact(s) (${failed} failed)`
            : `Imported ${imported} contact(s)`,
        action: "contact.import",
      },
    });
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "contacts import audit event append failed",
    );
  }
}

/** Human job label for a finished batch (the jobs tray shows this). */
export function buildContactsImportJobLabel(result: ContactsImportJobResult): string {
  if (result.failed > 0) {
    return `Imported ${result.imported} of ${result.total} contacts (${result.failed} failed)`;
  }
  return `Imported ${result.imported} contacts`;
}
