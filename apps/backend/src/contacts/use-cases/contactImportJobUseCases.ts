import { CONTACTS_MODULE_MANIFEST, type Contact, type ContactsImportJobPayload } from "@mms/shared";
import { roleHasPermission } from "@mms/shared";
import { upsertContact } from "./contactWriteUseCases.js";
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
  let imported = 0;

  await context.updateProgress(0, total);

  for (let index = 0; index < total; index += 1) {
    try {
      await upsertContact(contacts[index] as Contact, { canRestore, language });
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
