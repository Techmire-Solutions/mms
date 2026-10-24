import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { contacts, contactAddresses } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

export function scalarFieldSql(fieldKey: string): SQL {
  switch (fieldKey) {
    case "firstName":
      return sql`lower(trim(COALESCE(${contacts.firstName}, '')))`;
    case "lastName":
      return sql`lower(trim(COALESCE(${contacts.lastName}, '')))`;
    case "cnic":
      return sql`regexp_replace(COALESCE(${contacts.cnic}, ''), '[^0-9]', '', 'g')`;
    case "dob":
      return sql`lower(trim(COALESCE(${contacts.dob}::text, '')))`;
    case "city":
      return sql`lower(trim(COALESCE((
        SELECT a.city FROM ${contactAddresses} a
        WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain}
          AND a.contact_id = ${contacts.id}
        ORDER BY CASE WHEN a.is_primary THEN 0 ELSE 1 END, a.sort_order ASC
        LIMIT 1
      ), '')))`;
    case "state":
      return sql`lower(trim(COALESCE((
        SELECT a.state FROM ${contactAddresses} a
        WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain}
          AND a.contact_id = ${contacts.id}
        ORDER BY CASE WHEN a.is_primary THEN 0 ELSE 1 END, a.sort_order ASC
        LIMIT 1
      ), '')))`;
    case "country":
      return sql`lower(trim(COALESCE((
        SELECT a.country FROM ${contactAddresses} a
        WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain}
          AND a.contact_id = ${contacts.id}
        ORDER BY CASE WHEN a.is_primary THEN 0 ELSE 1 END, a.sort_order ASC
        LIMIT 1
      ), '')))`;
    default:
      return sql`lower(trim(COALESCE(${contacts.name}, '')))`;
  }
}

/**
 * Normalized active contact names that match any of the candidates (lower/trim).
 * Used by Google sync name-dedupe without a full-tenant hydrate.
 */
export async function findExistingNormalizedContactNames(
  tenant: string,
  names: string[],
): Promise<Set<string>> {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    const raw = names[i];
    if (!raw) continue;
    const lower = raw.trim().toLowerCase();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      normalized.push(lower);
    }
  }
  if (normalized.length === 0) return new Set();

  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        name: sql<string>`lower(trim(${contacts.name}))`,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceSubdomain, subdomain),
          isNull(contacts.deletedAt),
          inArray(sql`lower(trim(${contacts.name}))`, normalized),
        ),
      );
    const result = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].name) result.add(rows[i].name);
    }
    return result;
  });
}
