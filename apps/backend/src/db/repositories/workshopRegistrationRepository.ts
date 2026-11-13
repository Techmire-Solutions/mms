import { randomUUID } from "node:crypto";
import { and, eq, getTableColumns, inArray, isNull } from "drizzle-orm";
import {
  isWorkshopWaitlistPromotable,
  resolveWorkshopRegistration,
  type WorkshopParticipant,
} from "@mms/shared";
import { workshopParticipants, contacts } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { auditRow } from "./workshopAudit.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { findWorkshopRow } from "./workshopEventsRepository.js";
import {
  countActiveParticipants,
  findParticipantById,
  listParticipantsByIds,
} from "./workshopParticipantsRepository.js";
import { promoteOldestWaitlistTx } from "./workshopWaitlistRepository.js";
import {
  assertParticipantWithdrawable,
  blockedRegistrationError,
} from "../../workshops/domain/workshopWriteGuards.js";
import { workshopToday } from "./workshopClock.js";

/**
 * Registration write path (single, batch, withdrawal + waitlist promotion).
 *
 * Every function here runs in one `withTenant` and starts by locking the workshop row. That lock is
 * the single mutex for the seat arithmetic: registration, withdrawal/promotion, capacity edits and
 * lifecycle transitions all take it, so a waitlisted participant can never be promoted twice and
 * capacity can never be exceeded by an API path.
 */

export interface WithdrawResult {
  removed: boolean;
  /** The queued participant moved into the freed seat, when one existed. */
  promoted: WorkshopParticipant | null;
}

/** True when the contact already holds an active row (seat or queue) in this workshop. */
async function existingContactIds(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  contactIds: readonly string[],
): Promise<string[]> {
  if (contactIds.length === 0) return [];
  const rows = await tx
    .select({ contactId: workshopParticipants.contactId })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        inArray(workshopParticipants.contactId, [...contactIds]),
        isNull(workshopParticipants.deletedAt),
      ),
    );
  return rows.map((row) => row.contactId);
}

async function requireLiveContacts(
  tx: TenantTransaction,
  subdomain: string,
  contactIds: readonly string[],
): Promise<void> {
  const rows = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.workspaceSubdomain, subdomain),
        inArray(contacts.id, [...contactIds]),
        isNull(contacts.deletedAt),
      ),
    );
  if (rows.length !== contactIds.length) throw new NotFoundError("Contact not found");
}

/**
 * Registers one contact: seats it, or queues it when the workshop is full and the waitlist is on.
 * Returns the participant record (its `waitlistedAt` tells the caller which happened).
 */
export async function registerParticipant(
  tenant: string,
  input: { id: string; workshopId: string; contactId: string },
): Promise<WorkshopParticipant> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const workshop = await findWorkshopRow(tx, subdomain, input.workshopId, { forUpdate: true });
    if (!workshop) throw new NotFoundError("Workshop not found");
    await requireLiveContacts(tx, subdomain, [input.contactId]);

    const existing = await existingContactIds(tx, subdomain, input.workshopId, [input.contactId]);
    if (existing.length > 0) {
      throw new ConflictError("This contact is already registered", "already_registered");
    }

    const resolution = resolveWorkshopRegistration(workshop, {
      today: await workshopToday(subdomain),
      seatsTaken: await countActiveParticipants(tx, subdomain, input.workshopId),
    });
    if (resolution.outcome === "blocked") {
      throw blockedRegistrationError(workshop.id, resolution.blockers);
    }

    const now = new Date();
    await tx.insert(workshopParticipants).values({
      id: input.id,
      workspaceSubdomain: subdomain,
      workshopId: input.workshopId,
      contactId: input.contactId,
      status: "registered",
      waitlistedAt: resolution.outcome === "waitlisted" ? now : null,
    });
    const added = await findParticipantById(tx, subdomain, input.workshopId, input.id);
    if (!added) throw new NotFoundError("Participant not found");
    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_participants",
      recordId: added.id,
      actionType: "CREATE",
      subjectId: added.contactId,
      newState: added,
    });
    return added;
  });
}

/**
 * Bulk registration (import-ready): one transaction, one event lock, all-or-nothing.
 *
 * Input order decides who gets the remaining seats; the overflow is queued when the waitlist is
 * enabled. Any unknown/archived contact, duplicate contact or blocked registration aborts the whole
 * batch before a single row is written.
 */
export async function registerParticipants(
  tenant: string,
  input: { workshopId: string; contactIds: readonly string[] },
): Promise<{ added: WorkshopParticipant[]; waitlisted: WorkshopParticipant[] }> {
  const subdomain = tenant.trim().toLowerCase();
  const contactIds = input.contactIds.map((id) => id.trim());
  if (new Set(contactIds).size !== contactIds.length) {
    throw new ConflictError(
      "The same contact appears twice in the batch",
      "duplicate_contact_in_batch",
    );
  }
  return withTenant(subdomain, async (tx) => {
    const workshop = await findWorkshopRow(tx, subdomain, input.workshopId, { forUpdate: true });
    if (!workshop) throw new NotFoundError("Workshop not found");
    await requireLiveContacts(tx, subdomain, contactIds);

    const existing = await existingContactIds(tx, subdomain, input.workshopId, contactIds);
    if (existing.length > 0) {
      throw new ConflictError("One or more contacts are already registered", "already_registered", {
        contactIds: existing,
      });
    }

    const today = await workshopToday(subdomain);
    let seatsTaken = await countActiveParticipants(tx, subdomain, input.workshopId);
    const planned: Array<{ id: string; contactId: string; waitlisted: boolean }> = [];
    for (const contactId of contactIds) {
      const resolution = resolveWorkshopRegistration(workshop, { today, seatsTaken });
      if (resolution.outcome === "blocked") {
        throw blockedRegistrationError(workshop.id, resolution.blockers);
      }
      const waitlisted = resolution.outcome === "waitlisted";
      if (!waitlisted) seatsTaken += 1;
      planned.push({ id: randomUUID(), contactId, waitlisted });
    }

    const now = new Date();
    await tx.insert(workshopParticipants).values(
      planned.map((row, index) => ({
        id: row.id,
        workspaceSubdomain: subdomain,
        workshopId: input.workshopId,
        contactId: row.contactId,
        status: "registered",
        // Distinct timestamps preserve input order as the waitlist queue order.
        waitlistedAt: row.waitlisted ? new Date(now.getTime() + index) : null,
      })),
    );
    const records = await listParticipantsByIds(
      tx,
      subdomain,
      input.workshopId,
      planned.map((row) => row.id),
    );
    for (const record of records) {
      await auditRow(tx, {
        workspaceSubdomain: subdomain,
        tableName: "workshop_participants",
        recordId: record.id,
        actionType: "CREATE",
        subjectId: record.contactId,
        newState: record,
      });
    }
    const byId = new Map(records.map((record) => [record.id, record]));
    return {
      added: planned
        .filter((row) => !row.waitlisted)
        .map((row) => byId.get(row.id)!)
        .filter(Boolean),
      waitlisted: planned
        .filter((row) => row.waitlisted)
        .map((row) => byId.get(row.id)!)
        .filter(Boolean),
    };
  });
}

/**
 * Withdraws a live registration. Freeing a seat promotes the oldest eligible queued participant in
 * the same transaction; withdrawing a queued row frees nothing and promotes nobody.
 */
export async function withdrawParticipant(
  tenant: string,
  input: { workshopId: string; participantId: string; deletedBy: string | null },
): Promise<WithdrawResult> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const workshop = await findWorkshopRow(tx, subdomain, input.workshopId, { forUpdate: true });
    if (!workshop) throw new NotFoundError("Workshop not found");

    const [participant] = await tx
      .select(getTableColumns(workshopParticipants))
      .from(workshopParticipants)
      .where(
        and(
          eq(workshopParticipants.workspaceSubdomain, subdomain),
          eq(workshopParticipants.workshopId, input.workshopId),
          eq(workshopParticipants.id, input.participantId),
          isNull(workshopParticipants.deletedAt),
        ),
      )
      .limit(1);
    if (!participant) return { removed: false, promoted: null };
    assertParticipantWithdrawable(workshop, participant);

    const now = new Date();
    await tx
      .update(workshopParticipants)
      .set({ deletedAt: now, deletedBy: input.deletedBy, updatedAt: now })
      .where(
        and(
          eq(workshopParticipants.workspaceSubdomain, subdomain),
          eq(workshopParticipants.workshopId, input.workshopId),
          eq(workshopParticipants.id, input.participantId),
          isNull(workshopParticipants.deletedAt),
        ),
      );

    await auditRow(tx, {
      workspaceSubdomain: subdomain,
      tableName: "workshop_participants",
      recordId: participant.id,
      actionType: "DELETE",
      subjectId: participant.contactId,
      oldState: participant,
      newState: {
        ...participant,
        deletedAt: now,
        deletedBy: input.deletedBy,
        updatedAt: now,
      },
    });

    let promoted: WorkshopParticipant | null = null;
    if (!participant.waitlistedAt) {
      const today = await workshopToday(subdomain);
      if (isWorkshopWaitlistPromotable(workshop, today)) {
        const [promotedId] = await promoteOldestWaitlistTx(tx, subdomain, input.workshopId, 1);
        if (promotedId) {
          promoted = await findParticipantById(tx, subdomain, input.workshopId, promotedId);
        }
      }
    }
    return { removed: true, promoted };
  });
}
