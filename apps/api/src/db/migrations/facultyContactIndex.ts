/**
 * @file facultyContactIndex.ts
 * @description Ensure unique active contact on faculty_employments (post-contract SSOT).
 * Runs after Drizzle commits — PostgreSQL forbids CONCURRENTLY inside a transaction.
 */
import type pg from "pg";

const EMPLOYMENT_CONTACT_UIDX = "faculty_employments_contact_active_uidx";
const LEGACY_FACULTY_CONTACT_UIDX = "faculty_workspace_contact_active_uidx";

async function indexState(
  client: pg.Client,
  indexName: string,
): Promise<"missing" | "valid" | "invalid"> {
  const existing = await client.query<{ indisvalid: boolean }>(
    `SELECT i.indisvalid FROM pg_index i
     JOIN pg_class c ON c.oid = i.indexrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [indexName],
  );
  if (!existing.rows.length) return "missing";
  return existing.rows[0]?.indisvalid ? "valid" : "invalid";
}

export async function ensureFacultyContactIndex(client: pg.Client): Promise<void> {
  await client.query("SELECT pg_advisory_lock(2145836402)");
  try {
    // Contract dropped faculty.contact_id — remove any leftover faculty-level unique index.
    const legacy = await indexState(client, LEGACY_FACULTY_CONTACT_UIDX);
    if (legacy !== "missing") {
      await client.query(`DROP INDEX CONCURRENTLY IF EXISTS public.${LEGACY_FACULTY_CONTACT_UIDX}`);
    }

    const employment = await indexState(client, EMPLOYMENT_CONTACT_UIDX);
    if (employment === "valid") return;
    if (employment === "invalid") {
      await client.query(`DROP INDEX CONCURRENTLY IF EXISTS public.${EMPLOYMENT_CONTACT_UIDX}`);
    }
    await client.query(`
      CREATE UNIQUE INDEX CONCURRENTLY ${EMPLOYMENT_CONTACT_UIDX}
      ON public.faculty_employments (workspace_subdomain, contact_id)
      WHERE deleted_at IS NULL
    `);
  } finally {
    await client.query("SELECT pg_advisory_unlock(2145836402)");
  }
}
