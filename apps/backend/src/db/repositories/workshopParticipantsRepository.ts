import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { WorkshopParticipant, WorkshopParticipantStatus } from "@mms/shared";
import { contactPhones, contacts, workshopParticipants } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { findWorkshopRow } from "./workshopEventsRepository.js";

/** Primary phone of the participant's contact, first by sort order when none is marked primary. */
const primaryPhone = sql<string>`coalesce((
  select ${contactPhones.number} from ${contactPhones}
   where ${contactPhones.workspaceSubdomain} = ${workshopParticipants.workspaceSubdomain}
     and ${contactPhones.contactId} = ${workshopParticipants.contactId}
   order by ${contactPhones.isPrimary} desc, ${contactPhones.sortOrder} asc
   limit 1), '')`;

export async function listActiveParticipants(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<WorkshopParticipant[]> {
  const rows = await tx
    .select({
      id: workshopParticipants.id,
      workshopId: workshopParticipants.workshopId,
      contactId: workshopParticipants.contactId,
      contactName: sql<string>`coalesce(${contacts.name}, '')`,
      contactPhone: primaryPhone,
      status: workshopParticipants.status,
      completedAt: workshopParticipants.completedAt,
      certificateIssuedAt: workshopParticipants.certificateIssuedAt,
      createdAt: workshopParticipants.createdAt,
    })
    .from(workshopParticipants)
    .leftJoin(
      contacts,
      and(
        eq(contacts.workspaceSubdomain, workshopParticipants.workspaceSubdomain),
        eq(contacts.id, workshopParticipants.contactId),
      ),
    )
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
      ),
    )
    .orderBy(asc(contacts.name));
  return rows.map((row) => ({
    ...row,
    status: row.status as WorkshopParticipantStatus,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    certificateIssuedAt: row.certificateIssuedAt ? row.certificateIssuedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Registers a contact. The event row is locked first, so two concurrent registrations cannot
 * both pass the capacity check; the partial unique index still backstops duplicates.
 */
export async function registerParticipant(
  tenant: string,
  input: { id: string; workshopId: string; contactId: string; today: string },
): Promise<WorkshopParticipant> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const workshop = await findWorkshopRow(tx, subdomain, input.workshopId, { forUpdate: true });
    if (!workshop) throw new NotFoundError("Workshop not found");
    if (workshop.registrationDeadline && input.today > workshop.registrationDeadline) {
      throw new ValidationError("Registration for this workshop has closed");
    }

    const [contact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceSubdomain, subdomain),
          eq(contacts.id, input.contactId),
          isNull(contacts.deletedAt),
        ),
      )
      .limit(1);
    if (!contact) throw new NotFoundError("Contact not found");

    const active = await listActiveParticipants(tx, subdomain, input.workshopId);
    if (active.some((participant) => participant.contactId === input.contactId)) {
      throw new ConflictError("This contact is already registered");
    }
    if (workshop.capacity !== null && active.length >= workshop.capacity) {
      throw new ConflictError("This workshop is full");
    }

    await tx.insert(workshopParticipants).values({
      id: input.id,
      workspaceSubdomain: subdomain,
      workshopId: input.workshopId,
      contactId: input.contactId,
      status: "registered",
    });
    const added = (await listActiveParticipants(tx, subdomain, input.workshopId)).find(
      (participant) => participant.id === input.id,
    );
    if (!added) throw new NotFoundError("Participant not found");
    return added;
  });
}

export async function withdrawParticipant(
  tenant: string,
  input: { workshopId: string; participantId: string; deletedBy: string | null },
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(workshopParticipants)
      .set({ deletedAt: now, deletedBy: input.deletedBy, updatedAt: now })
      .where(
        and(
          eq(workshopParticipants.workspaceSubdomain, subdomain),
          eq(workshopParticipants.workshopId, input.workshopId),
          eq(workshopParticipants.id, input.participantId),
          isNull(workshopParticipants.deletedAt),
        ),
      )
      .returning({ id: workshopParticipants.id });
    return updated.length > 0;
  });
}
