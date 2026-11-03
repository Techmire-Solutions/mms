/**
 * @file contactSystemTagsPreMigration.ts
 * @description Pre-migration conflict cleanup for 0201/0202 system role tags.
 * PostgreSQL snapshot isolation prevents CTE DELETEs from being seen by INSERTs in
 * the same statement. This deletes manual tags with colliding names before 0201/0202
 * run so their backfill INSERTs succeed without unique constraint violations.
 */
import type pg from "pg";

export async function prepareContactSystemTagsPreMigration(client: pg.Client): Promise<void> {
  // 1. Check if contact_tags table even exists (if not, we're on a fresh DB before 0074).
  const tableCheck = await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contact_tags'
  `);
  if (tableCheck.rows.length === 0) {
    return;
  }

  // 2. Check if contact_tags has system_key column (if so, 0201 has already run).
  const colCheck = await client.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contact_tags' AND column_name = 'system_key'
  `);
  if (colCheck.rows.length > 0) {
    return;
  }

  // 3. Pre-cleanup student role collisions if students table exists
  const studentsCheck = await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  `);
  if (studentsCheck.rows.length > 0) {
    await client.query(`
      DELETE FROM "contact_tags" t
      USING (
        SELECT s."workspace_subdomain", s."contact_id" AS contact_id, 'Student' AS display_name
        FROM "students" s WHERE s."contact_id" IS NOT NULL
        UNION ALL
        SELECT s."workspace_subdomain", s."father_contact_id", 'Parent'
        FROM "students" s WHERE s."father_contact_id" IS NOT NULL
        UNION ALL
        SELECT s."workspace_subdomain", s."mother_contact_id", 'Parent'
        FROM "students" s WHERE s."mother_contact_id" IS NOT NULL
        UNION ALL
        SELECT s."workspace_subdomain", s."guardian_contact_id", 'Guardian'
        FROM "students" s WHERE s."guardian_contact_id" IS NOT NULL
        UNION ALL
        SELECT s."workspace_subdomain", s."contact_id" AS contact_id, 'Former Student'
        FROM "students" s WHERE s."contact_id" IS NOT NULL
        UNION ALL
        SELECT s."workspace_subdomain", s."father_contact_id", 'Former Parent'
        FROM "students" s WHERE s."father_contact_id" IS NOT NULL
        UNION ALL
        SELECT s."workspace_subdomain", s."mother_contact_id", 'Former Parent'
        FROM "students" s WHERE s."mother_contact_id" IS NOT NULL
        UNION ALL
        SELECT s."workspace_subdomain", s."guardian_contact_id", 'Former Guardian'
        FROM "students" s WHERE s."guardian_contact_id" IS NOT NULL
      ) d
      WHERE t."workspace_subdomain" = d."workspace_subdomain"
        AND t."contact_id" = d.contact_id
        AND lower(btrim(t."name")) = lower(btrim(d.display_name));
    `);
  }

  // 4. Pre-cleanup faculty designation collisions if faculty tables exist
  const facultyCheck = await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'faculty_employments'
  `);
  if (facultyCheck.rows.length > 0) {
    await client.query(`
      DELETE FROM "contact_tags" t
      USING (
        SELECT e."workspace_subdomain", e."contact_id",
               'faculty-' || left(regexp_replace(btrim(d."name"), '\\s+', ' ', 'g'), 170) AS display_name
        FROM "faculty_employments" e
        JOIN "faculty" f ON f."workspace_subdomain" = e."workspace_subdomain" AND f."employment_id" = e."id"
        JOIN "faculty_employ_designations" ed ON ed."workspace_subdomain" = e."workspace_subdomain" AND ed."employment_id" = e."id"
        JOIN "faculty_designations" d ON d."workspace_subdomain" = e."workspace_subdomain" AND d."id" = ed."designation_id"
        UNION ALL
        SELECT e."workspace_subdomain", e."contact_id",
               'Former faculty-' || left(regexp_replace(btrim(d."name"), '\\s+', ' ', 'g'), 170) AS display_name
        FROM "faculty_employments" e
        JOIN "faculty" f ON f."workspace_subdomain" = e."workspace_subdomain" AND f."employment_id" = e."id"
        JOIN "faculty_employ_designations" ed ON ed."workspace_subdomain" = e."workspace_subdomain" AND ed."employment_id" = e."id"
        JOIN "faculty_designations" d ON d."workspace_subdomain" = e."workspace_subdomain" AND d."id" = ed."designation_id"
        UNION ALL
        SELECT e."workspace_subdomain", e."contact_id",
               'faculty-' || left(regexp_replace(btrim(d."name"), '\\s+', ' ', 'g'), 170) AS display_name
        FROM "faculty_employments" e
        JOIN "faculty" f ON f."workspace_subdomain" = e."workspace_subdomain" AND f."employment_id" = e."id"
        JOIN "faculty_assignments" a ON a."workspace_subdomain" = e."workspace_subdomain" AND a."faculty_id" = f."id"
        JOIN "faculty_designations" d ON d."workspace_subdomain" = e."workspace_subdomain" AND d."id" = a."designation_id"
        UNION ALL
        SELECT e."workspace_subdomain", e."contact_id",
               'Former faculty-' || left(regexp_replace(btrim(d."name"), '\\s+', ' ', 'g'), 170) AS display_name
        FROM "faculty_employments" e
        JOIN "faculty" f ON f."workspace_subdomain" = e."workspace_subdomain" AND f."employment_id" = e."id"
        JOIN "faculty_assignments" a ON a."workspace_subdomain" = e."workspace_subdomain" AND a."faculty_id" = f."id"
        JOIN "faculty_designations" d ON d."workspace_subdomain" = e."workspace_subdomain" AND d."id" = a."designation_id"
      ) d
      WHERE t."workspace_subdomain" = d."workspace_subdomain"
        AND t."contact_id" = d.contact_id
        AND lower(btrim(t."name")) = lower(btrim(d.display_name));
    `);
  }

  // 5. Pre-cleanup relationship roles collisions (for 0202) if contact_relationships exists
  const relCheck = await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contact_relationships'
  `);
  if (relCheck.rows.length > 0) {
    await client.query(`
      DELETE FROM "contact_tags" t
      USING (
        SELECT cr."workspace_subdomain", cr."related_contact_id" AS contact_id,
               CASE WHEN lower(btrim(cr."relationship")) = 'guardian' THEN 'Guardian' ELSE 'Parent' END AS display_name
        FROM "contact_relationships" cr
        WHERE cr."related_contact_id" IS NOT NULL AND lower(btrim(cr."relationship")) IN ('parent', 'guardian')
        UNION ALL
        SELECT cr."workspace_subdomain", cr."related_contact_id" AS contact_id,
               CASE WHEN lower(btrim(cr."relationship")) = 'guardian' THEN 'Former Guardian' ELSE 'Former Parent' END AS display_name
        FROM "contact_relationships" cr
        WHERE cr."related_contact_id" IS NOT NULL AND lower(btrim(cr."relationship")) IN ('parent', 'guardian')
      ) d
      WHERE t."workspace_subdomain" = d."workspace_subdomain"
        AND t."contact_id" = d.contact_id
        AND lower(btrim(t."name")) = lower(btrim(d.display_name));
    `);
  }
}
