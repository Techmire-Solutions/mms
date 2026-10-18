import { and, eq, inArray } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import { contacts } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { getPreparedContactById } from "../preparedStatements.js";
import { contactSelectColumns } from "./contactRepositoryColumns.js";
import { hydrateContactsList, hydrateContactsSummaryList } from "./contactRepositoryHydrate.js";

type ContactRow = typeof contacts.$inferSelect;

export async function findContactById(tenant: string, id: string): Promise<Contact | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    let rows: ContactRow[];
    if (
      process.env.MMS_USE_PREPARED_STATEMENTS !== "false" &&
      typeof (tx as { execute?: unknown }).execute === "function"
    ) {
      try {
        const stmt = getPreparedContactById(tx);
        rows = await stmt.execute({ subdomain, id });
      } catch {
        rows = await tx
          .select(contactSelectColumns)
          .from(contacts)
          .where(and(eq(contacts.workspaceSubdomain, subdomain), eq(contacts.id, id)))
          .limit(1);
      }
    } else {
      rows = await tx
        .select(contactSelectColumns)
        .from(contacts)
        .where(and(eq(contacts.workspaceSubdomain, subdomain), eq(contacts.id, id)))
        .limit(1);
    }
    const row = rows[0];
    if (!row) return null;
    const [result] = await hydrateContactsList(tx, subdomain, [row]);
    return result ?? null;
  });
}

export async function findContactsByIds(tenant: string, ids: string[]): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(contactSelectColumns)
      .from(contacts)
      .where(and(eq(contacts.workspaceSubdomain, subdomain), inArray(contacts.id, ids)));
    return hydrateContactsList(tx, subdomain, rows);
  });
}

export async function findContactsSummaryByIds(tenant: string, ids: string[]): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(contactSelectColumns)
      .from(contacts)
      .where(and(eq(contacts.workspaceSubdomain, subdomain), inArray(contacts.id, ids)));
    return hydrateContactsSummaryList(tx, subdomain, rows);
  });
}
