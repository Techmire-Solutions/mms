import { and, notInArray, sql, type SQL } from "drizzle-orm";
import { buildNamePrefixRegex, dedupeTrimmedIds } from "@mms/shared";
import { contacts, contactPhones, contactEmails } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { activeWorkspaceWhere } from "./contactRepositoryAggregateHelpers.js";
import {
  cnicComparisonKeySql,
  emailKeySql,
  nameKeySql,
  phoneComparisonKeySql,
} from "./contactRepositoryDuplicateSql.js";

export interface ContactDuplicateCandidateKeys {
  phones: string[];
  emails: string[];
  name: string;
  cnic?: string;
  namePrefixes: string[];
}

/**
 * Active contact ids sharing any normalized duplicate key with the candidate.
 * SQL-scoped candidate pre-filter — no full-tenant hydrate. Used by the
 * per-request `/duplicate-check` count.
 */
export async function findContactDuplicateCandidateIds(
  tenant: string,
  keys: ContactDuplicateCandidateKeys,
  excludeIds: Array<string | number> = [],
): Promise<string[]> {
  const phones = dedupeTrimmedIds(keys.phones);
  const emails: string[] = [];
  const seenEmails = new Set<string>();
  for (let i = 0; i < keys.emails.length; i++) {
    const raw = keys.emails[i];
    if (!raw) continue;
    const lower = raw.trim().toLowerCase();
    if (lower && !seenEmails.has(lower)) {
      seenEmails.add(lower);
      emails.push(lower);
    }
  }
  const name = keys.name?.trim() ?? "";
  const cnic = (keys.cnic ?? "").replace(/\D/g, "");
  if (phones.length === 0 && emails.length === 0 && !name && !cnic) return [];

  const subdomain = tenant.trim().toLowerCase();
  const excluded = dedupeTrimmedIds(excludeIds);
  const prefixRegex = buildNamePrefixRegex(keys.namePrefixes);
  const matchClauses: SQL[] = [];

  if (phones.length > 0) {
    matchClauses.push(sql`EXISTS (
      SELECT 1
      FROM ${contactPhones} p
      WHERE p.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND p.contact_id = ${contacts.id}
        AND ${phoneComparisonKeySql(sql`p.number`)}
          IN (${sql.join(
            phones.map((p) => sql`${p}`),
            sql`, `,
          )})
    )`);
  }

  if (emails.length > 0) {
    matchClauses.push(sql`EXISTS (
      SELECT 1
      FROM ${contactEmails} e
      WHERE e.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND e.contact_id = ${contacts.id}
        AND ${emailKeySql(sql`e.address`)}
          IN (${sql.join(
            emails.map((e) => sql`${e}`),
            sql`, `,
          )})
    )`);
  }

  if (cnic && cnic.length === 13) {
    matchClauses.push(sql`${cnicComparisonKeySql(sql`${contacts.cnic}`)} = ${cnic}`);
  }

  if (name) {
    matchClauses.push(sql`${nameKeySql(prefixRegex)} = ${name}`);
  }

  if (matchClauses.length === 0) return [];

  const whereParts: SQL[] = [
    activeWorkspaceWhere(subdomain),
    sql`(${sql.join(matchClauses, sql` OR `)})`,
  ];
  if (excluded.length > 0) {
    whereParts.push(notInArray(contacts.id, excluded));
  }

  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(...whereParts));
    return rows.map((row) => String(row.id));
  });
}

/**
 * Distinct active contact ids that could participate in any duplicate pair.
 *
 * Single SQL pass over the tenant: emits one row per (contact, key) from the
 * phone/email/name/cnic key space, keeps keys with >= 2 distinct contacts, and
 * returns the distinct participant ids. No full active-set hydration.
 */
export async function findContactDuplicateBlockedIds(
  tenant: string,
  namePrefixes: string[],
): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  const prefixRegex = buildNamePrefixRegex(namePrefixes);

  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      WITH keyed AS (
        SELECT p.contact_id AS id,
               ${phoneComparisonKeySql(sql`p.number`)} AS k
        FROM ${contactPhones} p
        JOIN ${contacts} c ON c.workspace_subdomain = p.workspace_subdomain AND c.id = p.contact_id
        WHERE p.workspace_subdomain = ${subdomain}
          AND c.deleted_at IS NULL
          AND ${phoneComparisonKeySql(sql`p.number`)} <> ''
        UNION ALL
        SELECT e.contact_id AS id,
               ${emailKeySql(sql`e.address`)} AS k
        FROM ${contactEmails} e
        JOIN ${contacts} c ON c.workspace_subdomain = e.workspace_subdomain AND c.id = e.contact_id
        WHERE e.workspace_subdomain = ${subdomain}
          AND c.deleted_at IS NULL
          AND ${emailKeySql(sql`e.address`)} <> ''
        UNION ALL
        SELECT c.id AS id,
               ${cnicComparisonKeySql(sql`c.cnic`)} AS k
        FROM ${contacts} c
        WHERE c.workspace_subdomain = ${subdomain}
          AND c.deleted_at IS NULL
          AND NULLIF(trim(c.cnic), '') IS NOT NULL
          AND ${cnicComparisonKeySql(sql`c.cnic`)} <> ''
        UNION ALL
        SELECT ${contacts.id} AS id,
               ${nameKeySql(prefixRegex)} AS k
        FROM ${contacts}
        WHERE ${activeWorkspaceWhere(subdomain)}
          AND ${nameKeySql(prefixRegex)} <> ''
      ),
      buckets AS (
        SELECT k, id
        FROM keyed
        GROUP BY k, id
      ),
      multi AS (
        SELECT k
        FROM buckets
        GROUP BY k
        HAVING count(*) >= 2
      )
      SELECT DISTINCT b.id
      FROM buckets b
      JOIN multi m USING (k)
    `);
    return (result.rows as Array<{ id: string }>).map((row) => String(row.id));
  });
}
