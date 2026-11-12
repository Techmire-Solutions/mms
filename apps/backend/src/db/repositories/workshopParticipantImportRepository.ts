import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { resolveWorkshopRegistration } from "@mms/shared";
import { contacts, workshopParticipants } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { throwIfBackgroundJobAborted } from "../../lib/backgroundJobAbort.js";
import { findWorkshopRow } from "./workshopEventsRepository.js";
import { countActiveParticipants } from "./workshopParticipantsRepository.js";
import { workshopToday } from "./workshopClock.js";
import { auditRow } from "./workshopAudit.js";

export interface WorkshopImportChunkResult {
  added: number;
  waitlisted: number;
  skipped: number;
  /** Per-contact failures; the runner maps the array position to a job row number. */
  failed: Array<{ contactId: string; code: string }>;
}

/**
 * One chunk of a queued participant import.
 *
 * The chunk is atomic and holds the workshop row lock, so seat/waitlist arithmetic cannot
 * interleave with a registration. Re-running the same chunk is safe: contacts that already have an
 * active registration are reported as `skipped` instead of inserted again. Every insert writes the
 * same audit row as the interactive registration path.
 */
export async function importParticipantChunk(
  tenant: string,
  workshopId: string,
  contactIds: readonly string[],
  signal?: AbortSignal,
): Promise<WorkshopImportChunkResult> {
  const subdomain = tenant.trim().toLowerCase();
  if (contactIds.length === 0) return { added: 0, waitlisted: 0, skipped: 0, failed: [] };

  return withTenant(subdomain, async (tx) => {
    const workshop = await findWorkshopRow(tx, subdomain, workshopId, { forUpdate: true });
    if (!workshop) throw new NotFoundError("Workshop not found");

    const ids = [...contactIds];
    const liveContacts = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceSubdomain, subdomain),
          inArray(contacts.id, ids),
          isNull(contacts.deletedAt),
        ),
      );
    const live = new Set(liveContacts.map((row) => row.id));

    const existing = await tx
      .select({ contactId: workshopParticipants.contactId })
      .from(workshopParticipants)
      .where(
        and(
          eq(workshopParticipants.workspaceSubdomain, subdomain),
          eq(workshopParticipants.workshopId, workshopId),
          inArray(workshopParticipants.contactId, ids),
          isNull(workshopParticipants.deletedAt),
        ),
      );
    const alreadyRegistered = new Set(existing.map((row) => row.contactId));

    const today = await workshopToday(subdomain);
    let seatsTaken = await countActiveParticipants(tx, subdomain, workshopId);
    const now = new Date();
    // Distinct waitlist timestamps keep input order as the queue order; identical `now()` values
    // would tie-break on random participant ids and shuffle the queue on a bulk import.
    let waitlistOffset = 0;
    const result: WorkshopImportChunkResult = {
      added: 0,
      waitlisted: 0,
      skipped: 0,
      failed: [],
    };

    for (const contactId of ids) {
      throwIfBackgroundJobAborted(signal);
      if (!live.has(contactId)) {
        result.failed.push({ contactId, code: "contact_not_found" });
        continue;
      }
      if (alreadyRegistered.has(contactId)) {
        result.skipped += 1;
        continue;
      }

      const resolution = resolveWorkshopRegistration(workshop, { today, seatsTaken });
      if (resolution.outcome === "blocked") {
        result.failed.push({
          contactId,
          code: resolution.blockers[0] ?? "workshop_not_open",
        });
        continue;
      }

      const waitlisted = resolution.outcome === "waitlisted";
      if (!waitlisted) seatsTaken += 1;
      const waitlistedAt = waitlisted ? new Date(now.getTime() + waitlistOffset++) : null;
      const id = randomUUID();
      await tx.insert(workshopParticipants).values({
        id,
        workspaceSubdomain: subdomain,
        workshopId,
        contactId,
        status: "registered",
        waitlistedAt,
      });
      await auditRow(tx, {
        workspaceSubdomain: subdomain,
        tableName: "workshop_participants",
        recordId: id,
        actionType: "CREATE",
        subjectId: contactId,
        newState: {
          id,
          workshopId,
          contactId,
          status: "registered",
          waitlistedAt,
          operation: "bulk_import",
        },
      });
      alreadyRegistered.add(contactId);
      if (waitlisted) result.waitlisted += 1;
      else result.added += 1;
    }

    return result;
  });
}
