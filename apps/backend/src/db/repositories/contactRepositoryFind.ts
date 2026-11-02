import { and, eq, inArray } from "drizzle-orm";
import type { Contact } from "@mms/shared";
import { contacts } from "../schema.js";
import { withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { getPreparedContactById } from "../preparedStatements.js";
import { contactSelectColumns } from "./contactRepositoryColumns.js";
import { hydrateContactsList, hydrateContactsSummaryList } from "./contactRepositoryHydrate.js";

type ContactRow = typeof contacts.$inferSelect;

/**
 * Bind-parameter safety: `IN ($1..$n)` lists are chunked at the same 250-row
 * batch the child hydration uses, so a large id set (duplicate scan blocked ids,
 * messaging recipients, resolve) cannot approach PostgreSQL's 65 535 cap.
 */
const ID_FETCH_BATCH_SIZE = 250;

function selectContactRowsByIds(
  tx: TenantTransaction,
  subdomain: string,
  ids: string[],
): Promise<ContactRow[]> {
  return tx
    .select(contactSelectColumns)
    .from(contacts)
    .where(and(eq(contacts.workspaceSubdomain, subdomain), inArray(contacts.id, ids)));
}

async function fetchRowsByIds(
  tx: TenantTransaction,
  subdomain: string,
  ids: string[],
): Promise<ContactRow[]> {
  if (ids.length <= ID_FETCH_BATCH_SIZE) {
    return selectContactRowsByIds(tx, subdomain, ids);
  }
  const rows: ContactRow[] = [];
  for (let index = 0; index < ids.length; index += ID_FETCH_BATCH_SIZE) {
    rows.push(
      ...(await selectContactRowsByIds(
        tx,
        subdomain,
        ids.slice(index, index + ID_FETCH_BATCH_SIZE),
      )),
    );
  }
  return rows;
}

export async function findContactById(
  tenant: string,
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<Contact | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (options?.includeDeleted) await enableIncludeDeleted(tx);
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

export async function findContactsByIds(
  tenant: string,
  ids: string[],
  options?: { includeDeleted?: boolean },
): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    if (options?.includeDeleted) await enableIncludeDeleted(tx);
    const rows = await fetchRowsByIds(tx, subdomain, ids);
    return hydrateContactsList(tx, subdomain, rows);
  });
}

export async function findContactsSummaryByIds(tenant: string, ids: string[]): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await fetchRowsByIds(tx, subdomain, ids);
    return hydrateContactsSummaryList(tx, subdomain, rows);
  });
}
