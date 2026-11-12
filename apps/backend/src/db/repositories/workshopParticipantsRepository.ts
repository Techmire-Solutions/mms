import { and, asc, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { workshopParticipantStatusSchema, type WorkshopParticipant } from "@mms/shared";
import { contactPhones, contacts, workshopParticipants } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

/**
 * Participant reads.
 *
 * The primary phone is resolved by a **lateral join** (`ORDER BY is_primary DESC, sort_order ASC
 * LIMIT 1`), matching `contact_phones_workspace_contact_priority_idx`. The previous correlated
 * subquery re-ran the same lookup for every participant row; the lateral join is planned once and
 * uses the same index. Rows always join only live contacts (soft-delete §1), while the registration
 * itself is never dropped because its contact was archived.
 */

const participantColumns = {
  id: workshopParticipants.id,
  workshopId: workshopParticipants.workshopId,
  contactId: workshopParticipants.contactId,
  contactName: sql<string>`coalesce(${contacts.name}, '')`,
  status: workshopParticipants.status,
  completedAt: workshopParticipants.completedAt,
  certificateIssuedAt: workshopParticipants.certificateIssuedAt,
  waitlistedAt: workshopParticipants.waitlistedAt,
  createdAt: workshopParticipants.createdAt,
};

const contactJoin = and(
  eq(contacts.workspaceSubdomain, workshopParticipants.workspaceSubdomain),
  eq(contacts.id, workshopParticipants.contactId),
  isNull(contacts.deletedAt),
);

function primaryPhoneLateral(tx: TenantTransaction) {
  return tx
    .select({ number: contactPhones.number })
    .from(contactPhones)
    .where(
      and(
        eq(contactPhones.workspaceSubdomain, workshopParticipants.workspaceSubdomain),
        eq(contactPhones.contactId, workshopParticipants.contactId),
      ),
    )
    .orderBy(desc(contactPhones.isPrimary), asc(contactPhones.sortOrder))
    .limit(1)
    .as("primary_phone");
}

function participantQuery(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  extra: SQL[] = [],
  seatedOnly = true,
) {
  const phone = primaryPhoneLateral(tx);
  return tx
    .select({
      ...participantColumns,
      contactPhone: sql<string>`coalesce(${phone.number}, '')`,
    })
    .from(workshopParticipants)
    .leftJoin(contacts, contactJoin)
    .leftJoinLateral(phone, sql`true`)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
        ...(seatedOnly ? [isNull(workshopParticipants.waitlistedAt)] : []),
        ...extra,
      ),
    );
}

function toParticipant(row: {
  id: string;
  workshopId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  status: string;
  completedAt: Date | null;
  certificateIssuedAt: Date | null;
  waitlistedAt: Date | null;
  createdAt: Date;
}): WorkshopParticipant {
  return {
    ...row,
    status: workshopParticipantStatusSchema.parse(row.status),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    certificateIssuedAt: row.certificateIssuedAt ? row.certificateIssuedAt.toISOString() : null,
    waitlistedAt: row.waitlistedAt ? row.waitlistedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listActiveParticipants(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<WorkshopParticipant[]> {
  const rows = await participantQuery(tx, subdomain, workshopId).orderBy(asc(contacts.name));
  return rows.map(toParticipant);
}

/** One seated registration of the workshop (waitlisted rows are not participants yet). */
export async function findActiveParticipant(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  participantId: string,
): Promise<WorkshopParticipant | null> {
  const [row] = await participantQuery(tx, subdomain, workshopId, [
    eq(workshopParticipants.id, participantId),
  ]).limit(1);
  return row ? toParticipant(row) : null;
}

/** One active registration, seated or waitlisted — used to read back an insert. */
export async function findParticipantById(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  participantId: string,
): Promise<WorkshopParticipant | null> {
  const [row] = await participantQuery(
    tx,
    subdomain,
    workshopId,
    [eq(workshopParticipants.id, participantId)],
    false,
  ).limit(1);
  return row ? toParticipant(row) : null;
}

/** Batch read-back for registration results. */
export async function listParticipantsByIds(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
  participantIds: readonly string[],
): Promise<WorkshopParticipant[]> {
  if (participantIds.length === 0) return [];
  const rows = await participantQuery(
    tx,
    subdomain,
    workshopId,
    [inArray(workshopParticipants.id, [...participantIds])],
    false,
  );
  return rows.map(toParticipant);
}

/** Queued registrations, ordered by waitlist position (oldest first), live contacts only. */
export async function listWaitlistedParticipants(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<WorkshopParticipant[]> {
  const phone = primaryPhoneLateral(tx);
  const rows = await tx
    .select({
      ...participantColumns,
      contactPhone: sql<string>`coalesce(${phone.number}, '')`,
    })
    .from(workshopParticipants)
    .innerJoin(contacts, contactJoin)
    .leftJoinLateral(phone, sql`true`)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
        isNotNull(workshopParticipants.waitlistedAt),
      ),
    )
    .orderBy(
      asc(workshopParticipants.waitlistedAt),
      asc(workshopParticipants.createdAt),
      asc(workshopParticipants.id),
    );
  return rows.map(toParticipant);
}

/**
 * Seat count for the capacity check. A `count(*)` — not the materialized roster — because this
 * runs on every registration inside the event-row lock.
 */
export async function countActiveParticipants(
  tx: TenantTransaction,
  subdomain: string,
  workshopId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        eq(workshopParticipants.workshopId, workshopId),
        isNull(workshopParticipants.deletedAt),
        isNull(workshopParticipants.waitlistedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

/** Active seat counts for several workshops in one grouped query (list / detail projections). */
export async function countActiveParticipantsByWorkshop(
  tx: TenantTransaction,
  subdomain: string,
  workshopIds: string[],
): Promise<Map<string, number>> {
  if (workshopIds.length === 0) return new Map();
  const rows = await tx
    .select({ workshopId: workshopParticipants.workshopId, count: sql<number>`count(*)::int` })
    .from(workshopParticipants)
    .where(
      and(
        eq(workshopParticipants.workspaceSubdomain, subdomain),
        inArray(workshopParticipants.workshopId, workshopIds),
        isNull(workshopParticipants.deletedAt),
        isNull(workshopParticipants.waitlistedAt),
      ),
    )
    .groupBy(workshopParticipants.workshopId);
  return new Map(rows.map((row) => [row.workshopId, Number(row.count)]));
}
