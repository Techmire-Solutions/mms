import { sql } from "drizzle-orm";
import {
  CONTACT_DEPENDENT_RELATIONSHIP_TERMS,
  CONTACT_GUARDIAN_RELATIONSHIP_TERMS,
  dedupeTrimmedIds,
} from "@mms/shared";
import { contacts, contactRelationships, students } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";

/** Ids per round trip — the id list is bound three times per query (bind-parameter cap). */
const GUARDIAN_LOOKUP_BATCH_SIZE = 250;

function termList(terms: readonly string[]) {
  return sql.join(
    terms.map((term) => sql`${term}`),
    sql`, `,
  );
}

/**
 * Which of `ids` act as a parent/guardian of some active child.
 *
 * A contact is a guardian when an active contact links it with a parent/guardian
 * relationship, when its own relationship rows link a child/dependent, or when an
 * active student references it as father/mother/guardian. Used by the duplicate
 * scan so one parent with several children is not flagged on name alone.
 */
export async function findContactGuardianIds(tenant: string, ids: string[]): Promise<string[]> {
  const subdomain = tenant.trim().toLowerCase();
  const wanted = dedupeTrimmedIds(ids);
  const found = new Set<string>();
  for (let offset = 0; offset < wanted.length; offset += GUARDIAN_LOOKUP_BATCH_SIZE) {
    const chunk = wanted.slice(offset, offset + GUARDIAN_LOOKUP_BATCH_SIZE);
    for (const id of await findGuardianIdsChunk(subdomain, chunk)) found.add(id);
  }
  return [...found];
}

async function findGuardianIdsChunk(subdomain: string, wanted: string[]): Promise<string[]> {
  const idList = sql.join(
    wanted.map((id) => sql`${id}`),
    sql`, `,
  );
  const relationshipTerm = sql`lower(regexp_replace(trim(COALESCE(r.relationship, '')), '\\s+', ' ', 'g'))`;

  return withTenantRead(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      SELECT r.related_contact_id AS id
      FROM ${contactRelationships} r
      JOIN ${contacts} c ON c.workspace_subdomain = r.workspace_subdomain AND c.id = r.contact_id
      WHERE r.workspace_subdomain = ${subdomain}
        AND c.deleted_at IS NULL
        AND r.related_contact_id IN (${idList})
        AND ${relationshipTerm} IN (${termList(CONTACT_GUARDIAN_RELATIONSHIP_TERMS)})
      UNION
      SELECT r.contact_id AS id
      FROM ${contactRelationships} r
      JOIN ${contacts} c ON c.workspace_subdomain = r.workspace_subdomain AND c.id = r.related_contact_id
      WHERE r.workspace_subdomain = ${subdomain}
        AND c.deleted_at IS NULL
        AND r.contact_id IN (${idList})
        AND ${relationshipTerm} IN (${termList(CONTACT_DEPENDENT_RELATIONSHIP_TERMS)})
      UNION
      SELECT g.id
      FROM ${students} s
      CROSS JOIN LATERAL (
        VALUES (s.father_contact_id), (s.mother_contact_id), (s.guardian_contact_id)
      ) AS g(id)
      WHERE s.workspace_subdomain = ${subdomain}
        AND s.deleted_at IS NULL
        AND g.id IN (${idList})
    `);
    return (result.rows as Array<{ id: string | null }>)
      .map((row) => (row.id == null ? "" : String(row.id)))
      .filter(Boolean);
  });
}
