import { and, sql } from "drizzle-orm";
import {
  hydrateContactRelationshipFields,
  type Contact,
  type RepositoryListOptions,
} from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { contacts } from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";
import {
  loadContactChildMaps,
  loadContactSummaryChildMaps,
} from "./contactRepositoryHydrateChildren.js";
import { contactRowToRecord } from "./contactRepositoryMappers.js";

type Transaction = TenantTransaction;
type ContactRow = typeof contacts.$inferSelect;

export function hydrateContact(contact: Contact): Contact {
  return hydrateContactRelationshipFields(contact);
}

export async function hydrateContactsList(
  tx: Transaction,
  subdomain: string,
  contactRows: ContactRow[],
): Promise<Contact[]> {
  if (contactRows.length === 0) return [];
  const contactIds = contactRows.map((c) => c.id);
  const childMaps = await loadContactChildMaps(tx, subdomain, contactIds);

  return contactRows.map((row) =>
    contactRowToRecord(
      row,
      childMaps.phonesMap.get(row.id) ?? [],
      childMaps.emailsMap.get(row.id) ?? [],
      childMaps.addressesMap.get(row.id) ?? [],
      childMaps.tagsMap.get(row.id) ?? [],
      childMaps.socialsMap.get(row.id) ?? [],
      childMaps.educationsMap.get(row.id) ?? [],
      childMaps.experiencesMap.get(row.id) ?? [],
      childMaps.skillsMap.get(row.id) ?? [],
      childMaps.relationshipsMap.get(row.id) ?? [],
      childMaps.activitiesMap.get(row.id) ?? [],
      childMaps.attachmentsMap.get(row.id) ?? [],
      childMaps.bankDetailsMap.get(row.id) ?? [],
    ),
  );
}

export async function hydrateContactsSummaryList(
  tx: Transaction,
  subdomain: string,
  contactRows: ContactRow[],
): Promise<Contact[]> {
  if (contactRows.length === 0) return [];
  const contactIds = contactRows.map((c) => c.id);
  const childMaps = await loadContactSummaryChildMaps(tx, subdomain, contactIds);

  return contactRows.map((row) =>
    contactRowToRecord(
      row,
      childMaps.phonesMap.get(row.id) ?? [],
      childMaps.emailsMap.get(row.id) ?? [],
      childMaps.addressesMap.get(row.id) ?? [],
      childMaps.tagsMap.get(row.id) ?? [],
      childMaps.socialsMap.get(row.id) ?? [],
      [],
      [],
      [],
      childMaps.relationshipsMap.get(row.id) ?? [],
      [],
      [],
      [],
    ),
  );
}

export type ListByWorkspaceOptions = RepositoryListOptions;

export async function listContactsByWorkspace(
  tenant: string,
  options?: ListByWorkspaceOptions,
): Promise<Contact[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(contacts, subdomain, deletedFilter);

    const rows = await tx
      .select(contactSelectColumns)
      .from(contacts)
      .where(and(...conditions))
      .orderBy(contacts.name, contacts.id)
      .limit(limit)
      .offset(offset);
    return hydrateContactsList(tx, subdomain, rows);
  });
}

export async function countContactsByWorkspace(
  tenant: string,
  options?: ListByWorkspaceOptions,
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(contacts, subdomain, deletedFilter);

    const rows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(and(...conditions));
    return Number(rows[0]?.count ?? 0);
  });
}

import { contactSelectColumns } from "./contactRepositoryColumns.js";
import {
  findContactById,
  findContactsByIds,
  findContactsSummaryByIds,
} from "./contactRepositoryFind.js";

export { findContactById, findContactsByIds, findContactsSummaryByIds };
